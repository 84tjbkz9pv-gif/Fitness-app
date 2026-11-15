import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBackup, parseBackup } from '../js/logic.js'
import {
  bmr,
  calorieEstimate,
  copyMeal,
  dayKcal,
  latestWeightKg,
  mealKcal,
  parseEstimate,
  parseFood,
  parseTarget,
  recentFoods,
  roundTo10,
  weightForCalculator,
} from '../js/food.js'

function entry(overrides) {
  return {
    id: 'food-1',
    date: '2026-11-15',
    meal: 'breakfast',
    name: 'Porridge',
    amount: '1 bowl',
    kcal: 350,
    proteinG: 12,
    carbsG: 50,
    fatG: 8,
    barcode: null,
    createdAt: '2026-11-15T08:00:00.000Z',
    ...overrides,
  }
}

test('meal and day totals add kcal only for that day and meal', () => {
  const foods = [
    entry({ id: 'b', meal: 'breakfast', kcal: 350 }),
    entry({ id: 'l', meal: 'lunch', kcal: 500, createdAt: '2026-11-15T12:00:00.000Z' }),
    entry({ id: 's', meal: 'snacks', kcal: 80, createdAt: '2026-11-15T16:00:00.000Z' }),
    entry({ id: 'old', date: '2026-11-14', meal: 'breakfast', kcal: 999 }),
  ]
  assert.equal(mealKcal(foods, '2026-11-15', 'breakfast'), 350)
  assert.equal(mealKcal(foods, '2026-11-15', 'tea'), 0)
  assert.equal(dayKcal(foods, '2026-11-15'), 930)
  assert.equal(dayKcal(foods, '2026-11-14'), 999)
})

test('food kcal must be a whole number from 0 to 10000', () => {
  assert.equal(parseFood({ meal: 'tea', name: 'Chicken', kcalText: '500', amount: '150 g' }).ok, true)
  assert.equal(parseFood({ meal: 'snacks', name: 'Apple', kcalText: '0' }).value.kcal, 0)
  assert.equal(parseFood({ meal: 'breakfast', name: 'Toast', amount: '2 slices', kcalText: '180', proteinText: '12,5' }).value.proteinG, 12.5)
  assert.equal(parseFood({ meal: 'breakfast', name: '', kcalText: '100' }).ok, false)
  assert.equal(parseFood({ meal: 'breakfast', name: 'Toast', kcalText: '1.5' }).ok, false)
  assert.equal(parseFood({ meal: 'breakfast', name: 'Toast', kcalText: '10001' }).ok, false)
  assert.equal(parseTarget('').value, null)
  assert.equal(parseTarget('2000').value, 2000)
  assert.equal(parseTarget('0').ok, false)
})

test('recent foods are the last distinct names and copy yesterday does not change the list', () => {
  const foods = [
    entry({ id: '1', name: 'Porridge', createdAt: '2026-11-14T08:00:00.000Z', date: '2026-11-14' }),
    entry({ id: '2', name: 'porridge', createdAt: '2026-11-15T08:00:00.000Z', kcal: 400 }),
    entry({ id: '3', name: 'Apple', meal: 'snacks', createdAt: '2026-11-15T16:00:00.000Z', kcal: 80 }),
  ]
  const recent = recentFoods(foods, 10)
  assert.deepEqual(recent.map((item) => item.name), ['Apple', 'porridge'])
  let next = 1
  const copies = copyMeal(foods, '2026-11-14', '2026-11-15', 'breakfast', () => `new-${next++}`, '2026-11-15T09:00:00.000Z')
  assert.equal(copies.length, 1)
  assert.equal(copies[0].id, 'new-1')
  assert.equal(copies[0].date, '2026-11-15')
  assert.equal(copies[0].kcal, 350)
  assert.equal(foods.length, 3)
  assert.equal(foods[0].date, '2026-11-14')
  assert.equal(copyMeal(foods, '2026-11-13', '2026-11-15', 'tea', () => 'x', '2026-11-15T09:00:00.000Z').length, 0)
})

test('Mifflin-St Jeor maintenance and goal adjustment round to the nearest 10', () => {
  assert.equal(bmr({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 }), 1320.25)
  assert.equal(bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 25 }), 1805)
  const female = calorieEstimate({
    sex: 'female', weightKg: 60, heightCm: 165, age: 30, activity: 'moderate', kgPerWeek: -0.5,
  })
  assert.equal(female.maintenance, 2050)
  assert.equal(female.target, 1500)
  assert.equal(female.below1200, false)
  const male = calorieEstimate({
    sex: 'male', weightKg: 80, heightCm: 180, age: 25, activity: 'light', kgPerWeek: 0.25,
  })
  assert.equal(male.maintenance, 2480)
  assert.equal(male.target, 2760)
  assert.equal(roundTo10(2046.3875), 2050)
  const low = parseEstimate({
    heightText: '150',
    weightText: '45',
    ageText: '60',
    sex: 'female',
    activity: 'sedentary',
    goal: 'lose-1',
  })
  assert.equal(low.ok, true)
  assert.equal(low.value.below1200, true)
  assert.equal(low.value.target < 1200, true)
})

test('the calculator prefills the latest weight entry, then the saved profile', () => {
  assert.equal(latestWeightKg([
    { kg: 62, at: '2026-11-01' },
    { kg: 61.5, at: '2026-11-14' },
  ]), 61.5)
  assert.equal(weightForCalculator({ weightKg: 60 }, []), 60)
  assert.equal(weightForCalculator({ weightKg: 60 }, [{ kg: 61.5, at: '2026-11-14' }]), 61.5)
  assert.equal(weightForCalculator(null, []), null)
})

test('food entries and the calorie profile round trip in a version 4 backup', () => {
  const backup = createBackup([], new Date('2026-11-15T12:00:00.000Z'), {
    foods: [entry({ id: 'porridge' })],
    kcalTarget: 2000,
    foodProfile: {
      heightCm: 165,
      weightKg: 60,
      age: 30,
      sex: 'female',
      activity: 'moderate',
      goal: 'lose-0.5',
    },
  })
  assert.equal(backup.version, 8)
  const parsed = parseBackup(JSON.stringify(backup))
  assert.equal(parsed.ok, true)
  assert.equal(parsed.foods[0].name, 'Porridge')
  assert.equal(parsed.foods[0].barcode, null)
  assert.equal(parsed.kcalTarget, 2000)
  assert.equal(parsed.foodProfile.goal, 'lose-0.5')
  const older = parseBackup(JSON.stringify({ version: 3, workouts: [], exercises: [], routines: [], sessions: [], plans: [] }))
  assert.deepEqual(older.foods, [])
  assert.equal(older.kcalTarget, null)
  assert.equal(older.foodProfile, null)
})
