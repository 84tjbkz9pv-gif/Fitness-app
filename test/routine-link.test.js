import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BUILT_IN_EXERCISES, bestsFromSets, doneSetCount, referenceText, sessionVolumeKg, setBadge } from '../js/gym.js'
import { decodeRoutineLink, encodeRoutineCode, importRoutine, legsAPayload, routineLink } from '../js/routine-link.js'

test('Legs A encodes and decodes the exact sets', () => {
  const payload = legsAPayload()
  const code = encodeRoutineCode(payload)
  const page = 'https://84tjbkz9pv-gif.github.io/Fitness-app/'
  const link = routineLink(payload, page)
  assert.equal(link, `${page}#routine=${code}`)
  assert.deepEqual(decodeRoutineLink(code).routine, payload)
  assert.deepEqual(decodeRoutineLink(link).routine, payload)
  assert.deepEqual(decodeRoutineLink(`routine=${code}`).routine, payload)

  const squat = payload.exercises[0]
  assert.equal(squat.sets[0].warmUp, true)
  assert.equal(squat.sets[0].kg, 20)
  assert.equal(squat.sets[4].kg, 50)
  const split = payload.exercises[1]
  assert.equal(split.sets[0].kg, undefined)
  assert.equal(split.sets[3].kg, 12.5)
  assert.equal(payload.exercises[3].bodyweight, true)
  assert.equal(payload.exercises[3].sets.some((set) => Object.hasOwn(set, 'kg')), false)
  assert.equal(payload.exercises[2].name.length <= 60, true)
})

test('malformed routine links are rejected', () => {
  assert.equal(decodeRoutineLink('').ok, false)
  assert.equal(decodeRoutineLink('not a code').ok, false)
  assert.equal(decodeRoutineLink('#routine=%%%%').ok, false)
  const extra = encodeRoutineCode({ ...legsAPayload(), note: 'hi' })
  assert.equal(decodeRoutineLink(extra).ok, false)
  const badSet = structuredClone(legsAPayload())
  delete badSet.exercises[0].sets[1].reps
  assert.equal(decodeRoutineLink(encodeRoutineCode(badSet)).ok, false)
  const negative = structuredClone(legsAPayload())
  negative.exercises[0].sets[1].kg = -1
  assert.equal(decodeRoutineLink(encodeRoutineCode(negative)).ok, false)
  const textWarmUp = structuredClone(legsAPayload())
  textWarmUp.exercises[0].sets[0].warmUp = 'yes'
  assert.equal(decodeRoutineLink(encodeRoutineCode(textWarmUp)).ok, false)
  const weightedBridge = structuredClone(legsAPayload())
  weightedBridge.exercises[3].sets[0].kg = 10
  assert.equal(decodeRoutineLink(encodeRoutineCode(weightedBridge)).ok, false)
})

test('import adds custom exercises and does not change existing routines or workouts', () => {
  const exercises = [{ id: 'custom-curl', name: 'Cable curl' }]
  const routines = [{ id: 'push', name: 'Push day', exercises: [] }]
  const workouts = [{ id: 'run-1', type: 'run' }]
  const exerciseSnapshot = structuredClone(exercises)
  const routineSnapshot = structuredClone(routines)
  const workoutSnapshot = structuredClone(workouts)
  let next = 1
  const imported = importRoutine(legsAPayload(), {
    builtIn: BUILT_IN_EXERCISES,
    exercises,
    routines,
    newId: () => `id-${next++}`,
  })
  assert.equal(imported.ok, true)
  assert.deepEqual(exercises, exerciseSnapshot)
  assert.deepEqual(routines, routineSnapshot)
  assert.deepEqual(workouts, workoutSnapshot)
  assert.equal(imported.newExercises.length, 5)
  assert.equal(imported.newExercises.some((item) => item.id === 'squat'), false)
  assert.equal(imported.routine.name, 'Legs A')
  assert.equal(imported.routine.exercises[0].sets[0].warmUp, true)
  assert.equal(imported.routine.exercises[0].sets[0].weightKg, 20)
  assert.equal(imported.routine.exercises[1].sets[0].weightKg, null)
  assert.equal(imported.routine.exercises[1].sets[3].weightKg, 12.5)
  assert.equal(imported.routine.exercises[3].repsOnly, true)
  assert.notEqual(imported.routine.id, 'push')

  const reused = importRoutine({
    name: 'Squat practice',
    exercises: [{ name: ' squat ', sets: [{ kg: 40, reps: 5 }] }],
  }, {
    builtIn: BUILT_IN_EXERCISES,
    exercises,
    routines,
    newId: () => 'fresh',
  })
  assert.equal(reused.newExercises.length, 0)
  assert.equal(reused.routine.exercises[0].exerciseId, 'squat')
  assert.deepEqual(exercises, exerciseSnapshot)
  assert.deepEqual(routines, routineSnapshot)
})

test('warm-up sets stay out of volume, set counts, and personal bests', () => {
  const session = {
    exercises: [{
      sets: [
        { weightKg: 100, reps: 12, done: true, warmUp: true },
        { weightKg: 30, reps: 12, done: true, warmUp: false },
        { weightKg: 40, reps: 10, done: false, warmUp: false },
      ],
    }],
  }
  assert.equal(sessionVolumeKg(session), 360)
  assert.equal(doneSetCount(session), 1)
  assert.equal(bestsFromSets([
    { weightKg: 100, reps: 12, warmUp: true },
    { weightKg: 30, reps: 12 },
  ]).heaviest.weightKg, 30)
  assert.equal(setBadge(session.exercises[0].sets, 0), 'W')
  assert.equal(setBadge(session.exercises[0].sets, 1), '1')
  assert.equal(referenceText(30, 12, false), '30kg x 12')
  assert.equal(referenceText(12.5, 6, false), '12.5kg x 6')
  assert.equal(referenceText(null, 12, false), '– x 12')
  assert.equal(referenceText(null, 12, true), '12')
})
