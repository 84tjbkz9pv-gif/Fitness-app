import assert from 'node:assert/strict'
import { test } from 'node:test'
import { londonKey } from '../js/plan.js'
import {
  daysBetween,
  generatePlanEntries,
  goalCountdown,
  mergeGenerated,
  planPreview,
  suggestExerciseWeights,
  targetsByDate,
  weeklyRate,
  weeksUntil,
} from '../js/training-plan.js'

const profile = { sex: 'female', heightCm: 165, age: 30, activity: 'moderate' }

test('weeks and rate use London civil dates', () => {
  const summer = londonKey(new Date('2026-07-15T23:30:00.000Z'))
  assert.equal(summer, '2026-07-16')
  assert.equal(daysBetween(summer, '2026-09-17'), 63)
  assert.equal(weeksUntil(summer, '2026-09-17'), 9)
  assert.equal(weeklyRate(60, 56.4, 9), 0.4)

  const winter = londonKey(new Date('2026-11-15T23:30:00.000Z'))
  assert.equal(winter, '2026-11-15')
  assert.equal(weeksUntil(winter, '2027-01-17'), 9)
  assert.equal(goalCountdown(winter, '2027-01-17', 0.4), '9 weeks to goal · 0.4 kg/week')

  const preview = planPreview({
    today: winter,
    goalDate: '2027-01-17',
    currentKg: 60,
    goalKg: 56.4,
    profile,
  })
  assert.equal(preview.ok, true)
  assert.equal(preview.rate, 0.4)
  assert.equal(preview.notes.length, 0)

  const fast = planPreview({
    today: winter,
    goalDate: '2026-11-29',
    currentKg: 60,
    goalKg: 56,
    profile,
  })
  assert.equal(fast.notes.includes('This is above 1 kg a week.'), true)
})

test('a generated plan fills chosen days through the goal and keeps hand-made days', () => {
  let next = 1
  const generated = generatePlanEntries({
    today: '2026-11-15',
    goalDate: '2026-11-20',
    weekdays: [0, 2, 4],
    routineIds: ['legs', 'push'],
    newId: () => `gen-${next++}`,
  })
  assert.deepEqual(generated.map((plan) => [plan.date, plan.routineId]), [
    ['2026-11-16', 'legs'],
    ['2026-11-18', 'push'],
    ['2026-11-20', 'legs'],
  ])
  const existing = [
    { id: 'hand', date: '2026-11-16', routineId: 'yoga', source: null },
    { id: 'old', date: '2026-11-18', routineId: 'old', source: 'plan' },
  ]
  const merged = mergeGenerated(existing, generated)
  assert.equal(merged.some((plan) => plan.id === 'old'), false)
  assert.equal(merged.find((plan) => plan.date === '2026-11-16').routineId, 'yoga')
  assert.equal(merged.find((plan) => plan.date === '2026-11-18').routineId, 'push')
  assert.equal(existing[1].routineId, 'old')
})

test('daily kcal stays lower on rest days and averages the base across the week', () => {
  const trainingDates = new Set(['2026-11-16', '2026-11-18', '2026-11-20'])
  const volumes = { '2026-11-16': 100, '2026-11-18': 50, '2026-11-20': 50 }
  const targets = targetsByDate({
    base: 2000,
    start: '2026-11-16',
    end: '2026-11-22',
    trainingDates,
    volumeFor: (date) => volumes[date] ?? 0,
  })
  const values = [...targets.values()]
  assert.equal(values.reduce((sum, kcal) => sum + kcal, 0), 2000 * values.length)
  assert.equal(targets.get('2026-11-16') > targets.get('2026-11-18'), true)
  assert.equal(targets.get('2026-11-17') < 2000, true)
  assert.equal(targets.get('2026-11-16') > 2000, true)
})

test('working weight steps up only when every working set hit the target', () => {
  const targets = [
    { warmUp: true, reps: 12, weightKg: 20 },
    { reps: 10, weightKg: 40 },
    { reps: 8, weightKg: 40 },
  ]
  const hit = [
    { reps: 12, weightKg: 20 },
    { reps: 10, weightKg: 40 },
    { reps: 8, weightKg: 40 },
  ]
  const squat = suggestExerciseWeights({ name: 'Squat (Barbell)', targets, lastSets: hit })
  assert.equal(squat.find((item) => item.index === 1).weightKg, 42.5)
  assert.equal(squat.every((item) => item.bumped), true)
  const bench = suggestExerciseWeights({ name: 'Bench press', targets, lastSets: hit })
  assert.equal(bench.find((item) => item.index === 1).weightKg, 41.25)
  const missed = suggestExerciseWeights({
    name: 'Squat',
    targets,
    lastSets: [hit[0], { reps: 8, weightKg: 40 }, hit[2]],
  })
  assert.equal(missed.find((item) => item.index === 1).weightKg, 40)
  assert.equal(missed.some((item) => item.bumped), false)
})
