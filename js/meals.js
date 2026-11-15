export function round1(value) {
  return Math.round(value * 10) / 10
}

export function amountLabel(item) {
  const quantity = round1(item.quantity)
  if (item.mode === 'grams') return `${trimNumber(quantity)} g`
  return quantity === 1 ? '1 serving' : `${trimNumber(quantity)} servings`
}

export function ingredientNutrients(item) {
  const quantity = item.quantity
  return {
    kcal: Math.round(item.kcalPer * quantity),
    proteinG: scaleGram(item.proteinPer, quantity),
    carbsG: scaleGram(item.carbsPer, quantity),
    fatG: scaleGram(item.fatPer, quantity),
    amount: amountLabel(item),
  }
}

export function mealTotals(ingredients) {
  let kcal = 0
  let protein = 0
  let carbs = 0
  let fat = 0
  let anyProtein = false
  let anyCarbs = false
  let anyFat = false
  for (const item of ingredients) {
    const line = ingredientNutrients(item)
    kcal += line.kcal
    if (line.proteinG != null) {
      protein += line.proteinG
      anyProtein = true
    }
    if (line.carbsG != null) {
      carbs += line.carbsG
      anyCarbs = true
    }
    if (line.fatG != null) {
      fat += line.fatG
      anyFat = true
    }
  }
  return {
    kcal,
    proteinG: anyProtein ? round1(protein) : null,
    carbsG: anyCarbs ? round1(carbs) : null,
    fatG: anyFat ? round1(fat) : null,
  }
}

export function onePortion(meal) {
  const portions = meal.portions
  const totals = mealTotals(meal.ingredients)
  const factor = 1 / portions
  return {
    name: meal.name,
    amount: portions === 1 ? null : '1 portion',
    kcal: Math.round(totals.kcal * factor),
    proteinG: totals.proteinG == null ? null : round1(totals.proteinG * factor),
    carbsG: totals.carbsG == null ? null : round1(totals.carbsG * factor),
    fatG: totals.fatG == null ? null : round1(totals.fatG * factor),
    barcode: null,
    ingredients: meal.ingredients.map((item) => {
      const line = ingredientNutrients({ ...item, quantity: item.quantity * factor })
      return {
        name: item.name,
        amount: line.amount,
        kcal: line.kcal,
        proteinG: line.proteinG,
        carbsG: line.carbsG,
        fatG: line.fatG,
      }
    }),
  }
}

export function ingredientFromLine({ name, mode, quantity, kcal, proteinG, carbsG, fatG, barcode }) {
  const qty = Number(quantity)
  if (!(qty > 0) || typeof name !== 'string' || name.trim() === '') return null
  return {
    name: name.trim(),
    mode: mode === 'grams' ? 'grams' : 'servings',
    quantity: qty,
    kcalPer: kcal / qty,
    proteinPer: proteinG == null ? null : proteinG / qty,
    carbsPer: carbsG == null ? null : carbsG / qty,
    fatPer: fatG == null ? null : fatG / qty,
    barcode: barcode ?? null,
  }
}

export function ingredientFromFood(entry) {
  return ingredientFromLine({
    name: entry.name,
    mode: 'servings',
    quantity: 1,
    kcal: entry.kcal,
    proteinG: entry.proteinG ?? null,
    carbsG: entry.carbsG ?? null,
    fatG: entry.fatG ?? null,
    barcode: entry.barcode ?? null,
  })
}

export function parseSavedMeal({ name, portionsText, ingredients }) {
  const trimmed = String(name ?? '').trim()
  if (trimmed === '' || trimmed.length > 80) return { ok: false, error: 'Enter a name.' }
  const text = String(portionsText ?? '').trim()
  const portions = text === '' ? 1 : Number(text)
  if (!Number.isInteger(portions) || portions < 1 || portions > 20) {
    return { ok: false, error: 'Enter how many portions it makes, from 1 to 20.' }
  }
  if (!Array.isArray(ingredients) || ingredients.length === 0 || ingredients.length > 40) {
    return { ok: false, error: 'Add at least one ingredient.' }
  }
  if (ingredients.some((item) => !validIngredient(item))) return { ok: false, error: 'Check each ingredient.' }
  return {
    ok: true,
    value: {
      name: trimmed,
      portions,
      ingredients: ingredients.map(copyIngredient),
    },
  }
}

export function mealFromStored(stored) {
  if (stored == null) return null
  if (!stored || typeof stored.id !== 'string' || stored.id === '') return undefined
  const parsed = parseSavedMeal({
    name: stored.name,
    portionsText: stored.portions,
    ingredients: stored.ingredients,
  })
  if (!parsed.ok) return undefined
  return { id: stored.id, ...parsed.value }
}

export function referenceListFromStored(value) {
  if (value == null) return null
  if (!Array.isArray(value) || value.length > 40) return undefined
  const items = []
  for (const item of value) {
    if (!item || typeof item.name !== 'string' || item.name.trim() === '' || item.name.length > 80) return undefined
    if (typeof item.amount !== 'string' || item.amount.length > 40) return undefined
    if (!Number.isInteger(item.kcal) || item.kcal < 0 || item.kcal > 10000) return undefined
    const proteinG = optionalGram(item.proteinG)
    const carbsG = optionalGram(item.carbsG)
    const fatG = optionalGram(item.fatG)
    if (proteinG === undefined || carbsG === undefined || fatG === undefined) return undefined
    items.push({
      name: item.name.trim(),
      amount: item.amount,
      kcal: item.kcal,
      proteinG,
      carbsG,
      fatG,
    })
  }
  return items.length ? items : null
}

function scaleGram(per, quantity) {
  if (per == null) return null
  return round1(per * quantity)
}

function trimNumber(value) {
  return String(round1(value))
}

function validIngredient(item) {
  if (!item || typeof item.name !== 'string' || item.name.trim() === '' || item.name.length > 80) return false
  if (item.mode !== 'grams' && item.mode !== 'servings') return false
  if (typeof item.quantity !== 'number' || !(item.quantity > 0) || item.quantity > 5000) return false
  if (typeof item.kcalPer !== 'number' || item.kcalPer < 0 || !Number.isFinite(item.kcalPer)) return false
  return optionalRate(item.proteinPer) && optionalRate(item.carbsPer) && optionalRate(item.fatPer)
}

function optionalRate(value) {
  return value == null || (typeof value === 'number' && value >= 0 && Number.isFinite(value))
}

function optionalGram(value) {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000) return undefined
  return value
}

function copyIngredient(item) {
  return {
    name: item.name.trim(),
    mode: item.mode,
    quantity: item.quantity,
    kcalPer: item.kcalPer,
    proteinPer: item.proteinPer ?? null,
    carbsPer: item.carbsPer ?? null,
    fatPer: item.fatPer ?? null,
    barcode: item.barcode ?? null,
  }
}
