import { epley1Rm } from './gym.js'
import { dayKcal } from './food.js'
import { addDays, isDateKey, londonKey, mondayOf, weekDays } from './plan.js'

export function parseWeight(date, text) {
  if (!isDateKey(date)) return { ok: false, error: 'Choose a date.' }
  const kg = Number(String(text).trim().replace(',', '.'))
  if (!(kg > 0) || kg > 500) return { ok: false, error: 'Enter a weight in kilograms.' }
  return { ok: true, kg: Math.round(kg * 10) / 10 }
}

export function weightFromStored(stored) {
  if (!stored || typeof stored.id !== 'string' || stored.id === '') return null
  if (!isDateKey(stored.date)) return null
  if (typeof stored.kg !== 'number' || !(stored.kg > 0) || stored.kg > 500) return null
  return { id: stored.id, date: stored.date, kg: stored.kg }
}

export function sortedWeights(weights) {
  return (weights ?? []).slice().sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
}

export function weightChange(weights) {
  const sorted = sortedWeights(weights)
  if (sorted.length === 0) return null
  const first = sorted[0]
  const latest = sorted[sorted.length - 1]
  return {
    first,
    latest,
    changeKg: Math.round((latest.kg - first.kg) * 10) / 10,
  }
}

export function isLosing(plan, profile) {
  if (plan && typeof plan.rateKgPerWeek === 'number') return plan.rateKgPerWeek > 0
  return typeof profile?.goal === 'string' && profile.goal.startsWith('lose')
}

export function withinTarget(eaten, target, losing) {
  if (!(target > 0) || !(eaten >= 0)) return false
  if (losing) return eaten <= target
  return Math.abs(eaten - target) / target <= 0.1
}

export function weekReport({ monday, today, foods, plans, sessions, runs, targetFor, losing }) {
  const days = weekDays(monday).filter((date) => date <= today)
  let logged = 0
  let onTarget = 0
  for (const date of days) {
    if (!foods.some((entry) => entry.date === date)) continue
    const target = targetFor(date)
    if (!(target > 0)) continue
    logged += 1
    if (withinTarget(dayKcal(foods, date), target, losing)) onTarget += 1
  }
  const end = addDays(monday, 6)
  const planned = (plans ?? []).filter((plan) => plan.date >= monday && plan.date <= end && plan.date <= today)
  const done = planned.filter((plan) => (sessions ?? []).some((session) => (
    session.finishedAt
    && session.routineId === plan.routineId
    && londonKey(session.startedAt) === plan.date
  )))
  const plannedRuns = (runs ?? []).filter((run) => run.date >= monday && run.date <= end && run.date <= today)
  const doneRuns = plannedRuns.filter((run) => run.actualMinutes > 0 && run.actualDistanceKm > 0)
  return {
    monday,
    onTarget,
    logged,
    planned: planned.length + plannedRuns.length,
    done: done.length + doneRuns.length,
  }
}

export function recentWeekReports(input) {
  const reports = []
  let monday = mondayOf(input.today)
  for (let index = 0; index < 4; index += 1) {
    reports.push(weekReport({ ...input, monday }))
    monday = addDays(monday, -7)
  }
  return reports
}

export function bestEstimates(sessions, nameFor) {
  const best = new Map()
  for (const session of sessions ?? []) {
    if (!session.finishedAt) continue
    for (const exercise of session.exercises ?? []) {
      for (const set of exercise.sets ?? []) {
        if (!set.done || set.warmUp) continue
        const estimate = epley1Rm(set.weightKg, set.reps)
        if (estimate == null) continue
        const current = best.get(exercise.exerciseId)
        if (current && current.estimate >= estimate) continue
        best.set(exercise.exerciseId, {
          exerciseId: exercise.exerciseId,
          name: nameFor(exercise.exerciseId),
          estimate,
          weightKg: set.weightKg,
          reps: set.reps,
        })
      }
    }
  }
  return [...best.values()].sort((left, right) => left.name.localeCompare(right.name, 'en-GB'))
}
