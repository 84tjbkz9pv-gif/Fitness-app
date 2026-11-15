import { calorieEstimate } from './food.js'
import { addDays, isDateKey, mondayOf, weekDays, weekdayIndex } from './plan.js'

export const REST_CUT = 150
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function daysBetween(fromKey, toKey) {
  const [fromYear, fromMonth, fromDay] = fromKey.split('-').map(Number)
  const [toYear, toMonth, toDay] = toKey.split('-').map(Number)
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const to = Date.UTC(toYear, toMonth - 1, toDay)
  return Math.round((to - from) / 86400000)
}

export function weeksUntil(todayKey, goalKey) {
  const days = daysBetween(todayKey, goalKey)
  if (days <= 0) return 0
  return days / 7
}

export function weeklyRate(currentKg, goalKg, weeks) {
  if (!(weeks > 0)) return null
  return Math.round(((currentKg - goalKg) / weeks) * 100) / 100
}

export function formatRate(rate) {
  const rounded = Math.round(Math.abs(rate) * 100) / 100
  return String(rounded)
}

export function goalCountdown(todayKey, goalKey, rate) {
  const days = daysBetween(todayKey, goalKey)
  let time = 'Goal day'
  if (days > 0 && days < 7) time = days === 1 ? '1 day to goal' : `${days} days to goal`
  if (days >= 7) {
    const weeks = Math.round(days / 7)
    time = weeks === 1 ? '1 week to goal' : `${weeks} weeks to goal`
  }
  return `${time} · ${formatRate(rate)} kg/week`
}

export function planPreview({ today, goalDate, currentKg, goalKg, profile }) {
  if (!isDateKey(goalDate) || daysBetween(today, goalDate) <= 0) {
    return { ok: false, error: 'Choose a goal date after today.' }
  }
  if (!(currentKg > 0) || !(goalKg > 0)) return { ok: false, error: 'Enter both weights.' }
  const weeks = weeksUntil(today, goalDate)
  const rate = weeklyRate(currentKg, goalKg, weeks)
  const estimate = profile ? calorieEstimate({
    sex: profile.sex,
    weightKg: currentKg,
    heightCm: profile.heightCm,
    age: profile.age,
    activity: profile.activity,
    kgPerWeek: -rate,
  }) : null
  const notes = []
  if (Math.abs(rate) > 1) notes.push('This is above 1 kg a week.')
  if (estimate && estimate.target < 1200) notes.push('This is below 1,200 kcal a day.')
  return {
    ok: true,
    weeks,
    rate,
    maintenance: estimate?.maintenance ?? null,
    target: estimate?.target ?? null,
    notes,
  }
}

