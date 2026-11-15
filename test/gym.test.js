import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  badgesForSet,
  bestsFromSets,
  epley1Rm,
  exerciseSeries,
  newPersonalBests,
  plansMatch,
  previousSet,
} from '../js/gym.js'
import { createBackup, parseBackup, workoutToStored } from '../js/logic.js'

function at(year, month, day, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

function set(weightKg, reps, done = true) {
  return { weightKg, reps, done }
}

function session({ id, name = 'Push day', startedAt, finishedAt, exerciseId = 'bench-press', sets }) {
  return {
    id,
    name,
    routineId: null,
    startedAt,
    finishedAt,
    exercises: [{ exerciseId, sets }],
  }
}

test('Epley estimated 1RM uses weight times 1 plus reps over 30', () => {
  assert.equal(epley1Rm(60, 8), 76)
  assert.equal(epley1Rm(100, 1), 100 * (1 + 1 / 30))
  assert.equal(epley1Rm(0, 8), null)
  assert.equal(epley1Rm(60, 0), null)
})

test('previous set is the same set number from the last finished session', () => {
  const older = session({
    id: 'old',
    startedAt: at(2026, 11, 1, 9),
    finishedAt: at(2026, 11, 1, 10),
    sets: [set(50, 8), set(55, 6)],
  })
  const latest = session({
    id: 'new',
    startedAt: at(2026, 11, 8, 9),
    finishedAt: at(2026, 11, 8, 10),
    sets: [set(60, 8), set(60, 5)],
  })
  const open = session({
    id: 'open',
    startedAt: at(2026, 11, 15, 9),
    finishedAt: null,
    sets: [set(80, 1)],
  })
  const before = at(2026, 11, 15, 9)
  assert.deepEqual(previousSet([older, open, latest], { exerciseId: 'bench-press', setIndex: 0, before }), { weightKg: 60, reps: 8 })
  assert.deepEqual(previousSet([older, latest], { exerciseId: 'bench-press', setIndex: 1, before }), { weightKg: 60, reps: 5 })
  assert.equal(previousSet([older, latest], { exerciseId: 'bench-press', setIndex: 2, before }), null)
  assert.equal(previousSet([older, latest], { exerciseId: 'squat', setIndex: 0, before }), null)
  assert.equal(previousSet([latest], { exerciseId: 'bench-press', setIndex: 0, before: at(2026, 11, 8, 9) }), null)
})

test('personal bests cover heaviest weight, estimated 1RM, and set volume', () => {
  const sets = [set(100, 1), set(80, 8), set(90, 3)]
  const bests = bestsFromSets(sets)
  assert.equal(bests.heaviest.weightKg, 100)
  assert.equal(bests.estimated1Rm.reps, 1)
  assert.equal(bests.estimated1Rm.value, epley1Rm(100, 1))
  assert.equal(bests.bestVolume.value, 80 * 8)

  const history = [session({
    id: 'past',
    startedAt: at(2026, 11, 1, 9),
    finishedAt: at(2026, 11, 1, 10),
    sets: [set(100, 1), set(80, 8)],
  })]
  const prior = history.flatMap((item) => item.exercises[0].sets)
  assert.deepEqual(badgesForSet(set(100, 1), prior), [])
  assert.deepEqual(badgesForSet(set(90, 1), [set(80, 10)]), ['weight'])
  assert.ok(badgesForSet(set(85, 8), prior).includes('estimated1Rm'))
  assert.ok(badgesForSet(set(90, 8), prior).includes('volume'))
  assert.deepEqual(badgesForSet(set(70, 5, false), []), [])

  const current = session({
    id: 'today',
    startedAt: at(2026, 11, 15, 9),
    finishedAt: at(2026, 11, 15, 10),
    sets: [set(100, 3), set(70, 12)],
  })
  const fresh = newPersonalBests(current, history)
  assert.equal(fresh.length, 1)
  assert.equal(fresh[0].exerciseId, 'bench-press')
  assert.ok(fresh[0].records.some((record) => record.kind === 'estimated1Rm'))
  assert.ok(fresh[0].records.some((record) => record.kind === 'volume'))
  assert.equal(fresh[0].records.some((record) => record.kind === 'weight'), false)

  const series = exerciseSeries([...history, current], 'bench-press')
  assert.equal(series.length, 2)
  assert.equal(series[1].heaviest, 100)
  assert.ok(series[1].estimated1Rm > series[0].estimated1Rm)
})

test('a version 1 backup imports with empty gym data', () => {
  const startedAt = at(2026, 11, 15, 7, 30)
  const legacy = {
    version: 1,
    exportedAt: '2026-11-15T18:00:00.000Z',
    workouts: [workoutToStored({
      id: 'run-1',
      type: 'run',
      startedAt,
      durationMinutes: 32,
      distanceKilometres: 5.2,
      notes: 'Park',
    })],
  }
  const parsed = parseBackup(JSON.stringify(legacy))
  assert.equal(parsed.ok, true)
  assert.equal(parsed.workouts.length, 1)
  assert.equal(parsed.workouts[0].type, 'run')
  assert.equal(parsed.workouts[0].startedAt.getTime(), startedAt.getTime())
  assert.equal(parsed.workouts[0].distanceKilometres, 5.2)
  assert.deepEqual(parsed.exercises, [])
  assert.deepEqual(parsed.routines, [])
  assert.deepEqual(parsed.sessions, [])

  const routine = {
    id: 'push',
    name: 'Push day',
    exercises: [{ exerciseId: 'bench-press', sets: [{ reps: 8, weightKg: 60 }, { reps: null, weightKg: null }] }],
  }
  const gymSession = {
    id: 'session-1',
    name: 'Push day',
    routineId: 'push',
    startedAt,
    finishedAt: at(2026, 11, 15, 8, 15),
    exercises: [{ exerciseId: 'bench-press', sets: [set(62.5, 8)] }],
  }
  const backup = createBackup(parsed.workouts, at(2026, 11, 15, 21), {
    exercises: [{ id: 'custom-curl', name: 'Cable curl' }],
    routines: [routine],
    sessions: [gymSession],
  })
  assert.equal(backup.version, 6)
  const roundTrip = parseBackup(JSON.stringify(backup))
  assert.equal(roundTrip.ok, true)
  assert.equal(roundTrip.routines[0].name, 'Push day')
  assert.equal(roundTrip.routines[0].exercises[0].sets[1].reps, null)
  assert.equal(roundTrip.sessions[0].finishedAt.getTime(), gymSession.finishedAt.getTime())
  assert.equal(roundTrip.sessions[0].exercises[0].sets[0].weightKg, 62.5)
  assert.equal(roundTrip.exercises[0].name, 'Cable curl')
  assert.equal(roundTrip.workouts[0].notes, 'Park')
  assert.equal(plansMatch(roundTrip.routines[0], {
    exercises: [{
      exerciseId: 'bench-press',
      sets: [
        { reps: 8, weightKg: 60, done: true },
        { reps: null, weightKg: null, done: false },
      ],
    }],
  }), true)
})
