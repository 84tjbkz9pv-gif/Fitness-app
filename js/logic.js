export const WORKOUT_TYPES = [
  { id: 'run', title: 'Run' },
  { id: 'walk', title: 'Walk' },
  { id: 'cycle', title: 'Cycle' },
  { id: 'strength', title: 'Strength' },
  { id: 'swim', title: 'Swim' },
  { id: 'yoga', title: 'Yoga' },
  { id: 'other', title: 'Other' },
]

export const BACKUP_VERSION = 2

const MESSAGES = {
  typeMissing: 'Choose a workout type.',
  startMissing: 'Choose a start date and time.',
  durationNotAWholeNumber: 'Enter the duration as a whole number of minutes.',
  durationNotPositive: 'Duration must be greater than zero.',
  distanceNotANumber: 'Enter the distance in kilometres, or leave it blank.',
  distanceNotPositive: 'Distance must be greater than zero, or leave it blank.',
  backupNotJson: 'This file is not a Fitness backup.',
  backupNotFitness: 'This file is not a Fitness backup.',
  backupVersion: 'This backup is from a different version of Fitness.',
  backupWorkout: 'This backup contains a workout that could not be read.',
  backupDuplicate: 'This backup lists the same workout twice.',
  backupExercise: 'This backup contains an exercise that could not be read.',
  backupRoutine: 'This backup contains a routine that could not be read.',
  backupSession: 'This backup contains a gym session that could not be read.',
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function messageFor(error) {
  return MESSAGES[error] ?? 'Check this workout and try again.'
}

export function typeTitle(type) {
  return WORKOUT_TYPES.find((item) => item.id === type)?.title ?? 'Other'
}

/**
 * Blank distance means no distance. A comma is a decimal point, so 5,2 is 5.2 kilometres.
 */
export function validate(draft) {
  if (!WORKOUT_TYPES.some((item) => item.id === draft.type)) {
    return { ok: false, error: 'typeMissing' }
  }
  if (!(draft.startedAt instanceof Date) || Number.isNaN(draft.startedAt.getTime())) {
    return { ok: false, error: 'startMissing' }
  }

  const duration = parseDuration(draft.durationText ?? '')
  if (!duration.ok) return duration

  const distance = parseDistance(draft.distanceText ?? '')
  if (!distance.ok) return distance

  return {
    ok: true,
    value: {
      type: draft.type,
      startedAt: draft.startedAt,
      durationMinutes: duration.value,
      distanceKilometres: distance.value,
      notes: String(draft.notes ?? '').trim(),
    },
  }
}

export function workoutToStored(workout) {
  return {
    id: workout.id,
    type: workout.type,
    startedAt: workout.startedAt.toISOString(),
    durationMinutes: workout.durationMinutes,
    distanceKilometres: workout.distanceKilometres,
    notes: workout.notes,
  }
}

export function createBackup(workouts, exportedAt = new Date(), extra = {}) {
  return {
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    workouts: workouts.slice().sort(compareWorkouts).map(workoutToStored),
    exercises: (extra.exercises ?? []).slice().sort((left, right) => left.id.localeCompare(right.id)).map(exerciseToStored),
    routines: (extra.routines ?? []).slice().sort((left, right) => left.id.localeCompare(right.id)).map(routineToStored),
    sessions: (extra.sessions ?? []).slice().sort((left, right) => left.startedAt - right.startedAt).map(sessionToStored),
  }
}

export function backupFilename(date) {
  return `fitness-backup-${dayKey(date)}.json`
}

export function parseBackup(input) {
  let document = input
  if (typeof input === 'string') {
    try {
      document = JSON.parse(input)
    } catch {
      return { ok: false, error: 'backupNotJson' }
    }
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { ok: false, error: 'backupNotFitness' }
  }
  if (document.version !== 1 && document.version !== 2) {
    return { ok: false, error: 'backupVersion' }
  }
  if (!Array.isArray(document.workouts)) {
    return { ok: false, error: 'backupNotFitness' }
  }

  const workouts = readRecords(document.workouts, workoutFromStored, 'backupWorkout')
  if (!workouts.ok) return workouts
  if (document.version === 1) {
    return { ok: true, workouts: workouts.items, exercises: [], routines: [], sessions: [] }
  }

  const exercises = readRecords(document.exercises ?? [], exerciseFromStored, 'backupExercise')
  if (!exercises.ok) return exercises
  const routines = readRecords(document.routines ?? [], routineFromStored, 'backupRoutine')
  if (!routines.ok) return routines
  const sessions = readRecords(document.sessions ?? [], sessionFromStored, 'backupSession')
  if (!sessions.ok) return sessions
  return {
    ok: true,
    workouts: workouts.items,
    exercises: exercises.items,
    routines: routines.items,
    sessions: sessions.items,
  }
}

export function workoutFromStored(stored) {
  if (!stored || typeof stored.id !== 'string' || stored.id === '') return null
  if (!WORKOUT_TYPES.some((item) => item.id === stored.type)) return null
  const startedAt = new Date(stored.startedAt)
  if (Number.isNaN(startedAt.getTime())) return null
  if (!Number.isInteger(stored.durationMinutes) || stored.durationMinutes <= 0) return null
  const distance = stored.distanceKilometres
  if (distance !== null && (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0)) {
    return null
  }
  if (typeof stored.notes !== 'string') return null
  return {
    id: stored.id,
    type: stored.type,
    startedAt,
    durationMinutes: stored.durationMinutes,
    distanceKilometres: distance,
    notes: stored.notes,
  }
}

function readRecords(rows, convert, error) {
  if (!Array.isArray(rows)) return { ok: false, error }
  const items = []
  const seen = new Set()
  for (const row of rows) {
    const item = convert(row)
    if (!item) return { ok: false, error }
    if (seen.has(item.id)) return { ok: false, error: 'backupDuplicate' }
    seen.add(item.id)
    items.push(item)
  }
  return { ok: true, items }
}

function exerciseToStored(exercise) {
  return { id: exercise.id, name: exercise.name }
}

function exerciseFromStored(stored) {
  if (!stored || typeof stored.id !== 'string' || stored.id === '') return null
  const name = typeof stored.name === 'string' ? stored.name.trim() : ''
  if (name === '' || name.length > 40) return null
  return { id: stored.id, name }
}

function routineToStored(routine) {
  return {
    id: routine.id,
    name: routine.name,
    exercises: routine.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sets: exercise.sets.map((set) => ({ reps: set.reps ?? null, weightKg: set.weightKg ?? null })),
    })),
  }
}

