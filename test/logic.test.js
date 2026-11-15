import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  WORKOUT_TYPES,
  dayHeading,
  distanceFieldText,
  distanceLabel,
  durationLabel,
  formatDateTimeLocal,
  groupedByDay,
  longDate,
  messageFor,
  parseDateTimeLocal,
  validate,
  backupFilename,
  createBackup,
  parseBackup,
  workoutFromStored,
  workoutSummary,
  workoutToStored,
  workoutsOnDay,
} from '../js/logic.js'

const london = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/London'

function at(year, month, day, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

function workout(overrides = {}) {
  return {
    id: overrides.id ?? '00000000-0000-0000-0000-000000000001',
    type: overrides.type ?? 'run',
    startedAt: overrides.startedAt ?? at(2026, 11, 15, 7, 30),
    durationMinutes: overrides.durationMinutes ?? 30,
    distanceKilometres: overrides.distanceKilometres ?? null,
    notes: overrides.notes ?? '',
  }
}

function draft(overrides = {}) {
  return {
    type: overrides.type ?? 'run',
    startedAt: overrides.startedAt ?? at(2026, 11, 15, 7, 30),
    durationText: overrides.durationText ?? '30',
    distanceText: overrides.distanceText ?? '',
    notes: overrides.notes ?? '',
  }
}

function requireValid(value) {
  assert.equal(value.ok, true, value.ok ? '' : value.error)
  return value.value
}

test('workout types stay in picker order', () => {
  assert.deepEqual(
    WORKOUT_TYPES.map((type) => type.title),
    ['Run', 'Walk', 'Cycle', 'Strength', 'Swim', 'Yoga', 'Other'],
  )
})

test('duration must be greater than zero', () => {
  for (const durationText of ['0', '000', '-5', '', '   ']) {
    assert.deepEqual(validate(draft({ durationText })), { ok: false, error: 'durationNotPositive' })
  }
})

test('duration must be a whole number of minutes', () => {
  for (const durationText of ['4.5', '4,5', '45min', '+45']) {
    assert.deepEqual(validate(draft({ durationText })), { ok: false, error: 'durationNotAWholeNumber' })
  }
})

test('duration allows spaces and leading zeros', () => {
  assert.equal(requireValid(validate(draft({ durationText: '  45 ' }))).durationMinutes, 45)
  assert.equal(requireValid(validate(draft({ durationText: '08' }))).durationMinutes, 8)
})

test('blank distance is omitted', () => {
  assert.equal(requireValid(validate(draft({ distanceText: '' }))).distanceKilometres, null)
  assert.equal(requireValid(validate(draft({ distanceText: '   ' }))).distanceKilometres, null)
})

test('distance must be greater than zero when entered', () => {
  for (const distanceText of ['0', '0.0', '-2']) {
    assert.deepEqual(validate(draft({ distanceText })), { ok: false, error: 'distanceNotPositive' })
  }
})

test('distance accepts a dot or a comma', () => {
  assert.equal(requireValid(validate(draft({ distanceText: '8.5' }))).distanceKilometres, 8.5)
  assert.equal(requireValid(validate(draft({ distanceText: '  8,5 ' }))).distanceKilometres, 8.5)
  assert.ok(Math.abs(requireValid(validate(draft({ distanceText: '5,2' }))).distanceKilometres - 5.2) < 0.000001)
  assert.equal(requireValid(validate(draft({ distanceText: '5.' }))).distanceKilometres, 5)
  assert.equal(requireValid(validate(draft({ distanceText: '.5' }))).distanceKilometres, 0.5)
})

test('distance rejects text and extra dots', () => {
  for (const distanceText of ['abc', '1.2.3', '5 km']) {
    assert.deepEqual(validate(draft({ distanceText })), { ok: false, error: 'distanceNotANumber' })
  }
})

test('notes are trimmed and the rest is kept', () => {
  const startedAt = at(2026, 11, 15, 7, 30)
  const value = requireValid(validate(draft({
    type: 'swim',
    startedAt,
    durationText: '25',
    distanceText: '1.5',
    notes: '  lane swimming\ntoday  ',
  })))
  assert.equal(value.type, 'swim')
  assert.equal(value.startedAt, startedAt)
  assert.equal(value.durationMinutes, 25)
  assert.equal(value.distanceKilometres, 1.5)
  assert.equal(value.notes, 'lane swimming\ntoday')
})

test('a missing or impossible start is rejected', () => {
  const missing = draft()
  missing.startedAt = null
  assert.equal(validate(missing).error, 'startMissing')
  assert.equal(parseDateTimeLocal('2026-02-31T10:00'), null)
  assert.equal(parseDateTimeLocal('not-a-date'), null)
})

test('duration error is reported before a distance error', () => {
  assert.equal(validate(draft({ durationText: '0', distanceText: 'abc' })).error, 'durationNotPositive')
  assert.equal(validate(draft({ durationText: 'abc', distanceText: 'abc' })).error, 'durationNotAWholeNumber')
})

test('validation messages use kilometres', () => {
  assert.equal(messageFor('durationNotAWholeNumber'), 'Enter the duration as a whole number of minutes.')
  assert.equal(messageFor('durationNotPositive'), 'Duration must be greater than zero.')
  assert.equal(messageFor('distanceNotANumber'), 'Enter the distance in kilometres, or leave it blank.')
  assert.equal(messageFor('distanceNotPositive'), 'Distance must be greater than zero, or leave it blank.')
})

test('today includes only that civil day', () => {
  const midnight = at(2026, 11, 15, 0, 0)
  const late = at(2026, 11, 15, 23, 59)
  const nextMidnight = at(2026, 11, 16, 0, 0)
  const previous = at(2026, 11, 14, 23, 59)
  const records = [
    workout({ id: 'd', type: 'walk', startedAt: nextMidnight }),
    workout({ id: 'c', type: 'strength', startedAt: previous }),
    workout({ id: 'b', type: 'yoga', startedAt: late }),
    workout({ id: 'a', type: 'run', startedAt: midnight }),
  ]
  assert.deepEqual(workoutsOnDay(records, midnight).map((item) => item.type), ['run', 'yoga'])
  assert.deepEqual(workoutsOnDay([], midnight), [])
})

test('grouping orders days newest first and workouts earliest first', () => {
  const records = [
    workout({ id: 's', type: 'strength', startedAt: at(2026, 11, 16, 18) }),
    workout({ id: 'r', type: 'run', startedAt: at(2026, 11, 15, 7) }),
    workout({ id: 'y', type: 'yoga', startedAt: at(2026, 11, 16, 8) }),
    workout({ id: 'w', type: 'walk', startedAt: at(2026, 11, 14, 21) }),
  ]
  const groups = groupedByDay(records)
  assert.deepEqual(groups.map((group) => group.key), ['2026-11-16', '2026-11-15', '2026-11-14'])
  assert.deepEqual(groups[0].workouts.map((item) => item.type), ['yoga', 'strength'])
  assert.deepEqual(groups[1].workouts.map((item) => item.type), ['run'])
  assert.deepEqual(groups[2].workouts.map((item) => item.type), ['walk'])
  assert.deepEqual(groupedByDay([]), [])
})

test('equal start times are ordered by identity', () => {
  const start = at(2026, 11, 15, 9)
  const later = at(2026, 11, 15, 10)
  const records = [
    workout({ id: '00000000-0000-0000-0000-00000000000b', type: 'yoga', startedAt: start }),
    workout({ id: '00000000-0000-0000-0000-000000000001', type: 'strength', startedAt: later }),
    workout({ id: '00000000-0000-0000-0000-00000000000a', type: 'run', startedAt: start }),
  ]
  assert.deepEqual(workoutsOnDay(records, start).map((item) => item.type), ['run', 'yoga', 'strength'])
})

test('day headings', () => {
  const today = at(2026, 11, 17, 8)
  const lateToday = at(2026, 11, 17, 23, 30)
  const yesterday = at(2026, 11, 16, 21)
  const earlier = at(2026, 11, 15, 8)
  assert.equal(dayHeading(today, today), 'Today')
  assert.equal(dayHeading(lateToday, today), 'Today')
  assert.equal(dayHeading(yesterday, today), 'Yesterday')
  assert.equal(dayHeading(earlier, today), 'Sunday, 15 November 2026')
})

test('yesterday across a month boundary', () => {
  const now = at(2026, 11, 1, 9)
  const yesterday = at(2026, 10, 31, 21)
  assert.equal(dayHeading(yesterday, now), 'Yesterday')
  assert.equal(longDate(yesterday), 'Saturday, 31 October 2026')
})

test('long date uses British order', () => {
  assert.equal(longDate(at(2026, 11, 15, 15)), 'Sunday, 15 November 2026')
  assert.equal(longDate(at(2026, 1, 1, 0)), 'Thursday, 1 January 2026')
})

test('duration labels', () => {
  assert.equal(durationLabel(0), '0 minutes')
  assert.equal(durationLabel(-5), '0 minutes')
  assert.equal(durationLabel(1), '1 minute')
  assert.equal(durationLabel(45), '45 minutes')
  assert.equal(durationLabel(60), '1 hour')
  assert.equal(durationLabel(61), '1 hour 1 minute')
  assert.equal(durationLabel(90), '1 hour 30 minutes')
  assert.equal(durationLabel(120), '2 hours')
  assert.equal(durationLabel(121), '2 hours 1 minute')
})

test('distance field text and summary', () => {
  assert.equal(distanceFieldText(5), '5')
  assert.equal(distanceFieldText(5.2), '5.2')
  assert.equal(distanceFieldText(5.25), '5.25')
  assert.equal(distanceFieldText(8.5), '8.5')
  assert.equal(distanceFieldText(0.5), '0.5')
  assert.equal(distanceFieldText(1000.5), '1000.5')
  assert.equal(distanceLabel(5.2), '5.2 km')

  const run = workout({
    startedAt: at(2026, 11, 15, 7, 5),
    durationMinutes: 45,
    distanceKilometres: 5.2,
    notes: 'park',
  })
  const yoga = workout({ type: 'yoga', startedAt: at(2026, 11, 15, 18), durationMinutes: 40 })
  assert.equal(workoutSummary(run), '07:05 · 45 minutes · 5.2 km')
  assert.equal(workoutSummary(yoga), '18:00 · 40 minutes')
  assert.equal(requireValid(validate(draft({ distanceText: distanceFieldText(1000.5) }))).distanceKilometres, 1000.5)
})

test('stored workouts round trip and reject corrupt rows', () => {
  const original = workout({
    id: 'abc',
    type: 'cycle',
    startedAt: at(2026, 6, 2, 18, 5),
    durationMinutes: 90,
    distanceKilometres: 25.5,
    notes: 'Into the wind',
  })
  const stored = workoutToStored(original)
  const restored = workoutFromStored(stored)
  assert.equal(restored.startedAt.getTime(), original.startedAt.getTime())
  assert.equal(restored.distanceKilometres, 25.5)
  assert.equal(restored.notes, 'Into the wind')
  assert.equal(workoutFromStored({ ...stored, durationMinutes: 0 }), null)
  assert.equal(workoutFromStored({ ...stored, type: 'dance' }), null)
  assert.equal(workoutFromStored({ ...stored, startedAt: 'yesterday' }), null)
})

test('date time local values round trip', () => {
  const date = at(2026, 11, 15, 7, 5)
  assert.equal(formatDateTimeLocal(date), '2026-11-15T07:05')
  assert.equal(parseDateTimeLocal('2026-11-15T07:05').getTime(), date.getTime())
})

test('backup round trip keeps every workout', () => {
  const exportedAt = at(2026, 11, 15, 21, 5)
  const records = [
    workout({
      id: 'later',
      type: 'yoga',
      startedAt: at(2026, 11, 16, 18),
      durationMinutes: 40,
      distanceKilometres: null,
      notes: '',
    }),
    workout({
      id: 'earlier',
      type: 'cycle',
      startedAt: at(2026, 11, 15, 7, 5),
      durationMinutes: 45,
      distanceKilometres: 5.2,
      notes: 'Park loop',
    }),
  ]
  const document = createBackup(records, exportedAt)
  assert.equal(document.version, 8)
  assert.deepEqual(document.plans, [])
  assert.deepEqual(document.exercises, [])
  assert.deepEqual(document.routines, [])
  assert.deepEqual(document.sessions, [])
  assert.equal(document.exportedAt, exportedAt.toISOString())
  assert.deepEqual(document.workouts.map((item) => item.id), ['earlier', 'later'])
  assert.equal(backupFilename(exportedAt), 'fitness-backup-2026-11-15.json')

  const parsed = parseBackup(JSON.stringify(document))
  assert.equal(parsed.ok, true)
  assert.equal(parsed.workouts.length, 2)
  assert.equal(parsed.workouts[0].type, 'cycle')
  assert.equal(parsed.workouts[0].startedAt.getTime(), records[1].startedAt.getTime())
  assert.equal(parsed.workouts[0].durationMinutes, 45)
  assert.ok(Math.abs(parsed.workouts[0].distanceKilometres - 5.2) < 0.000001)
  assert.equal(parsed.workouts[0].notes, 'Park loop')
  assert.equal(parsed.workouts[1].distanceKilometres, null)
  assert.equal(parsed.workouts[1].notes, '')

  const again = createBackup(parsed.workouts, exportedAt)
  assert.deepEqual(again, document)
})

test('backup import rejects a file that is not a backup', () => {
  assert.equal(parseBackup('not json').error, 'backupNotJson')
  assert.equal(parseBackup('[]').error, 'backupNotFitness')
  assert.equal(parseBackup('{"version":1}').error, 'backupNotFitness')
  assert.equal(parseBackup('{"version":9,"workouts":[]}').error, 'backupVersion')
  assert.equal(parseBackup('{"version":8,"workouts":[]}').ok, true)
  assert.equal(parseBackup('{"version":7,"workouts":[]}').ok, true)
  assert.equal(parseBackup('{"version":6,"workouts":[]}').ok, true)
  assert.equal(parseBackup('{"version":5,"workouts":[]}').ok, true)
  assert.equal(parseBackup('{"version":4,"workouts":[]}').ok, true)
  assert.equal(parseBackup('{"version":3,"workouts":[]}').ok, true)
  assert.equal(parseBackup('{"version":2,"workouts":[]}').ok, true)
  assert.equal(messageFor('backupVersion'), 'This backup is from a different version of Fitness.')

  const badWorkout = createBackup([workout({ id: 'ok' })])
  badWorkout.workouts.push({ ...badWorkout.workouts[0], id: 'bad', durationMinutes: 0 })
  assert.equal(parseBackup(JSON.stringify(badWorkout)).error, 'backupWorkout')

  const duplicate = createBackup([workout({ id: 'same' })])
  duplicate.workouts.push({ ...duplicate.workouts[0] })
  assert.equal(parseBackup(JSON.stringify(duplicate)).error, 'backupDuplicate')

  const empty = parseBackup(JSON.stringify(createBackup([])))
  assert.equal(empty.ok, true)
  assert.deepEqual(empty.workouts, [])
})

test('autumn clock change stays on one civil day', { skip: !london }, () => {
  const early = at(2026, 10, 25, 0, 30)
  const repeated = new Date('2026-10-25T01:30:00Z')
  const later = at(2026, 10, 25, 2, 30)
  const nextDay = at(2026, 10, 26, 0, 30)
  const records = [
    workout({ id: 'n', type: 'walk', startedAt: nextDay }),
    workout({ id: 'l', type: 'yoga', startedAt: later }),
    workout({ id: 'r', type: 'strength', startedAt: repeated }),
    workout({ id: 'e', type: 'run', startedAt: early }),
  ]
  assert.deepEqual(workoutsOnDay(records, early).map((item) => item.type), ['run', 'strength', 'yoga'])
  const groups = groupedByDay(records)
  assert.deepEqual(groups.map((group) => group.key), ['2026-10-26', '2026-10-25'])
})
