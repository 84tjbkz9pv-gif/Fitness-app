import { weekStrip } from './calendar.js'
import {
  ACTIVITIES,
  GOALS,
  MEALS,
  dayKcal,
  formatKcal,
  kcalSummary,
  mealKcal,
  mealTitle,
  messageForFood,
  parseEstimate,
  parseFood,
  parseTarget,
  recentFoods,
} from './food.js'

export function foodScreen(state, actions) {
  const wrap = document.createElement('div')
  wrap.className = 'food'
  const marked = new Set(state.foods.map((entry) => entry.date))
  wrap.append(weekStrip({
    ...state,
    markDay: (date) => marked.has(date),
    markLabel: 'has food',
  }, actions))
  wrap.append(totalCard(state, actions))
  for (const meal of MEALS) wrap.append(mealSection(meal, state, actions))
  return wrap
}

export function foodTodayCard(state, onOpen) {
  const eaten = dayKcal(state.foods, state.selectedKey)
  const summary = kcalSummary(eaten, state.kcalTarget)
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'plan-card food-today'
  const label = document.createElement('span')
  label.textContent = 'Food'
  const main = document.createElement('strong')
  main.textContent = summary.main
  button.append(label, main)
  if (summary.left) {
    const left = document.createElement('span')
    left.className = 'plan-summary'
    left.textContent = summary.left
    button.append(left)
  }
  button.addEventListener('click', onOpen)
  return button
}

export function openFoodDialog({ meal, entry, foods, date }, actions) {
  const dialog = document.createElement('dialog')
  dialog.className = 'editor'
  const form = document.createElement('form')
  form.className = 'fields'
  const title = document.createElement('h2')
  title.textContent = entry ? `Edit ${mealTitle(meal).toLocaleLowerCase('en-GB')}` : mealTitle(meal)
  const name = field('Name', 'text', entry?.name ?? '')
  const amount = field('Amount', 'text', entry?.amount ?? '', '2 slices')
  const kcal = field('kcal', 'numeric', entry ? String(entry.kcal) : '')
  const protein = field('Protein (g)', 'decimal', gramText(entry?.proteinG))
  const carbs = field('Carbs (g)', 'decimal', gramText(entry?.carbsG))
  const fat = field('Fat (g)', 'decimal', gramText(entry?.fatG))
  const error = document.createElement('p')
  error.className = 'form-error'
  error.hidden = true
  const save = document.createElement('button')
  save.type = 'submit'
  save.className = 'pill'
  save.textContent = 'Save'
  form.append(title, name.label, amount.label, kcal.label, protein.label, carbs.label, fat.label, error, save)
  if (!entry) {
    form.append(recentList(foods, meal, dialog, actions))
    const copy = document.createElement('button')
    copy.type = 'button'
    copy.className = 'wide secondary'
    copy.textContent = `Copy yesterday's ${mealTitle(meal).toLocaleLowerCase('en-GB')}`
    copy.addEventListener('click', () => {
      dialog.close()
      actions.copyYesterday(meal)
    })
    form.append(copy)
  } else {
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'danger-text'
    remove.textContent = 'Delete'
    remove.addEventListener('click', () => {
      dialog.close()
      actions.deleteFood(entry.id)
    })
    form.append(remove)
  }
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'wide secondary'
  close.textContent = 'Close'
  close.addEventListener('click', () => dialog.close())
  form.append(close)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const parsed = parseFood({
      meal,
      name: name.input.value,
      amount: amount.input.value,
      kcalText: kcal.input.value,
      proteinText: protein.input.value,
      carbsText: carbs.input.value,
      fatText: fat.input.value,
      barcode: entry?.barcode ?? null,
    })
    if (!parsed.ok) {
      error.hidden = false
      error.textContent = messageForFood(parsed.error)
      return
    }
    dialog.close()
    actions.saveFood({ ...parsed.value, meal, date, id: entry?.id ?? null })
  })
  dialog.append(form)
  dialog.addEventListener('close', () => dialog.remove())
  document.body.append(dialog)
  dialog.showModal()
  name.input.focus()
}

