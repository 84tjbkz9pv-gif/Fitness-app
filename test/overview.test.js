import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBackup, parseBackup } from '../js/logic.js'
import { epley1Rm } from '../js/gym.js'
import { bestEstimates, weekReport, weightChange, withinTarget } from '../js/overview.js'

test('Epley estimate and the best set per exercise', () => {
  assert.equal(epley1Rm(80, 5), 80 * (1 + 5 / 30))
  assert.equal(epley1Rm(0, 5), null)
  assert.equal(epley1Rm(80, 0), null)
  const estimates = bestEstimates([{
    finishedAt: new Date('2026-11-16T12:00:00.000Z'),
    exercises: [{
      exerciseId: 'squat',
      sets: [
        { weightKg: 60, reps: 5, done: true, warmUp: true },
        { weightKg: 80, reps: 5, done: true },
        { weightKg: 70, reps: 8, done: true },
        { weightKg: 100, reps: 3, done: false },
      ],
    }],
  }], (id) => (id === 'squat' ? 'Squat' : id))
  assert.equal(estimates.length, 1)
  assert.equal(estimates[0].name, 'Squat')
  assert.equal(estimates[0].weightKg, 80)
  assert.equal(estimates[0].reps, 5)
  assert.equal(estimates[0].estimate, 80 * (1 + 5 / 30))
})

test('weight change is the latest entry minus the first', () => {
  assert.equal(weightChange([]), null)
  const change = weightChange([
    { id: 'b', date: '2026-11-15', kg: 60.2 },
    { id: 'a', date: '2026-11-01', kg: 62.4 },
  ])
  assert.equal(change.changeKg, -2.2)
  assert.equal(change.first.date, '2026-11-01')
  assert.equal(change.latest.kg, 60.2)
})

test('a week counts food days against the day target and finished planned sessions', () => {
  assert.equal(withinTarget(1800, 2000, true), true)
  assert.equal(withinTarget(2100, 2000, true), false)
  assert.equal(withinTarget(2100, 2000, false), true)
  assert.equal(withinTarget(2300, 2000, false), false)
  const report = weekReport({
    monday: '2026-11-09',
    today: '2026-11-15',
    foods: [
      { date: '2026-11-09', kcal: 1800 },
      { date: '2026-11-10', kcal: 2500 },
    ],
    plans: [
      { date: '2026-11-09', routineId: 'legs' },
      { date: '2026-11-11', routineId: 'push' },
      { date: '2026-11-16', routineId: 'legs' },
    ],
    sessions: [{
      routineId: 'legs',
      finishedAt: new Date('2026-11-09T18:00:00.000Z'),
      startedAt: new Date('2026-11-09T17:00:00.000Z'),
    }],
    targetFor: () => 2000,
    losing: true,
  })
  assert.equal(report.onTarget, 1)
  assert.equal(report.logged, 2)
  assert.equal(report.planned, 2)
  assert.equal(report.done, 1)
})

test('weight entries round trip in a version 6 backup and older backups have none', () => {
  const backup = createBackup([], new Date('2026-11-15T12:00:00.000Z'), {
    weights: [{ id: 'w1', date: '2026-11-15', kg: 60.5 }],
  })
  assert.equal(backup.version, 7)
  const parsed = parseBackup(JSON.stringify(backup))
  assert.equal(parsed.weights[0].kg, 60.5)
  const older = parseBackup(JSON.stringify({ version: 5, workouts: [], exercises: [], routines: [], sessions: [], plans: [] }))
  assert.deepEqual(older.weights, [])
})
