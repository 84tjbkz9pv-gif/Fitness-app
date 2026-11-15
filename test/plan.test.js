import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBackup, parseBackup } from '../js/logic.js'
import {
  addDays,
  calendarMondays,
  dayContent,
  dropAction,
  isDateKey,
  londonKey,
  londonLong,
  mondayOf,
  movePlan,
  removePlan,
  rowAtPoint,
  shouldStartDrag,
  weekDays,
  weekLabel,
  weekdayIndex,
} from '../js/plan.js'

test('a week starts on Monday and Sunday 15 November 2026 is in 9 Nov - 15 Nov', () => {
  assert.equal(weekdayIndex('2026-11-15'), 6)
  assert.equal(weekdayIndex('2026-11-09'), 0)
  assert.equal(mondayOf('2026-11-15'), '2026-11-09')
  assert.deepEqual(weekDays('2026-11-09'), [
    '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
  ])
  assert.equal(weekLabel('2026-11-09'), '9 Nov - 15 Nov')
  assert.equal(londonLong('2026-11-15'), 'Sunday, 15 November 2026')
  assert.equal(addDays('2026-12-30', 5), '2027-01-04')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(isDateKey('2026-02-31'), false)
})

test('London civil dates ignore the machine timezone', () => {
  assert.equal(londonKey(new Date('2026-11-15T23:30:00.000Z')), '2026-11-15')
  assert.equal(londonKey(new Date('2026-07-15T23:30:00.000Z')), '2026-07-16')
  assert.equal(londonKey(new Date('2026-01-01T00:30:00.000Z')), '2026-01-01')
})

test('moving a plan changes its day and leaves the original list alone', () => {
  const plans = [
    { id: 'plan-1', date: '2026-11-15', routineId: 'legs' },
    { id: 'plan-2', date: '2026-11-16', routineId: 'legs' },
  ]
  const moved = movePlan(plans, 'plan-1', '2026-11-18')
  assert.equal(moved.ok, true)
  assert.equal(plans[0].date, '2026-11-15')
  assert.equal(moved.plans[0].date, '2026-11-18')
  assert.notEqual(moved.plans[0], plans[0])
  assert.equal(moved.plans[1], plans[1])

  const sameDay = movePlan(plans, 'plan-1', '2026-11-16')
  assert.equal(sameDay.ok, false)
  assert.equal(sameDay.error, 'alreadyPlanned')
  assert.equal(plans[0].date, '2026-11-15')

  assert.deepEqual(removePlan(plans, 'plan-1'), [plans[1]])
  assert.equal(plans.length, 2)
  assert.equal(movePlan(plans, 'missing', '2026-11-18').ok, false)
  assert.equal(movePlan(plans, 'plan-1', '2026-02-31').ok, false)
})

test('a finished session on the planned day counts as done', () => {
  const started = new Date('2026-11-16T18:00:00.000Z')
  const content = dayContent('2026-11-16', {
    plans: [{ id: 'plan-1', date: '2026-11-16', routineId: 'legs' }],
    routines: [{ id: 'legs', name: 'Legs A', exercises: [] }],
    sessions: [{
      id: 'session-1',
      routineId: 'legs',
      startedAt: started,
      finishedAt: new Date('2026-11-16T19:00:00.000Z'),
    }],
    workouts: [],
  })
  assert.equal(content.dayPlans[0].session.id, 'session-1')
  assert.equal(content.extraSessions.length, 0)
})

test('plan entries round trip in a version 3 backup and older backups stay empty', () => {
  const legacy = parseBackup(JSON.stringify({ version: 2, workouts: [], exercises: [], routines: [], sessions: [] }))
  assert.equal(legacy.ok, true)
  assert.deepEqual(legacy.plans, [])
  const version1 = parseBackup(JSON.stringify({
    version: 1,
    exportedAt: '2026-11-15T18:00:00.000Z',
    workouts: [],
  }))
  assert.deepEqual(version1.plans, [])

  const backup = createBackup([], new Date('2026-11-15T12:00:00.000Z'), {
    plans: [
      { id: 'plan-b', date: '2026-11-16', routineId: 'legs' },
      { id: 'plan-a', date: '2026-11-15', routineId: 'legs' },
    ],
  })
  assert.equal(backup.version, 3)
  assert.deepEqual(backup.plans.map((plan) => plan.id), ['plan-a', 'plan-b'])
  const parsed = parseBackup(JSON.stringify(backup))
  assert.deepEqual(parsed.plans, backup.plans)

  const bad = structuredClone(backup)
  bad.plans[0].date = '2026-02-31'
  assert.equal(parseBackup(JSON.stringify(bad)).error, 'backupPlan')

  const mondays = calendarMondays('2026-11-15', ['2026-12-25'])
  assert.equal(mondays.includes('2026-11-09'), true)
  assert.equal(mondays.includes(mondayOf('2026-12-25')), true)
})

test('a drag starts after a short hold and a drop uses the day under the finger', () => {
  assert.equal(shouldStartDrag(399, 0), false)
  assert.equal(shouldStartDrag(400, 10), true)
  assert.equal(shouldStartDrag(500, 11), false)

  const rows = [
    { date: '2026-11-15', left: 0, top: 0, right: 100, bottom: 40 },
    { date: '2026-11-16', left: 0, top: 40, right: 100, bottom: 80 },
  ]
  assert.equal(rowAtPoint(rows, 10, 20), '2026-11-15')
  assert.equal(rowAtPoint(rows, 10, 60), '2026-11-16')
  assert.equal(rowAtPoint(rows, 10, 90), null)
  assert.equal(rowAtPoint(rows, 120, 20), null)

  const plans = [
    { id: 'a', date: '2026-11-15', routineId: 'legs' },
    { id: 'b', date: '2026-11-16', routineId: 'legs' },
  ]
  assert.deepEqual(dropAction(plans, 'a', '2026-11-15', null), { action: 'cancel' })
  assert.deepEqual(dropAction(plans, 'a', '2026-11-15', '2026-11-15'), { action: 'cancel' })
  assert.equal(dropAction(plans, 'a', '2026-11-15', '2026-11-16').action, 'blocked')
  assert.equal(plans[0].date, '2026-11-15')
  const moved = dropAction(plans, 'a', '2026-11-15', '2026-11-18')
  assert.equal(moved.action, 'move')
  assert.equal(moved.plans[0].date, '2026-11-18')
  assert.equal(plans[0].date, '2026-11-15')
  assert.notEqual(moved.plans[0], plans[0])
})