export function openTargetSheet(state, actions) {
  const dialog = document.createElement('dialog')
  dialog.className = 'editor'
  const form = document.createElement('form')
  form.className = 'fields'
  const title = document.createElement('h2')
  title.textContent = 'Daily kcal target'
  const target = field('Daily target (kcal)', 'numeric', state.kcalTarget == null ? '' : String(state.kcalTarget), 'Optional')
  const targetError = document.createElement('p')
  targetError.className = 'form-error'
  targetError.hidden = true
  const save = document.createElement('button')
  save.type = 'submit'
  save.className = 'pill'
  save.textContent = 'Save target'
  const calcTitle = document.createElement('h2')
  calcTitle.textContent = 'Calculate my target'
  const weight = weightFor(state)
  const height = field('Height (cm)', 'decimal', state.profile?.heightCm ?? '')
  const weightField = field('Weight (kg)', 'decimal', weight ?? '')
  const age = field('Age', 'numeric', state.profile?.age ?? '')
  const sex = selectField('Sex', [['', 'Choose'], ['female', 'Female'], ['male', 'Male']], state.profile?.sex ?? '')
  const activity = selectField('Activity', [['', 'Choose'], ...ACTIVITIES.map((item) => [item.id, `${item.title} (${item.factor})`])], state.profile?.activity ?? '')
  const goal = selectField('Goal', [['', 'Choose'], ...GOALS.map((item) => [item.id, item.title])], state.profile?.goal ?? '')
  const calcError = document.createElement('p')
  calcError.className = 'form-error'
  calcError.hidden = true
  const calculate = document.createElement('button')
  calculate.type = 'button'
  calculate.className = 'wide secondary'
  calculate.textContent = 'Calculate'
  const result = document.createElement('div')
  result.className = 'estimate'
  result.hidden = true
  const maintenance = document.createElement('p')
  const targetLine = document.createElement('p')
  targetLine.className = 'estimate-target'
  const note = document.createElement('p')
  note.className = 'help'
  note.textContent = 'Estimate from the Mifflin-St Jeor formula, not advice.'
  const low = document.createElement('p')
  low.className = 'help'
  low.hidden = true
  low.textContent = 'This is below 1,200 kcal a day.'
  const use = document.createElement('button')
  use.type = 'button'
  use.className = 'pill'
  use.textContent = 'Use this target'
  result.append(maintenance, targetLine, note, low, use)
  let pending = null
  calculate.addEventListener('click', () => {
    const parsed = parseEstimate({
      heightText: height.input.value,
      weightText: weightField.input.value,
      ageText: age.input.value,
      sex: sex.input.value,
      activity: activity.input.value,
      goal: goal.input.value,
    })
    if (!parsed.ok) {
      calcError.hidden = false
      calcError.textContent = messageForFood(parsed.error)
      result.hidden = true
      pending = null
      return
    }
    calcError.hidden = true
    pending = parsed.value
    maintenance.textContent = `Maintenance estimate: ${formatKcal(parsed.value.maintenance)} kcal`
    targetLine.textContent = `Target: ${formatKcal(parsed.value.target)} kcal`
    low.hidden = !parsed.value.below1200
    result.hidden = false
    actions.rememberProfile(parsed.value.profile)
  })
  use.addEventListener('click', () => {
    if (!pending) return
    dialog.close()
    actions.useTarget(pending.profile, pending.target)
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const parsed = parseTarget(target.input.value)
    if (!parsed.ok) {
      targetError.hidden = false
      targetError.textContent = messageForFood(parsed.error)
      return
    }
    dialog.close()
    actions.saveTarget(parsed.value)
  })
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'wide secondary'
  close.textContent = 'Close'
  close.addEventListener('click', () => dialog.close())
  form.append(
    title, target.label, targetError, save,
    calcTitle, height.label, weightField.label, age.label, sex.label, activity.label, goal.label,
    calcError, calculate, result, close,
  )
  dialog.append(form)
  dialog.addEventListener('close', () => dialog.remove())
  document.body.append(dialog)
  dialog.showModal()
}

