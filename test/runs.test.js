import assert from 'node:assert/strict'
import { test } from 'node:test'
import { londonKey } from '../js/plan.js'
import { createBackup, parseBackup } from '../js/logic.js'
import {
  actualLine,
  dropRun,
  formatPace,
  moveRun,
  paceMinPerKm,
  parsePace,
  parseRun,
  sessionCount,
} from '../js/runs.js'

test('pace is minutes divided by kilometres', () => {
  assert.equal(formatPace(paceMinPerKm(25, 5)), '5:00 /km')
  assert.equal(formatPace(paceMinPerKm(55, 10)), '5:30 /km')
  assert.equal(parsePace('5:30').minutesPerKm, 5.5)
  assert.equal(parsePace('6,5').minutesPerKm, 6.5)
  assert.equal(parsePace('0:00').ok, false)
  assert.equal(paceMinPerKm(0, 5), null)
  assert.equal(actualLine({ actualDistanceKm: 5.2, actualMinutes: 32 }), 'Actual 5.2 km · 32 min · 6:09 /km')
})

test('a run moves onto a free London day and stops on a taken day', () => {
  const today = londonKey(new Date('2026-11-15T23:30:00.000Z'))
  assert.equal(today, '2026-11-15')
  const moved = moveRun([{ id: 'easy', date: '2026-11-14', type: 'easy' }], 'easy', today)
  assert.equal(moved.ok, true)
  assert.equal(moved.runs[0].date, '2026-11-15')
  assert.equal(dropRun(moved.runs, [{ date: '2026-11-16', routineId: 'legs' }], 'easy', today, '2026-11-16').action, 'blocked')
  assert.equal(dropRun(moved.runs, [], 'easy', today, '2026-11-18').action, 'move')
  assert.equal(dropRun(moved.runs, [], 'easy', today, today).action, 'cancel')
  const parsed = parseRun({
    date: today,
    type: 'intervals',
    paceText: '4:30',
    repsText: '6',
    repDistanceText: '0.4',
    restText: '90',
    actualDistanceText: '',
    actualMinutesText: '',
    notes: '',
  })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.value.intervals.reps, 6)
  assert.equal(parsed.value.intervals.restSeconds, 90)
  assert.equal(parsed.value.targetPaceMinPerKm, 4.5)
})

test('a logged run counts for its week and a version 6 backup keeps it', () => {
  const count = sessionCount([
    { date: '2026-11-15', actualMinutes: 32, actualDistanceKm: 5.2 },
    { date: '2026-11-14', actualMinutes: null, actualDistanceKm: null },
    { date: '2026-11-16', actualMinutes: 40, actualDistanceKm: 8 },
  ], '2026-11-09', '2026-11-15')
  assert.equal(count.planned, 2)
  assert.equal(count.done, 1)
  const backup = createBackup([], new Date('2026-11-15T12:00:00.000Z'), {
    runs: [{
      id: 'easy',
      date: '2026-11-15',
      type: 'easy',
      targetDistanceKm: 5,
      targetPaceMinPerKm: 6,
      intervals: null,
      actualDistanceKm: 5.2,
      actualMinutes: 32,
      notes: 'Park',
    }],
  })
  assert.equal(backup.version, 8)
  const parsed = parseBackup(JSON.stringify(backup))
  assert.equal(parsed.runs[0].notes, 'Park')
  assert.equal(parsed.runs[0].actualMinutes, 32)
  const older = parseBackup(JSON.stringify({ version: 5, workouts: [], exercises: [], routines: [], sessions: [], plans: [] }))
  assert.deepEqual(older.runs, [])
})
