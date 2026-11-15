const ROOT_KEYS = new Set(['name', 'exercises'])
const EXERCISE_KEYS = new Set(['name', 'sets', 'bodyweight'])
const SET_KEYS = new Set(['kg', 'reps', 'warmUp'])

export function encodeRoutineCode(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function routineLink(payload, pageUrl) {
  const base = String(pageUrl).split('#')[0]
  return `${base}#routine=${encodeRoutineCode(payload)}`
}

export function decodeRoutineLink(input) {
  const code = extractRoutineCode(input)
  if (!code) return { ok: false }
  return decodeRoutineCode(code)
}

export function importRoutine(payload, state) {
  const decoded = typeof payload === 'string' || payload?.exercises === undefined
    ? decodeRoutineLink(payload)
    : validateRoutinePayload(payload)
  if (!decoded.ok) return { ok: false }
  const existing = [...state.builtIn, ...state.exercises]
  const newExercises = []
  const exercises = []
  for (const item of decoded.routine.exercises) {
    const found = findByName(item.name, existing) || findByName(item.name, newExercises)
    const exerciseId = found ? found.id : state.newId()
    if (!found) newExercises.push({ id: exerciseId, name: item.name })
    exercises.push({
      exerciseId,
      repsOnly: item.bodyweight === true,
      sets: item.sets.map((set) => ({
        reps: set.reps,
        weightKg: set.kg ?? null,
        warmUp: set.warmUp === true,
      })),
    })
  }
  return {
    ok: true,
    newExercises,
    routine: { id: state.newId(), name: decoded.routine.name, exercises },
  }
}

function extractRoutineCode(input) {
  const text = String(input ?? '').trim()
  if (text === '') return null
  const marker = '#routine='
  const markerAt = text.indexOf(marker)
  if (markerAt !== -1) return cleanCode(text.slice(markerAt + marker.length))
  if (text.startsWith('routine=')) return cleanCode(text.slice('routine='.length))
  try {
    const url = new URL(text)
    if (url.hash.startsWith(marker)) return cleanCode(url.hash.slice(marker.length))
  } catch {
    // A bare code is not a URL.
  }
  return cleanCode(text)
}

function cleanCode(code) {
  const trimmed = code.trim().split(/[\s&]/)[0]
  return trimmed === '' ? null : trimmed
}

function decodeRoutineCode(code) {
  try {
    const pad = code.length % 4 === 0 ? '' : '='.repeat(4 - (code.length % 4))
    const binary = atob(code.replaceAll('-', '+').replaceAll('_', '/') + pad)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return validateRoutinePayload(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return { ok: false }
  }
}

function validateRoutinePayload(value) {
  if (!isObject(value) || !exactKeys(value, ROOT_KEYS)) return { ok: false }
  const name = cleanName(value.name)
  if (!name || !Array.isArray(value.exercises) || value.exercises.length === 0) return { ok: false }
  const exercises = []
  for (const exercise of value.exercises) {
    const parsed = validateExercise(exercise)
    if (!parsed) return { ok: false }
    exercises.push(parsed)
  }
  return { ok: true, routine: { name, exercises } }
}

function validateExercise(value) {
  if (!isObject(value) || !exactKeys(value, EXERCISE_KEYS)) return null
  const name = cleanName(value.name)
  if (!name || !Array.isArray(value.sets) || value.sets.length === 0) return null
  if (value.bodyweight != null && typeof value.bodyweight !== 'boolean') return null
  const bodyweight = value.bodyweight === true
  const sets = []
  for (const set of value.sets) {
    const parsed = validateSet(set, bodyweight)
    if (!parsed) return null
    sets.push(parsed)
  }
  return { name, ...(bodyweight ? { bodyweight: true } : {}), sets }
}

function validateSet(value, bodyweight) {
  if (!isObject(value) || !exactKeys(value, SET_KEYS)) return null
  if (!Number.isInteger(value.reps) || value.reps <= 0 || value.reps > 100) return null
  if (value.warmUp != null && typeof value.warmUp !== 'boolean') return null
  if (bodyweight && Object.hasOwn(value, 'kg')) return null
  let kg = null
  if (!bodyweight && Object.hasOwn(value, 'kg')) {
    if (typeof value.kg !== 'number' || !Number.isFinite(value.kg) || value.kg <= 0 || value.kg > 1000) return null
    kg = value.kg
  }
  return {
    reps: value.reps,
    ...(value.warmUp === true ? { warmUp: true } : {}),
    ...(kg == null ? {} : { kg }),
  }
}

function findByName(name, list) {
  const key = name.toLocaleLowerCase('en-GB')
  return list.find((item) => item.name.trim().toLocaleLowerCase('en-GB') === key) ?? null
}

function cleanName(value) {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (name === '' || name.length > 60) return null
  return name
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key))
}

export function legsAPayload() {
  return {
    name: 'Legs A',
    exercises: [
      {
        name: 'Squat (Barbell)',
        sets: [
          { warmUp: true, kg: 20, reps: 12 },
          { kg: 30, reps: 12 },
          { kg: 35, reps: 10 },
          { kg: 40, reps: 10 },
          { kg: 50, reps: 8 },
        ],
      },
      {
        name: 'Bulgarian Split Squat (Dumbbell)',
        sets: [
          { warmUp: true, reps: 12 },
          { kg: 9, reps: 10 },
          { kg: 10, reps: 8 },
          { kg: 12.5, reps: 6 },
        ],
      },
      {
        name: 'Single Leg Romanian Deadlift (Dumbbell)',
        sets: [
          { warmUp: true, reps: 12 },
          { kg: 10, reps: 12 },
          { kg: 10, reps: 10 },
          { kg: 10, reps: 10 },
        ],
      },
      {
        name: 'Glute Bridge',
        bodyweight: true,
        sets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }],
      },
      {
        name: 'Standing Calf Raise (Machine)',
        sets: [
          { kg: 15, reps: 15 },
          { kg: 20, reps: 10 },
          { kg: 25, reps: 8 },
        ],
      },
    ],
  }
}