function routineFromStored(stored) {
  if (!stored || typeof stored.id !== 'string' || stored.id === '') return null
  const name = typeof stored.name === 'string' ? stored.name.trim() : ''
  if (name === '' || name.length > 40 || !Array.isArray(stored.exercises) || stored.exercises.length === 0) return null
  const exercises = []
  for (const exercise of stored.exercises) {
    if (!exercise || typeof exercise.exerciseId !== 'string' || exercise.exerciseId === '') return null
    if (!Array.isArray(exercise.sets) || exercise.sets.length === 0) return null
    const sets = []
    for (const set of exercise.sets) {
      const planned = optionalTarget(set)
      if (!planned) return null
      sets.push(planned)
    }
    exercises.push({ exerciseId: exercise.exerciseId, sets })
  }
  return { id: stored.id, name, exercises }
}

function sessionToStored(session) {
  return {
    id: session.id,
    name: session.name,
    routineId: session.routineId,
    startedAt: session.startedAt.toISOString(),
    finishedAt: session.finishedAt ? session.finishedAt.toISOString() : null,
    exercises: session.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sets: exercise.sets.map((set) => ({
        reps: set.reps ?? null,
        weightKg: set.weightKg ?? null,
        done: set.done === true,
      })),
    })),
  }
}

function sessionFromStored(stored) {
  if (!stored || typeof stored.id !== 'string' || stored.id === '') return null
  const name = typeof stored.name === 'string' ? stored.name.trim() : ''
  if (name === '' || name.length > 40 || !Array.isArray(stored.exercises)) return null
  const startedAt = new Date(stored.startedAt)
  if (Number.isNaN(startedAt.getTime())) return null
  let finishedAt = null
  if (stored.finishedAt != null) {
    finishedAt = new Date(stored.finishedAt)
    if (Number.isNaN(finishedAt.getTime())) return null
  }
  const routineId = typeof stored.routineId === 'string' && stored.routineId !== '' ? stored.routineId : null
  const exercises = []
  for (const exercise of stored.exercises) {
    if (!exercise || typeof exercise.exerciseId !== 'string' || exercise.exerciseId === '') return null
    if (!Array.isArray(exercise.sets)) return null
    const sets = []
    for (const set of exercise.sets) {
      const logged = loggedSet(set)
      if (!logged) return null
      sets.push(logged)
    }
    exercises.push({ exerciseId: exercise.exerciseId, sets })
  }
  return { id: stored.id, name, routineId, startedAt, finishedAt, exercises }
}

function optionalTarget(set) {
  if (!set || typeof set !== 'object') return null
  const reps = optionalCount(set.reps)
  const weightKg = optionalWeight(set.weightKg)
  if (reps === undefined || weightKg === undefined) return null
  return { reps, weightKg }
}

function loggedSet(set) {
  const planned = optionalTarget(set)
  if (!planned || typeof set.done !== 'boolean') return null
  return { ...planned, done: set.done }
}

