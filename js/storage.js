import { workoutFromStored, workoutToStored } from './logic.js'

const DB_NAME = 'fitness'
const STORE = 'workouts'
let databasePromise

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' })
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

export async function removeWorkout(id) {
  const database = await openDatabase()
  await new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)
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
