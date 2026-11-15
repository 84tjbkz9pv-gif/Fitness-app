import { addDays, isDateKey } from './plan.js'

export const MEALS = [
  { id: 'breakfast', title: 'Breakfast' },
  { id: 'lunch', title: 'Lunch' },
  { id: 'tea', title: 'Tea' },
  { id: 'snacks', title: 'Snacks' },
]

export const ACTIVITIES = [
  { id: 'sedentary', title: 'Sedentary', factor: 1.2 },
  { id: 'light', title: 'Light', factor: 1.375 },
  { id: 'moderate', title: 'Moderate', factor: 1.55 },
  { id: 'very', title: 'Very active', factor: 1.725 },
]

export const GOALS = [
  { id: 'maintain', title: 'Maintain', kgPerWeek: 0 },
  { id: 'lose-0.25', title: 'Lose 0.25 kg a week', kgPerWeek: -0.25 },
  { id: 'lose-0.5', title: 'Lose 0.5 kg a week', kgPerWeek: -0.5 },
  { id: 'lose-0.75', title: 'Lose 0.75 kg a week', kgPerWeek: -0.75 },
  { id: 'lose-1', title: 'Lose 1 kg a week', kgPerWeek: -1 },
  { id: 'gain-0.25', title: 'Gain 0.25 kg a week', kgPerWeek: 0.25 },
  { id: 'gain-0.5', title: 'Gain 0.5 kg a week', kgPerWeek: 0.5 },
]

const MESSAGES = {
  foodName: 'Enter a name.',
  foodKcal: 'Enter kcal as a whole number from 0 to 10,000.',
  foodAmount: 'Enter the amount in 40 characters or fewer.',
  foodGrams: 'Enter grams as a number, or leave them blank.',
  foodMeal: 'Choose a meal.',
  estimateNumbers: 'Check the height, weight and age.',
  estimateChoice: 'Choose sex, activity and a goal.',
  targetInvalid: 'Enter a target from 1 to 10,000 kcal, or leave it blank.',
}

export function messageForFood(error) {
  return MESSAGES[error] ?? 'Check this and try again.'
}

export function mealTitle(meal) {
  return MEALS.find((item) => item.id === meal)?.title ?? 'Meal'
}

export function mealKcal(entries, date, meal) {
  return entries
    .filter((entry) => entry.date === date && entry.meal === meal)
    .reduce((total, entry) => total + entry.kcal, 0)
}

export function dayKcal(entries, date) {
  return entries
    .filter((entry) => entry.date === date)
    .reduce((total, entry) => total + entry.kcal, 0)
}

export function formatKcal(value) {
  return Math.round(value).toLocaleString('en-GB')
}

export function kcalSummary(eaten, target) {
  if (target == null) return { main: `${formatKcal(eaten)} kcal`, left: '' }
  const left = target - eaten
  return {
    main: `${formatKcal(eaten)} of ${formatKcal(target)} kcal`,
    left: left >= 0 ? `${formatKcal(left)} kcal left` : `${formatKcal(-left)} kcal over`,
  }
}

export function recentFoods(entries, limit = 10) {
  const sorted = entries.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const seen = new Set()
  const items = []
  for (const entry of sorted) {
    const key = entry.name.trim().toLocaleLowerCase('en-GB')
    if (seen.has(key)) continue
    seen.add(key)
    items.push(entry)
    if (items.length === limit) break
  }
  return items
}

export function copyMeal(entries, fromDate, toDate, meal, newId, createdAt) {
  return entries
    .filter((entry) => entry.date === fromDate && entry.meal === meal)
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((entry) => ({
      id: newId(),
      date: toDate,
      meal,
      name: entry.name,
      amount: entry.amount ?? null,
      kcal: entry.kcal,
      proteinG: entry.proteinG ?? null,
      carbsG: entry.carbsG ?? null,
      fatG: entry.fatG ?? null,
      barcode: entry.barcode ?? null,
      createdAt,
    }))
}

export function yesterdayKey(date) {
  return addDays(date, -1)
}

export function emptyCopyMessage(meal) {
  return `Nothing saved for yesterday's ${mealTitle(meal).toLocaleLowerCase('en-GB')}.`
}

export function parseFood(draft) {
  const name = String(draft.name ?? '').trim()
  if (name === '' || name.length > 80) return { ok: false, error: 'foodName' }
  const kcal = parseWhole(draft.kcalText, 0, 10000)
  if (!kcal.ok) return { ok: false, error: 'foodKcal' }
  const amount = String(draft.amount ?? '').trim()
  if (amount.length > 40) return { ok: false, error: 'foodAmount' }
  if (!MEALS.some((meal) => meal.id === draft.meal)) return { ok: false, error: 'foodMeal' }
  const proteinG = parseGrams(draft.proteinText)
  const carbsG = parseGrams(draft.carbsText)
  const fatG = parseGrams(draft.fatText)
  if (!proteinG.ok || !carbsG.ok || !fatG.ok) return { ok: false, error: 'foodGrams' }
  const barcode = cleanBarcode(draft.barcode)
  if (barcode === undefined) return { ok: false, error: 'foodName' }
  return {
    ok: true,
    value: {
      name,
      amount: amount === '' ? null : amount,
      kcal: kcal.value,
      proteinG: proteinG.value,
      carbsG: carbsG.value,
      fatG: fatG.value,
      barcode,
    },
  }
}

export function parseTarget(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed === '') return { ok: true, value: null }
  const parsed = parseWhole(trimmed, 1, 10000)
  if (!parsed.ok) return { ok: false, error: 'targetInvalid' }
  return { ok: true, value: parsed.value }
}