function optionalCount(value) {
  if (value == null) return null
  if (!Number.isInteger(value) || value <= 0) return undefined
  return value
}

function optionalWeight(value) {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return value
}

export function dayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function workoutsOnDay(workouts, day) {
  const key = dayKey(day)
  return workouts
    .filter((workout) => dayKey(workout.startedAt) === key)
    .sort(compareWorkouts)
}

export function groupedByDay(workouts) {
  const groups = new Map()
  for (const workout of workouts) {
    const key = dayKey(workout.startedAt)
    const list = groups.get(key)
    if (list) list.push(workout)
    else groups.set(key, [workout])
  }

  return [...groups.entries()]
    .sort(([left], [right]) => (left < right ? 1 : left > right ? -1 : 0))
    .map(([key, items]) => ({
      key,
      day: startOfDay(items[0].startedAt),
      workouts: items.slice().sort(compareWorkouts),
    }))
}

export function dayHeading(day, now) {
  if (dayKey(day) === dayKey(now)) return 'Today'
  if (dayKey(day) === dayKey(addDays(now, -1))) return 'Yesterday'
  return longDate(day)
}

export function longDate(date) {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function timeLabel(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function durationLabel(minutes) {
  if (!Number.isInteger(minutes) || minutes <= 0) return '0 minutes'
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  const parts = []
  if (hours > 0) parts.push(hours === 1 ? '1 hour' : `${hours} hours`)
  if (remainder > 0) parts.push(remainder === 1 ? '1 minute' : `${remainder} minutes`)
  return parts.join(' ')
}

export function distanceFieldText(kilometres) {
  if (!Number.isFinite(kilometres)) return '0'
  const scaled = Math.round(Math.abs(kilometres) * 100)
  if (!Number.isSafeInteger(scaled)) return '0'
  const whole = Math.floor(scaled / 100)
  const fraction = scaled % 100
  let digits
  if (fraction === 0) digits = String(whole)
  else if (fraction % 10 === 0) digits = `${whole}.${fraction / 10}`
  else digits = `${whole}.${String(fraction).padStart(2, '0')}`
  return kilometres < 0 ? `-${digits}` : digits
}

export function distanceLabel(kilometres) {
  return `${distanceFieldText(kilometres)} km`
}

export function workoutSummary(workout) {
  const parts = [timeLabel(workout.startedAt), durationLabel(workout.durationMinutes)]
  if (workout.distanceKilometres != null) parts.push(distanceLabel(workout.distanceKilometres))
  return parts.join(' · ')
}

export function formatDateTimeLocal(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}T${hour}:${minute}`
}

export function parseDateTimeLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value ?? ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const date = new Date(year, month - 1, day, hour, minute, 0, 0)
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
  ) {
    return null
  }
  return date
}

function parseDuration(text) {
  const trimmed = String(text).trim()
  if (trimmed === '') return { ok: false, error: 'durationNotPositive' }
  if (trimmed.startsWith('-') && /^-\d+$/.test(trimmed)) {
    return { ok: false, error: 'durationNotPositive' }
  }
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: 'durationNotAWholeNumber' }
  const value = Number(trimmed)
  if (!Number.isSafeInteger(value)) return { ok: false, error: 'durationNotAWholeNumber' }
  if (value <= 0) return { ok: false, error: 'durationNotPositive' }
  return { ok: true, value }
}

function parseDistance(text) {
  const trimmed = String(text).trim()
  if (trimmed === '') return { ok: true, value: null }
  let normalised = trimmed.replaceAll(',', '.')
  if (normalised.endsWith('.')) normalised = normalised.slice(0, -1)
  if (!isDecimalNumber(normalised)) return { ok: false, error: 'distanceNotANumber' }
  const value = Number(normalised)
  if (!Number.isFinite(value)) return { ok: false, error: 'distanceNotANumber' }
  if (!(value > 0)) return { ok: false, error: 'distanceNotPositive' }
  return { ok: true, value }
}

function isDecimalNumber(text) {
  let body = text
  if (body.startsWith('-')) body = body.slice(1)
  if (body === '') return false
  const parts = body.split('.')
  if (parts.length > 2) return false
  const whole = parts[0]
  if (parts.length === 1) return whole !== '' && isDigits(whole)
  const fraction = parts[1]
  const fractionIsDigits = fraction !== '' && isDigits(fraction)
  if (whole === '') return fractionIsDigits
  return isDigits(whole) && fractionIsDigits
}

function isDigits(value) {
  return [...value].every((character) => character >= '0' && character <= '9')
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function compareWorkouts(left, right) {
  const delta = left.startedAt.getTime() - right.startedAt.getTime()
  if (delta !== 0) return delta
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}
