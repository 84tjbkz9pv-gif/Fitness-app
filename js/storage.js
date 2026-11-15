import { workoutFromStored, workoutToStored } from './logic.js'

const DB_NAME = 'fitness'
const DB_VERSION = 2
const STORE = 'workouts'
const SETTINGS = 'settings'
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
