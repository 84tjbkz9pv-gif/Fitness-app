import { workoutFromStored, workoutToStored } from './logic.js'
import { planFromStored } from './plan.js'

const DB_NAME = 'fitness'
const DB_VERSION = 4
const STORE = 'workouts'
const SETTINGS = 'settings'
const ROUTINES = 'routines'
const SESSIONS = 'sessions'
const EXERCISES = 'exercises'
const PLANS = 'plans'
let databasePromise

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains(SETTINGS)) {
          database.createObjectStore(SETTINGS)
        }
        for (const name of [ROUTINES, SESSIONS, EXERCISES, PLANS]) {
          if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        databasePromise = null
        reject(request.error)
      }
    })
  }
  return databasePromise
}

export async function loadWorkouts() {
  const database = await openDatabase()
  const rows = await new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return rows.map(workoutFromStored).filter(Boolean)
}

export async function putWorkout(workout) {
  const database = await openDatabase()
  const stored = workoutToStored(workout)
  await new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readwrite').objectStore(STORE).put(stored)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function replaceWorkouts(workouts) {
  const database = await openDatabase()
  const stored = workouts.map(workoutToStored)
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    const clearRequest = store.clear()
    clearRequest.onerror = () => reject(clearRequest.error)
    clearRequest.onsuccess = () => {
      for (const row of stored) store.put(row)
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export function loadRoutines() {
  return readAll(ROUTINES)
}

export function putRoutine(routine) {
  return putRecord(ROUTINES, routine)
}

export function deleteRoutine(id) {
  return deleteRecord(ROUTINES, id)
}

export function replaceRoutines(routines) {
  return replaceAll(ROUTINES, routines)
}

export function loadSessions() {
  return readAll(SESSIONS)
}

export function deleteSession(id) {
  return deleteRecord(SESSIONS, id)
}

export function putSession(session) {
  return putRecord(SESSIONS, sessionToRow(session))
}

export function replaceSessions(sessions) {
  return replaceAll(SESSIONS, sessions.map(sessionToRow))
}

export function loadExercises() {
  return readAll(EXERCISES)
}

export function putExercise(exercise) {
  return putRecord(EXERCISES, exercise)
}

export function replaceExercises(exercises) {
  return replaceAll(EXERCISES, exercises)
}

export async function loadPlans() {
  const rows = await readAll(PLANS)
  return rows.map(planFromStored).filter(Boolean)
}

export function putPlan(plan) {
  return putRecord(PLANS, plan)
}

export function deletePlan(id) {
  return deleteRecord(PLANS, id)
}

export function replacePlans(plans) {
  return replaceAll(PLANS, plans)
}

function sessionToRow(session) {
  return {
    ...session,
    startedAt: session.startedAt.toISOString(),
    finishedAt: session.finishedAt ? session.finishedAt.toISOString() : null,
  }
}

function sessionFromRow(row) {
  return {
    ...row,
    startedAt: new Date(row.startedAt),
    finishedAt: row.finishedAt ? new Date(row.finishedAt) : null,
  }
}

async function readAll(storeName) {
  const database = await openDatabase()
  const rows = await new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return storeName === SESSIONS ? rows.map(sessionFromRow) : rows
}

async function putRecord(storeName, record) {
  const database = await openDatabase()
  await new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function deleteRecord(storeName, id) {
  const database = await openDatabase()
  await new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function replaceAll(storeName, records) {
  const database = await openDatabase()
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const clearRequest = store.clear()
    clearRequest.onerror = () => reject(clearRequest.error)
    clearRequest.onsuccess = () => {
      for (const record of records) store.put(record)
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function removeWorkout(id) {
  const database = await openDatabase()
  await new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function loadPinRecord() {
  return readSetting('pin')
}

export async function savePinRecord(record) {
  await writeSetting('pin', {
    salt: record.salt,
    hash: record.hash,
    iterations: record.iterations,
  })
}

export async function loadLockout() {
  const stored = await readSetting('lockout')
  if (!stored || !Number.isInteger(stored.failures) || typeof stored.lockedUntil !== 'number') {
    return { failures: 0, lockedUntil: 0 }
  }
  return { failures: stored.failures, lockedUntil: stored.lockedUntil }
}

export async function saveLockout(lockout) {
  await writeSetting('lockout', {
    failures: lockout.failures,
    lockedUntil: lockout.lockedUntil,
  })
}

export async function wipeAllData() {
  if (databasePromise) {
    try {
      const database = await databasePromise
      database.close()
    } catch {
      // Closing a failed connection should not stop the wipe.
    }
    databasePromise = null
  }
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}

async function readSetting(key) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(SETTINGS, 'readonly').objectStore(SETTINGS).get(key)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function writeSetting(key, value) {
  const database = await openDatabase()
  await new Promise((resolve, reject) => {
    const request = database.transaction(SETTINGS, 'readwrite').objectStore(SETTINGS).put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function keepDataOnThisPhone() {
  if (!navigator.storage?.persist) return
  try {
    await navigator.storage.persist()
  } catch {
    // The workouts are still stored. Persistent storage is only a hint to the browser.
  }
}