function weightFor(state) {
  return state.weightKg ?? state.profile?.weightKg ?? ''
}

function totalCard(state, actions) {
  const eaten = dayKcal(state.foods, state.selectedKey)
  const summary = kcalSummary(eaten, state.kcalTarget)
  const card = document.createElement('article')
  card.className = 'plan-card food-total'
  const main = document.createElement('p')
  main.className = 'food-kcal'
  main.textContent = summary.main
  card.append(main)
  if (summary.left) {
    const left = document.createElement('p')
    left.className = 'plan-summary'
    left.textContent = summary.left
    card.append(left)
  }
  const set = document.createElement('button')
  set.type = 'button'
  set.className = 'text-add'
  set.textContent = 'Set target'
  set.addEventListener('click', () => actions.openTarget())
  card.append(set)
  return card
}

function mealSection(meal, state, actions) {
  const section = document.createElement('section')
  section.className = 'meal'
  const head = document.createElement('div')
  head.className = 'meal-head'
  const title = document.createElement('h2')
  title.textContent = meal.title
  const sub = document.createElement('span')
  sub.textContent = `${formatKcal(mealKcal(state.foods, state.selectedKey, meal.id))} kcal`
  head.append(title, sub)
  section.append(head)
  const items = state.foods
    .filter((entry) => entry.date === state.selectedKey && entry.meal === meal.id)
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  if (items.length) {
    const list = document.createElement('ul')
    list.className = 'food-list'
    for (const entry of items) {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'food-item'
      const name = document.createElement('span')
      name.textContent = entry.amount ? `${entry.name} · ${entry.amount}` : entry.name
      const kcal = document.createElement('strong')
      kcal.textContent = `${formatKcal(entry.kcal)} kcal`
      button.append(name, kcal)
      button.addEventListener('click', () => actions.editFood(entry))
      item.append(button)
      list.append(item)
    }
    section.append(list)
  }
  const add = document.createElement('button')
  add.type = 'button'
  add.className = 'text-add'
  add.textContent = '+ Add food'
  add.addEventListener('click', () => actions.addFood(meal.id))
  section.append(add)
  return section
}

function recentList(foods, meal, dialog, actions) {
  const wrap = document.createElement('div')
  wrap.className = 'recent-foods'
  const heading = document.createElement('h2')
  heading.textContent = 'Recent'
  wrap.append(heading)
  const items = recentFoods(foods)
  if (items.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'help'
    empty.textContent = 'Foods you add show up here.'
    wrap.append(empty)
    return wrap
  }
  for (const entry of items) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'wide secondary'
    button.textContent = `${entry.name} · ${formatKcal(entry.kcal)} kcal`
    button.addEventListener('click', () => {
      dialog.close()
      actions.addRecent(entry, meal)
    })
    wrap.append(button)
  }
  return wrap
}

function field(label, mode, value, placeholder = '') {
  const wrap = document.createElement('label')
  wrap.textContent = label
  const input = document.createElement('input')
  input.inputMode = mode === 'text' ? 'text' : mode === 'numeric' ? 'numeric' : 'decimal'
  input.autocomplete = 'off'
  input.value = value == null ? '' : String(value)
  if (placeholder) input.placeholder = placeholder
  wrap.append(input)
  return { label: wrap, input }
}

function selectField(label, options, value) {
  const wrap = document.createElement('label')
  wrap.textContent = label
  const input = document.createElement('select')
  for (const [optionValue, text] of options) {
    const option = document.createElement('option')
    option.value = optionValue
    option.textContent = text
    input.append(option)
  }
  input.value = value
  wrap.append(input)
  return { label: wrap, input }
}

function gramText(value) {
  if (value == null) return ''
  return String(value)
}