export function trainingPlanFromStored(stored) {
  if (stored == null) return null
  if (!stored || typeof stored !== 'object') return undefined
  if (!isDateKey(stored.goalDate)) return undefined
  if (typeof stored.currentWeightKg !== 'number' || typeof stored.goalWeightKg !== 'number') return undefined
  if (typeof stored.rateKgPerWeek !== 'number' || !Number.isFinite(stored.rateKgPerWeek)) return undefined
  if (!Number.isInteger(stored.daysPerWeek) || stored.daysPerWeek < 2 || stored.daysPerWeek > 6) return undefined
  if (!Array.isArray(stored.weekdays) || stored.weekdays.length !== stored.daysPerWeek) return undefined
  if (stored.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return undefined
  if (stored.experience !== 'beginner' && stored.experience !== 'intermediate') return undefined
  if (!Array.isArray(stored.routineIds) || stored.routineIds.length === 0) return undefined
  if (stored.baseKcal != null && (!Number.isInteger(stored.baseKcal) || stored.baseKcal < 1)) return undefined
  const lift = optionalLift(stored.lift)
  const run = optionalRun(stored.run)
  if (lift === undefined || run === undefined) return undefined
  return {
    goalDate: stored.goalDate,
    currentWeightKg: stored.currentWeightKg,
    goalWeightKg: stored.goalWeightKg,
    rateKgPerWeek: stored.rateKgPerWeek,
    daysPerWeek: stored.daysPerWeek,
    weekdays: stored.weekdays.slice(),
    experience: stored.experience,
    routineIds: stored.routineIds.slice(),
    baseKcal: stored.baseKcal ?? null,
    lift,
    run,
  }
}

export function generatePlanEntries({ today, goalDate, weekdays, routineIds, newId }) {
  const entries = []
  let index = 0
  for (let date = today; date <= goalDate; date = addDays(date, 1)) {
    if (!weekdays.includes(weekdayIndex(date))) continue
    entries.push({
      id: newId(),
      date,
      routineId: routineIds[index % routineIds.length],
      source: 'plan',
    })
    index += 1
  }
  return entries
}

export function mergeGenerated(existing, generated) {
  const kept = existing.filter((plan) => plan.source !== 'plan')
  const taken = new Set(kept.map((plan) => plan.date))
  return kept.concat(generated.filter((plan) => !taken.has(plan.date)))
}

export function routineVolume(routine, lastWeight) {
  let weighted = 0
  let working = 0
  let usedWeight = false
  routine.exercises.forEach((exercise) => {
    exercise.sets.forEach((set, index) => {
      if (set.warmUp) return
      working += 1
      const weight = lastWeight(exercise.exerciseId, index) ?? set.weightKg
      const reps = set.reps ?? 0
      if (weight > 0 && reps > 0) {
        weighted += weight * reps
        usedWeight = true
      }
    })
  })
  if (working === 0) return 0
  return usedWeight ? weighted : working
}

export function targetsByDate({ base, start, end, trainingDates, volumeFor }) {
  const targets = new Map()
  if (base == null || !isDateKey(start) || !isDateKey(end) || end < start) return targets
  for (let monday = mondayOf(start); monday <= end; monday = addDays(monday, 7)) {
    const days = weekDays(monday).filter((date) => date >= start && date <= end)
    const rows = days.map((date) => ({
      date,
      training: trainingDates.has(date),
      volume: trainingDates.has(date) ? volumeFor(date) : 0,
    }))
    const balanced = balanceDays(base, rows)
    for (const [date, kcal] of balanced) targets.set(date, kcal)
  }
  return targets
}

export function bodyRegion(name) {
  return /squat|deadlift|lunge|leg|glute|calf|hip|bridge|split/i.test(name) ? 'lower' : 'upper'
}

export function suggestExerciseWeights({ name, targets, lastSets }) {
  const working = []
  targets.forEach((set, index) => {
    if (!set.warmUp) working.push({ set, index })
  })
  const hitAll = working.length > 0 && working.every(({ set, index }) => {
    const last = lastSets?.[index]
    return last && last.reps >= (set.reps ?? 0) && last.weightKg > 0
  })
  const step = bodyRegion(name) === 'lower' ? 2.5 : 1.25
  return working.map(({ set, index }) => {
    const lastWeight = lastSets?.[index]?.weightKg
    const base = lastWeight > 0 ? lastWeight : set.weightKg
    if (!(base > 0)) return { index, weightKg: null, bumped: false }
    return {
      index,
      weightKg: hitAll ? Math.round((base + step) * 4) / 4 : base,
      bumped: Boolean(hitAll && lastWeight > 0),
    }
  })
}

export function liftProgress(lift, sessions, nameFor) {
  if (!lift) return null
  const wanted = lift.name.trim().toLocaleLowerCase('en-GB')
  let best = null
  for (const session of sessions) {
    if (!session.finishedAt) continue
    for (const exercise of session.exercises) {
      if (nameFor(exercise.exerciseId).trim().toLocaleLowerCase('en-GB') !== wanted) continue
      for (const set of exercise.sets) {
        if (set.warmUp || !(set.weightKg > 0)) continue
        if (best == null || set.weightKg > best) best = set.weightKg
      }
    }
  }
  return { name: lift.name, best, targetKg: lift.targetKg }
}

export function runProgress(run, workouts) {
  if (!run) return null
  let best = null
  for (const workout of workouts) {
    if (workout.type !== 'run' || !(workout.distanceKilometres >= run.distanceKm)) continue
    if (best == null || workout.durationMinutes < best) best = workout.durationMinutes
  }
  return { distanceKm: run.distanceKm, best, targetMinutes: run.targetMinutes }
}

export function weekdayName(index) {
  return WEEKDAYS[index]
}

function balanceDays(base, rows) {
  const rest = rows.filter((row) => !row.training)
  const train = rows.filter((row) => row.training)
  const raw = new Map()
  if (rest.length === 0 || train.length === 0) {
    for (const row of rows) raw.set(row.date, base)
  } else {
    const pool = REST_CUT * rest.length
    const volumes = train.map((row) => (row.volume > 0 ? row.volume : 0))
    const blank = volumes.every((volume) => volume === 0)
    const weights = blank ? train.map(() => 1) : volumes
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
    for (const row of rest) raw.set(row.date, base - REST_CUT)
    train.forEach((row, index) => {
      raw.set(row.date, base + pool * weights[index] / weightSum)
    })
  }
  const rounded = new Map()
  let used = 0
  rows.forEach((row, index) => {
    const kcal = index === rows.length - 1
      ? base * rows.length - used
      : Math.round(raw.get(row.date) / 10) * 10
    rounded.set(row.date, kcal)
    used += kcal
  })
  return rounded
}

function optionalLift(value) {
  if (value == null) return null
  if (!value || typeof value.name !== 'string' || typeof value.targetKg !== 'number') return undefined
  const name = value.name.trim()
  if (name === '' || !(value.targetKg > 0)) return undefined
  return { name, targetKg: value.targetKg }
}

function optionalRun(value) {
  if (value == null) return null
  if (!value || typeof value.distanceKm !== 'number' || !Number.isInteger(value.targetMinutes)) return undefined
  if (!(value.distanceKm > 0) || value.targetMinutes <= 0) return undefined
  return { distanceKm: value.distanceKm, targetMinutes: value.targetMinutes }
}
