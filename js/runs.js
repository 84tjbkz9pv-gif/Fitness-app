import { addDays, isDateKey } from './plan.js'

export const RUN_TYPES = [
  { id: 'easy', title: 'Easy' },
  { id: 'tempo', title: 'Tempo' },
  { id: 'intervals', title: 'Intervals' },
  { id: 'long', title: 'Long' },
]

export function parsePace(text) {
  const trimmed = String(text ?? '').trim()
  const clock = trimmed.match(/^(\d+):([0-5]\d)$/)
  const minutesPerKm = clock
    ? Number(clock[1]) + Number(clock[2]) / 60
    : Number(trimmed.replace(',', '.'))
  if (!(minutesPerKm > 0) || minutesPerKm > 30) return { ok: false }
  return { ok: true, minutesPerKm }
}

export function formatPace(minutesPerKm) {
  if (!(minutesPerKm > 0)) return ''
  const total = Math.round(minutesPerKm * 60)
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds} /km`
}

export function paceMinPerKm(minutes, distanceKm) {
  if (!(minutes > 0) || !(distanceKm > 0)) return null
  return minutes / distanceKm
}

export function formatKm(value) {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 100) / 100
  return String(rounded)
}

export function runTitle(run) {
  const title = RUN_TYPES.find((item) => item.id === run.type)?.title ?? 'Run'
  if (run.type === 'intervals' && run.intervals) {
    return `${title} · ${run.intervals.reps} × ${formatKm(run.intervals.distanceKm)} km · ${formatPace(run.targetPaceMinPerKm)} · ${run.intervals.restSeconds} s rest`
  }
  return `${title} · ${formatKm(run.targetDistanceKm)} km · ${formatPace(run.targetPaceMinPerKm)}`
}

export function actualLine(run) {
  if (!(run.actualDistanceKm > 0) || !(run.actualMinutes > 0)) return 'Not logged'
  const pace = paceMinPerKm(run.actualMinutes, run.actualDistanceKm)
  return `Actual ${formatKm(run.actualDistanceKm)} km · ${run.actualMinutes} min · ${formatPace(pace)}`
}

export function dayTaken(plans, runs, date, ignoreId = null) {
  if ((plans ?? []).some((plan) => plan.date === date)) return true
  return (runs ?? []).some((run) => run.date === date && run.id !== ignoreId)
}

export function dropRun(runs, plans, id, from, to) {
  if (!isDateKey(to) || to === from) return { action: 'cancel' }
  if (dayTaken(plans, runs, to, id)) return { action: 'blocked' }
  return { action: 'move' }
}

export function moveRun(runs, id, date) {
  if (!isDateKey(date)) return { ok: false }
  const current = runs.find((run) => run.id === id)
  if (!current) return { ok: false }
  if (current.date === date) return { ok: true, runs }
  if (runs.some((run) => run.id !== id && run.date === date)) return { ok: false, error: 'taken' }
  return { ok: true, runs: runs.map((run) => (run.id === id ? { ...run, date } : run)) }
}

export function parseRun(input) {
  if (!isDateKey(input.date)) return { ok: false, error: 'Choose a day.' }
  if (!RUN_TYPES.some((item) => item.id === input.type)) return { ok: false, error: 'Choose a run type.' }
  const pace = parsePace(input.paceText)
  if (!pace.ok) return { ok: false, error: 'Enter a target pace, such as 6:00.' }
  let targetDistanceKm = null
  let intervals = null
  if (input.type === 'intervals') {
    const reps = Number(String(input.repsText ?? '').trim())
    const distance = readKm(input.repDistanceText)
    const rest = Number(String(input.restText ?? '').trim())
    if (!Number.isInteger(reps) || reps < 1 || reps > 40) return { ok: false, error: 'Enter the number of reps.' }
    if (!distance.ok) return { ok: false, error: 'Enter the distance of each rep in kilometres.' }
    if (!Number.isInteger(rest) || rest < 0 || rest > 600) return { ok: false, error: 'Enter the rest in seconds.' }
    intervals = { reps, distanceKm: distance.km, restSeconds: rest }
  } else {
    const distance = readKm(input.distanceText)
    if (!distance.ok) return { ok: false, error: 'Enter a target distance in kilometres.' }
    targetDistanceKm = distance.km
  }
  const actual = readActual(input.actualDistanceText, input.actualMinutesText)
  if (!actual.ok) return actual
  const notes = String(input.notes ?? '').trim()
  if (notes.length > 200) return { ok: false, error: 'Notes are too long.' }
  return {
    ok: true,
    value: {
      type: input.type,
      targetDistanceKm,
      targetPaceMinPerKm: pace.minutesPerKm,
      intervals,
      actualDistanceKm: actual.distanceKm,
      actualMinutes: actual.minutes,
      notes,
    },
  }
}

export function runFromStored(stored) {
  if (!stored || typeof stored.id !== 'string' || stored.id === '') return null
  if (!isDateKey(stored.date)) return null
  if (!RUN_TYPES.some((item) => item.id === stored.type)) return null
  if (typeof stored.targetPaceMinPerKm !== 'number' || !(stored.targetPaceMinPerKm > 0)) return null
  const intervals = stored.type === 'intervals' ? readIntervals(stored.intervals) : null
  if (stored.type === 'intervals' && !intervals) return null
  if (stored.type !== 'intervals' && (typeof stored.targetDistanceKm !== 'number' || !(stored.targetDistanceKm > 0))) return null
  if (!optionalActual(stored.actualDistanceKm) || !optionalMinutes(stored.actualMinutes)) return null
  if (typeof stored.notes !== 'string') return null
  return {
    id: stored.id,
    date: stored.date,
    type: stored.type,
    targetDistanceKm: stored.type === 'intervals' ? null : stored.targetDistanceKm,
    targetPaceMinPerKm: stored.targetPaceMinPerKm,
    intervals: stored.type === 'intervals' ? intervals : null,
    actualDistanceKm: stored.actualDistanceKm ?? null,
    actualMinutes: stored.actualMinutes ?? null,
    notes: stored.notes,
  }
}

export function runLogged(run) {
  return run.actualMinutes > 0 && run.actualDistanceKm > 0
}

export function sessionCount(runs, monday, today) {
  const end = addDays(monday, 6)
  const planned = (runs ?? []).filter((run) => run.date >= monday && run.date <= end && run.date <= today)
  return { planned: planned.length, done: planned.filter(runLogged).length }
}

function readKm(text) {
  const value = String(text ?? '').trim()
  if (value === '') return { ok: false }
  const km = Number(value.replace(',', '.'))
  if (!(km > 0) || km > 200) return { ok: false }
  return { ok: true, km: Math.round(km * 100) / 100 }
}

function readActual(distanceText, minutesText) {
  const distanceBlank = String(distanceText ?? '').trim() === ''
  const minutesBlank = String(minutesText ?? '').trim() === ''
  if (distanceBlank && minutesBlank) return { ok: true, distanceKm: null, minutes: null }
  if (distanceBlank || minutesBlank) return { ok: false, error: 'Enter both the distance and the time, or leave both blank.' }
  const distance = readKm(distanceText)
  const minutes = Number(String(minutesText).trim())
  if (!distance.ok || !Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
    return { ok: false, error: 'Enter the actual distance and a whole number of minutes.' }
  }
  return { ok: true, distanceKm: distance.km, minutes }
}

function readIntervals(value) {
  if (!value || !Number.isInteger(value.reps) || value.reps < 1) return null
  if (typeof value.distanceKm !== 'number' || !(value.distanceKm > 0)) return null
  if (!Number.isInteger(value.restSeconds) || value.restSeconds < 0) return null
  return { reps: value.reps, distanceKm: value.distanceKm, restSeconds: value.restSeconds }
}

function optionalActual(value) {
  return value == null || (typeof value === 'number' && value > 0)
}

function optionalMinutes(value) {
  return value == null || (Number.isInteger(value) && value > 0)
}
