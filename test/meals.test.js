import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBackup, parseBackup } from '../js/logic.js'
import { ingredientFromLine, mealTotals, onePortion } from '../js/meals.js'

test('meal totals add ingredients and one portion divides them', () => {
  const oats = ingredientFromLine({
    name: 'Oats',
    mode: 'grams',
    quantity: 100,
    kcal: 200,
    proteinG: 12,
    carbsG: 40,
    fatG: 4,
  })
  const yoghurt = ingredientFromLine({
    name: 'Yoghurt',
    mode: 'servings',
    quantity: 2,
    kcal: 300,
    proteinG: 8,
    carbsG: 20,
    fatG: 6,
  })
  const totals = mealTotals([oats, yoghurt])
  assert.equal(totals.kcal, 500)
  assert.equal(totals.proteinG, 20)
  assert.equal(totals.carbsG, 60)
  assert.equal(totals.fatG, 10)
  const portion = onePortion({ name: 'Breakfast pot', portions: 4, ingredients: [oats, yoghurt] })
  assert.equal(portion.kcal, 125)
  assert.equal(portion.proteinG, 5)
  assert.equal(portion.carbsG, 15)
  assert.equal(portion.fatG, 2.5)
  assert.equal(portion.amount, '1 portion')
  assert.equal(portion.ingredients[0].amount, '25 g')
  assert.equal(portion.ingredients[0].kcal, 50)
  assert.equal(portion.ingredients[1].amount, '0.5 servings')
  assert.equal(portion.ingredients[1].kcal, 75)
})

test('a backup round trip keeps weights, runs and saved meals, and older versions still import', () => {
  const oats = ingredientFromLine({ name: 'Oats', mode: 'grams', quantity: 50, kcal: 190, proteinG: 6, carbsG: null, fatG: null })
  const backup = createBackup([], new Date('2026-11-15T12:00:00.000Z'), {
    weights: [{ id: 'w1', date: '2026-11-15', kg: 60.2 }],
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
    savedMeals: [{ id: 'oats', name: 'Oats', portions: 2, ingredients: [oats] }],
  })
  assert.equal(backup.version, 8)
  const parsed = parseBackup(JSON.stringify(backup))
  assert.equal(parsed.ok, true)
  const again = createBackup([], new Date('2026-11-15T12:00:00.000Z'), {
    weights: parsed.weights,
    runs: parsed.runs,
    savedMeals: parsed.savedMeals,
  })
  assert.deepEqual(again.weights, backup.weights)
  assert.deepEqual(again.runs, backup.runs)
  assert.deepEqual(again.savedMeals, backup.savedMeals)
  assert.equal(parsed.weights[0].kg, 60.2)
  assert.equal(parsed.runs[0].notes, 'Park')
  assert.equal(onePortion(parsed.savedMeals[0]).kcal, 95)
  const version7 = parseBackup(JSON.stringify({
    version: 7,
    workouts: [],
    exercises: [],
    routines: [],
    sessions: [],
    plans: [],
    weights: [{ id: 'w1', date: '2026-11-01', kg: 62 }],
    runs: [{
      id: 'easy',
      date: '2026-11-15',
      type: 'easy',
      targetDistanceKm: 5,
      targetPaceMinPerKm: 6,
      intervals: null,
      actualDistanceKm: null,
      actualMinutes: null,
      notes: '',
    }],
  }))
  assert.equal(version7.weights[0].kg, 62)
  assert.equal(version7.runs[0].type, 'easy')
  assert.deepEqual(version7.savedMeals, [])
  const version6 = parseBackup(JSON.stringify({
    version: 6,
    workouts: [],
    exercises: [],
    routines: [],
    sessions: [],
    plans: [],
    weights: [{ id: 'w1', date: '2026-11-01', kg: 62.4 }],
  }))
  assert.equal(version6.weights[0].kg, 62.4)
  assert.deepEqual(version6.runs, [])
  assert.deepEqual(version6.savedMeals, [])
  const older = parseBackup(JSON.stringify({ version: 5, workouts: [], exercises: [], routines: [], sessions: [], plans: [] }))
  assert.deepEqual(older.weights, [])
  assert.deepEqual(older.runs, [])
  assert.deepEqual(older.savedMeals, [])
})
