import { formatKcal, recentFoods } from './food.js'
import {
  ingredientFromFood,
  ingredientFromLine,
  ingredientNutrients,
  mealTotals,
  parseSavedMeal,
} from './meals.js'

export function openMealDialog(meal, context, actions) {
  const dialog = document.createElement('dialog')
  dialog.className = 'editor'
  const form = document.createElement('form')
  form.className = 'fields'
  const ingredients = (meal?.ingredients ?? []).map((item) => ({ ...item }))
  const title = document.createElement('h2')
  title.textContent = meal ? 'Edit meal' : 'Create meal'
  const name = labelled('Name', input('text', meal?.name ?? '', 'Overnight oats'))
  const portions = labelled('Makes portions', input('numeric', meal?.portions ?? '', '1'))
  const totals = document.createElement('p')
  totals.className = 'food-kcal'
  const list = document.createElement('div')
  list.className = 'food-list'
  const hand = handForm(ingredients, paint)
  const recent = recentButtons(context.foods, ingredients, paint)
  const scan = document.createElement('button')
  scan.type = 'button'
  scan.className = 'wide secondary'
  scan.textContent = 'Scan ingredient'
  scan.addEventListener('click', () => {
    actions.scanIngredient((item) => {
      ingredients.push(item)
      paint()
    })
  })
  const error = document.createElement('p')
  error.className = 'form-error'
  error.hidden = true
  const save = document.createElement('button')
  save.type = 'submit'
  save.className = 'pill'
  save.textContent = 'Save meal'
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'danger-text'
  remove.textContent = 'Delete meal'
  remove.hidden = !meal
  remove.addEventListener('click', () => {
    dialog.close()
    actions.deleteMeal(meal.id)
  })
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'wide secondary'
  close.textContent = 'Close'
  close.addEventListener('click', () => dialog.close())

  function paint() {
    list.replaceChildren()
    for (const [index, item] of ingredients.entries()) {
      list.append(ingredientRow(item, index, ingredients, paint))
    }
    const all = mealTotals(ingredients)
    const count = Number(portions.input.value) || 1
    const share = count > 0 ? Math.round(all.kcal / count) : all.kcal
    const bits = [`${formatKcal(all.kcal)} kcal`]
    if (all.proteinG != null) bits.push(`${all.proteinG} g protein`)
    if (all.carbsG != null) bits.push(`${all.carbsG} g carbs`)
    if (all.fatG != null) bits.push(`${all.fatG} g fat`)
    totals.textContent = ingredients.length
      ? `${bits.join(' · ')} · ${formatKcal(share)} kcal for 1 portion`
      : 'Add an ingredient.'
  }

  portions.input.addEventListener('input', paint)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const parsed = parseSavedMeal({
      name: name.input.value,
      portionsText: portions.input.value,
      ingredients,
    })
    if (!parsed.ok) {
      error.hidden = false
      error.textContent = parsed.error
      return
    }
    dialog.close()
    actions.saveMeal({ id: meal?.id ?? null, ...parsed.value })
  })
  form.append(title, name.label, portions.label, totals, list, scan, recent, hand, error, save, remove, close)
  dialog.append(form)
  dialog.addEventListener('close', () => dialog.remove())
  document.body.append(dialog)
  dialog.showModal()
  paint()
}

export function savedMealButtons(meals, onLog) {
  const wrap = document.createElement('div')
  wrap.className = 'recent-foods'
  if (meals.length === 0) return wrap
  const heading = document.createElement('h2')
  heading.textContent = 'Saved meals'
  wrap.append(heading)
  for (const meal of meals) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'wide secondary'
    button.textContent = meal.name
    button.addEventListener('click', () => onLog(meal))
    wrap.append(button)
  }
  return wrap
}

function ingredientRow(item, index, ingredients, paint) {
  const row = document.createElement('div')
  row.className = 'food-item'
  const line = ingredientNutrients(item)
  const label = document.createElement('span')
  label.textContent = `${item.name} · ${line.amount} · ${formatKcal(line.kcal)} kcal`
  const quantity = input(item.mode === 'grams' ? 'decimal' : 'decimal', String(item.quantity))
  quantity.addEventListener('change', () => {
    const next = Number(quantity.value.trim().replace(',', '.'))
    if (next > 0 && next <= 5000) item.quantity = next
    paint()
  })
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'text-add'
  remove.textContent = 'Remove'
  remove.addEventListener('click', () => {
    ingredients.splice(index, 1)
    paint()
  })
  row.append(label, quantity, remove)
  return row
}

function handForm(ingredients, paint) {
  const wrap = document.createElement('div')
  wrap.className = 'fields'
  const heading = document.createElement('h2')
  heading.textContent = 'Add by hand'
  const name = labelled('Ingredient', input('text', ''))
  const mode = document.createElement('select')
  for (const [value, text] of [['grams', 'Grams'], ['servings', 'Servings']]) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = text
    mode.append(option)
  }
  const modeLabel = labelled('Amount in', mode)
  const quantity = labelled('Amount', input('decimal', ''))
  const kcal = labelled('kcal for that amount', input('numeric', ''))
  const protein = labelled('Protein (g)', input('decimal', ''))
  const carbs = labelled('Carbs (g)', input('decimal', ''))
  const fat = labelled('Fat (g)', input('decimal', ''))
  const add = document.createElement('button')
  add.type = 'button'
  add.className = 'wide secondary'
  add.textContent = 'Add ingredient'
  const error = document.createElement('p')
  error.className = 'form-error'
  error.hidden = true
  add.addEventListener('click', () => {
    const kcalText = kcal.input.value.trim()
    const item = ingredientFromLine({
      name: name.input.value,
      mode: mode.value,
      quantity: quantity.input.value,
      kcal: Number(kcalText),
      proteinG: blankGram(protein.input.value),
      carbsG: blankGram(carbs.input.value),
      fatG: blankGram(fat.input.value),
    })
    if (!item || kcalText === '' || !Number.isFinite(Number(kcalText))) {
      error.hidden = false
      error.textContent = 'Enter a name, an amount, and the kcal.'
      return
    }
    ingredients.push(item)
    name.input.value = ''
    quantity.input.value = ''
    kcal.input.value = ''
    protein.input.value = ''
    carbs.input.value = ''
    fat.input.value = ''
    error.hidden = true
    paint()
  })
  wrap.append(heading, name.label, modeLabel.label, quantity.label, kcal.label, protein.label, carbs.label, fat.label, error, add)
  return wrap
}

function recentButtons(foods, ingredients, paint) {
  const wrap = document.createElement('div')
  wrap.className = 'recent-foods'
  const heading = document.createElement('h2')
  heading.textContent = 'Recent foods'
  wrap.append(heading)
  for (const entry of recentFoods(foods, 6)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'wide secondary'
    button.textContent = `${entry.name} · ${formatKcal(entry.kcal)} kcal`
    button.addEventListener('click', () => {
      const item = ingredientFromFood(entry)
      if (!item) return
      ingredients.push(item)
      paint()
    })
    wrap.append(button)
  }
  return wrap
}

function blankGram(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed === '') return null
  const value = Number(trimmed.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function labelled(text, field) {
  const label = document.createElement('label')
  label.textContent = text
  label.append(field)
  return { label, input: field }
}

function input(mode, value, placeholder = '') {
  const field = document.createElement('input')
  field.inputMode = mode === 'text' ? 'text' : mode === 'numeric' ? 'numeric' : 'decimal'
  field.autocomplete = 'off'
  field.value = value == null ? '' : String(value)
  if (placeholder) field.placeholder = placeholder
  return field
}
