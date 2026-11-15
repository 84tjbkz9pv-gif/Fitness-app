import { barcodeKind } from './barcode.js'
import { formatKcal, recentFoods } from './food.js'

const FIELDS = 'product_name,brands,serving_size,serving_quantity,nutriments,quantity'

export function offUrl(barcode) {
  const params = new URLSearchParams({
    fields: FIELDS,
    app_name: 'Fitness/1.0',
  })
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?${params}`
}

export function productFromOff(barcode, payload) {
  if (!payload || payload.status !== 1 || !payload.product) return null
  const source = payload.product
  const nutriments = source.nutriments ?? {}
  const name = String(source.product_name ?? '').trim()
  const brand = String(source.brands ?? '').split(',')[0].trim()
  const product = {
    barcode,
    name: name || 'Scanned food',
    brand,
    quantity: source.quantity ? String(source.quantity) : null,
    servingSize: source.serving_size ? String(source.serving_size) : null,
    servingQuantity: asNumber(source.serving_quantity),
    kcalPer100g: asNumber(nutriments['energy-kcal_100g']),
    proteinPer100g: asNumber(nutriments.proteins_100g),
    carbsPer100g: asNumber(nutriments.carbohydrates_100g),
    fatPer100g: asNumber(nutriments.fat_100g),
    kcalPerServing: asNumber(nutriments['energy-kcal_serving']),
    proteinPerServing: asNumber(nutriments.proteins_serving),
    carbsPerServing: asNumber(nutriments.carbohydrates_serving),
    fatPerServing: asNumber(nutriments.fat_serving),
    updatedAt: new Date().toISOString(),
  }
  if (product.kcalPer100g == null && product.kcalPerServing == null) return null
  return product
}

export async function fetchOffProduct(barcode, fetchImpl = fetch) {
  const kind = barcodeKind(barcode)
  if (!kind.ok) return { found: false }
  const response = await fetchImpl(offUrl(kind.code), {
    headers: { Accept: 'application/json' },
  })
  if (response.status === 404) return { found: false }
  if (!response.ok) throw new Error('lookup failed')
  const product = productFromOff(kind.code, await response.json())
  if (!product) return { found: false }
  return { found: true, product }
}

export function nutrientsFor(product, choice) {
  const amount = Number(choice.amount)
  if (!(amount > 0)) return { ok: false }
  if (choice.mode === 'grams') {
    if (product.kcalPer100g == null) return { ok: false }
    const factor = amount / 100
    return scaled(product.kcalPer100g, product.proteinPer100g, product.carbsPer100g, product.fatPer100g, factor)
  }
  if (product.kcalPerServing != null) {
    return scaled(product.kcalPerServing, product.proteinPerServing, product.carbsPerServing, product.fatPerServing, amount)
  }
  if (product.kcalPer100g != null && product.servingQuantity > 0) {
    return scaled(
      product.kcalPer100g,
      product.proteinPer100g,
      product.carbsPer100g,
      product.fatPer100g,
      amount * product.servingQuantity / 100,
    )
  }
  return { ok: false }
}

export function portionText(choice) {
  const amount = Number(choice.amount)
  if (choice.mode === 'grams') return `${trimNumber(amount)} g`
  return amount === 1 ? '1 serving' : `${trimNumber(amount)} servings`
}

export function productLines(product) {
  const lines = []
  if (product.kcalPer100g != null) lines.push(`${formatKcal(Math.round(product.kcalPer100g))} kcal per 100 g`)
  if (product.kcalPerServing != null) {
    const size = product.servingSize ? ` (${product.servingSize})` : ''
    lines.push(`${formatKcal(Math.round(product.kcalPerServing))} kcal per serving${size}`)
  } else if (product.kcalPer100g != null && product.servingQuantity > 0) {
    const kcal = Math.round(product.kcalPer100g * product.servingQuantity / 100)
    const size = product.servingSize ? ` (${product.servingSize})` : ''
    lines.push(`${formatKcal(kcal)} kcal per serving${size}`)
  }
  return lines
}

export function recentChoices(foods, products, limit = 10) {
  const picked = recentFoods(foods, limit)
  const names = new Set(picked.map((item) => item.name.trim().toLocaleLowerCase('en-GB')))
  const cached = []
  const sorted = products.slice().sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
  for (const product of sorted) {
    if (picked.length + cached.length >= limit) break
    const key = product.name.trim().toLocaleLowerCase('en-GB')
    if (names.has(key)) continue
    names.add(key)
    cached.push(product)
  }
  return { foods: picked, products: cached }
}

function scaled(kcal, protein, carbs, fat, factor) {
  return {
    ok: true,
    kcal: Math.round(kcal * factor),
    proteinG: roundGram(protein, factor),
    carbsG: roundGram(carbs, factor),
    fatG: roundGram(fat, factor),
  }
}

function roundGram(value, factor) {
  if (value == null) return null
  return Math.round(value * factor * 10) / 10
}

function trimNumber(value) {
  return String(Math.round(value * 10) / 10)
}

function asNumber(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