export function bmr({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function roundTo10(value) {
  return Math.round(value / 10) * 10
}

export function calorieEstimate({ sex, weightKg, heightCm, age, activity, kgPerWeek }) {
  const factor = ACTIVITIES.find((item) => item.id === activity)?.factor
  const maintenanceRaw = bmr({ sex, weightKg, heightCm, age }) * factor
  const target = roundTo10(maintenanceRaw + kgPerWeek * 7700 / 7)
  return {
    maintenance: roundTo10(maintenanceRaw),
    target,
    below1200: target < 1200,
  }
}

export function parseEstimate(draft) {
  const heightCm = parseDecimal(draft.heightText, 50, 250)
  const weightKg = parseDecimal(draft.weightText, 20, 400)
  const age = parseWhole(draft.ageText, 10, 120)
  if (!heightCm.ok || !weightKg.ok || !age.ok) return { ok: false, error: 'estimateNumbers' }
  if (draft.sex !== 'female' && draft.sex !== 'male') return { ok: false, error: 'estimateChoice' }
  const activity = ACTIVITIES.find((item) => item.id === draft.activity)
  const goal = GOALS.find((item) => item.id === draft.goal)
  if (!activity || !goal) return { ok: false, error: 'estimateChoice' }
  const estimate = calorieEstimate({
    sex: draft.sex,
    weightKg: weightKg.value,
    heightCm: heightCm.value,
    age: age.value,
    activity: activity.id,
    kgPerWeek: goal.kgPerWeek,
  })
  return {
    ok: true,
    value: {
      profile: {
        heightCm: heightCm.value,
        weightKg: weightKg.value,
        age: age.value,
        sex: draft.sex,
        activity: activity.id,
        goal: goal.id,
      },
      ...estimate,
    },
  }
}

export function latestWeightKg(weights) {
  const sorted = (weights ?? [])
    .filter((item) => item && typeof item.kg === 'number' && item.kg > 0)
    .slice()
    .sort((left, right) => String(right.at).localeCompare(String(left.at)))
  return sorted[0]?.kg ?? null
}

export function weightForCalculator(profile, weights) {
  return latestWeightKg(weights) ?? profile?.weightKg ?? null
}

export function foodFromStored(stored) {
  if (!stored || typeof stored.id !== 'string' || stored.id === '') return null
  if (!isDateKey(stored.date)) return null
  if (!MEALS.some((meal) => meal.id === stored.meal)) return null
  if (typeof stored.name !== 'string') return null
  const name = stored.name.trim()
  if (name === '' || name.length > 80) return null
  if (!Number.isInteger(stored.kcal) || stored.kcal < 0 || stored.kcal > 10000) return null
  const amount = stored.amount == null ? null : stored.amount
  if (amount != null && (typeof amount !== 'string' || amount.trim() === '' || amount.length > 40)) return null
  const proteinG = optionalGram(stored.proteinG)
  const carbsG = optionalGram(stored.carbsG)
  const fatG = optionalGram(stored.fatG)
  if (proteinG === undefined || carbsG === undefined || fatG === undefined) return null
  const barcode = stored.barcode == null ? null : stored.barcode
  if (barcode != null && !/^\d{8,14}$/.test(barcode)) return null
  const createdAt = typeof stored.createdAt === 'string' ? stored.createdAt : ''
  if (Number.isNaN(new Date(createdAt).getTime())) return null
  return {
    id: stored.id,
    date: stored.date,
    meal: stored.meal,
    name,
    amount,
    kcal: stored.kcal,
    proteinG,
    carbsG,
    fatG,
    barcode,
    createdAt,
  }
}

export function foodToStored(entry) {
  return {
    id: entry.id,
    date: entry.date,
    meal: entry.meal,
    name: entry.name,
    amount: entry.amount ?? null,
    kcal: entry.kcal,
    proteinG: entry.proteinG ?? null,
    carbsG: entry.carbsG ?? null,
    fatG: entry.fatG ?? null,
    barcode: entry.barcode ?? null,
    createdAt: entry.createdAt,
  }
}

export function foodProfileFromStored(stored) {
  if (stored == null) return null
  if (!stored || typeof stored !== 'object') return undefined
  const heightCm = optionalMeasure(stored.heightCm, 50, 250)
  const weightKg = optionalMeasure(stored.weightKg, 20, 400)
  if (heightCm == null || weightKg == null) return undefined
  if (!Number.isInteger(stored.age) || stored.age < 10 || stored.age > 120) return undefined
  if (stored.sex !== 'female' && stored.sex !== 'male') return undefined
  if (!ACTIVITIES.some((item) => item.id === stored.activity)) return undefined
  if (!GOALS.some((item) => item.id === stored.goal)) return undefined
  return {
    heightCm,
    weightKg,
    age: stored.age,
    sex: stored.sex,
    activity: stored.activity,
    goal: stored.goal,
  }
}

function optionalMeasure(value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null
  return value
}

function optionalGram(value) {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000) return undefined
  return value
}

function parseWhole(text, min, max) {
  const trimmed = String(text ?? '').trim()
  if (!/^\d+$/.test(trimmed)) return { ok: false }
  const value = Number(trimmed)
  if (value < min || value > max) return { ok: false }
  return { ok: true, value }
}

function parseDecimal(text, min, max) {
  const trimmed = String(text ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d)?$/.test(trimmed)) return { ok: false }
  const value = Number(trimmed)
  if (value < min || value > max) return { ok: false }
  return { ok: true, value }
}

function parseGrams(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed === '') return { ok: true, value: null }
  const parsed = parseDecimal(trimmed, 0, 1000)
  if (!parsed.ok) return { ok: false }
  return parsed
}

function cleanBarcode(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\d{8,14}$/.test(value)) return undefined
  return value
}
