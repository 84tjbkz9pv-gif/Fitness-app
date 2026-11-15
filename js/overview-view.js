import { formatKg } from './gym.js'
import { londonLong, weekLabel } from './plan.js'
import { parseWeight, sortedWeights, weightChange } from './overview.js'

export function weightTodayCard(latest, actions) {
  const card = document.createElement('article')
  card.className = 'plan-card'
  const label = document.createElement('span')
  label.textContent = 'Weight'
  const main = document.createElement('strong')
  main.textContent = latest == null ? 'No weight logged' : `${formatKg(latest.kg)} kg`
  const row = document.createElement('div')
  row.className = 'meal-actions'
  const log = document.createElement('button')
  log.type = 'button'
  log.className = 'text-add'
  log.textContent = 'Log weight'
  log.addEventListener('click', () => actions.logWeight(null))
  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'text-add'
  open.textContent = 'Overview'
  open.addEventListener('click', actions.openOverview)
  row.append(log, open)
  card.append(label, main, row)
  return card
}

export function overviewScreen(state, actions) {
  const wrap = document.createElement('div')
  wrap.className = 'overview'
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'text-add'
  back.textContent = 'Back'
  back.addEventListener('click', actions.back)
  wrap.append(back, changeLine(state.weights), weightChart(state.weights), weightList(state.weights, actions))
  const weeks = document.createElement('h2')
  weeks.textContent = 'Last 4 weeks'
  wrap.append(weeks)
  for (const report of state.reports) wrap.append(weekCard(report))
  const lifts = document.createElement('h2')
  lifts.textContent = 'Estimated 1 rep max'
  wrap.append(lifts)
  if (state.estimates.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'help'
    empty.textContent = 'Finish a gym session to see an estimate.'
    wrap.append(empty)
  } else {
    const list = document.createElement('ul')
    list.className = 'food-list'
    for (const item of state.estimates) {
      const line = document.createElement('li')
      line.className = 'food-item'
      line.textContent = `${item.name} · ${formatKg(item.estimate)} kg estimate`
      list.append(line)
    }
    wrap.append(list)
  }
  return wrap
}

export function openWeightDialog(entry, date, actions) {
  const dialog = document.createElement('dialog')
  dialog.className = 'editor'
  const form = document.createElement('form')
  form.className = 'fields'
  const title = document.createElement('h2')
  title.textContent = entry ? 'Edit weight' : 'Log weight'
  const dateLabel = document.createElement('label')
  dateLabel.textContent = 'Date'
  const dateField = document.createElement('input')
  dateField.type = 'date'
  dateField.value = entry?.date ?? date
  dateLabel.append(dateField)
  const kgLabel = document.createElement('label')
  kgLabel.textContent = 'Weight (kg)'
  const kgField = document.createElement('input')
  kgField.inputMode = 'decimal'
  kgField.value = entry ? String(entry.kg) : ''
  kgLabel.append(kgField)
  const error = document.createElement('p')
  error.className = 'form-error'
  error.hidden = true
  const save = document.createElement('button')
  save.type = 'submit'
  save.className = 'pill'
  save.textContent = 'Save'
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'wide danger'
  remove.textContent = 'Delete'
  remove.hidden = !entry
  remove.addEventListener('click', () => {
    dialog.close()
    actions.deleteWeight(entry.id)
  })
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'wide secondary'
  close.textContent = 'Close'
  close.addEventListener('click', () => dialog.close())
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const parsed = parseWeight(dateField.value, kgField.value)
    if (!parsed.ok) {
      error.hidden = false
      error.textContent = parsed.error
      return
    }
    dialog.close()
    actions.saveWeight({ id: entry?.id ?? null, date: dateField.value, kg: parsed.kg })
  })
  form.append(title, dateLabel, kgLabel, error, save, remove, close)
  dialog.append(form)
  dialog.addEventListener('close', () => dialog.remove())
  document.body.append(dialog)
  dialog.showModal()
}

function changeLine(weights) {
  const line = document.createElement('p')
  line.className = 'food-kcal'
  const change = weightChange(weights)
  if (!change) line.textContent = 'No weight logged yet.'
  else if (change.changeKg < 0) line.textContent = `Lost ${formatKg(Math.abs(change.changeKg))} kg since ${londonLong(change.first.date)}`
  else if (change.changeKg > 0) line.textContent = `Up ${formatKg(change.changeKg)} kg since ${londonLong(change.first.date)}`
  else line.textContent = `Same weight since ${londonLong(change.first.date)}`
  return line
}

function weightChart(weights) {
  const sorted = sortedWeights(weights)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 320 160')
  svg.setAttribute('class', 'weight-chart')
  svg.setAttribute('role', 'img')
  if (sorted.length === 0) {
    svg.setAttribute('aria-label', 'No weight logged yet')
    return svg
  }
  const values = sorted.map((item) => item.kg)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const coords = sorted.map((item, index) => {
    const x = sorted.length === 1 ? 160 : 16 + index * (288 / (sorted.length - 1))
    const y = 16 + (1 - (item.kg - min) / span) * 128
    return { x, y }
  })
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  line.setAttribute('points', coords.map((point) => `${point.x},${point.y}`).join(' '))
  line.setAttribute('fill', 'none')
  line.setAttribute('stroke', '#ff4fa3')
  line.setAttribute('stroke-width', '3')
  line.setAttribute('stroke-linejoin', 'round')
  line.setAttribute('stroke-linecap', 'round')
  svg.append(line)
  for (const point of coords) {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    dot.setAttribute('cx', String(point.x))
    dot.setAttribute('cy', String(point.y))
    dot.setAttribute('r', '4')
    dot.setAttribute('fill', '#ff4fa3')
    svg.append(dot)
  }
  const first = sorted[0]
  const latest = sorted[sorted.length - 1]
  svg.setAttribute('aria-label', `${formatKg(first.kg)} kg on ${londonLong(first.date)} to ${formatKg(latest.kg)} kg on ${londonLong(latest.date)}`)
  return svg
}

function weightList(weights, actions) {
  const list = document.createElement('ul')
  list.className = 'food-list'
  for (const entry of sortedWeights(weights).slice().reverse()) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'food-item'
    button.textContent = `${londonLong(entry.date)} · ${formatKg(entry.kg)} kg`
    button.addEventListener('click', () => actions.logWeight(entry))
    const item = document.createElement('li')
    item.append(button)
    list.append(item)
  }
  return list
}

function weekCard(report) {
  const card = document.createElement('article')
  card.className = 'plan-card'
  const title = document.createElement('strong')
  title.textContent = weekLabel(report.monday)
  const food = document.createElement('p')
  food.className = 'plan-summary'
  food.textContent = report.logged === 0
    ? 'No food logged'
    : `On target ${report.onTarget} of ${report.logged} days`
  const sessions = document.createElement('p')
  sessions.className = 'plan-summary'
  sessions.textContent = `Sessions ${report.done} of ${report.planned}`
  card.append(title, food, sessions)
  return card
}
