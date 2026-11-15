import {
  WORKOUT_TYPES,
  dayHeading,
  distanceFieldText,
  formatDateTimeLocal,
  groupedByDay,
  longDate,
  messageFor,
  parseDateTimeLocal,
  typeTitle,
  validate,
  workoutSummary,
  workoutsOnDay,
} from './logic.js'
import { keepDataOnThisPhone, loadWorkouts, putWorkout, removeWorkout } from './storage.js'

const ICONS = {
  run: '🏃',
  walk: '🚶',
  cycle: '🚴',
  strength: '🏋️',
  swim: '🏊',
  yoga: '🧘',
  other: '✨',
}

const main = document.querySelector('#main')
const screenTitle = document.querySelector('#screen-title')
const screenDate = document.querySelector('#screen-date')
const banner = document.querySelector('#banner')
const addButton = document.querySelector('#add-button')
const tabToday = document.querySelector('#tab-today')
const tabHistory = document.querySelector('#tab-history')
const editor = document.querySelector('#editor')
const form = document.querySelector('#workout-form')
const editorTitle = document.querySelector('#editor-title')
const typeField = document.querySelector('#type')
const startField = document.querySelector('#start')
const durationField = document.querySelector('#duration')
const distanceField = document.querySelector('#distance')
const notesField = document.querySelector('#notes')
const formError = document.querySelector('#form-error')
const deleteButton = document.querySelector('#delete')
const confirmPanel = document.querySelector('#confirm')
const confirmCancel = document.querySelector('#confirm-cancel')
const confirmDelete = document.querySelector('#confirm-delete')

let workouts = []
let screen = 'today'
let editingId = null

for (const type of WORKOUT_TYPES) {
  const option = document.createElement('option')
  option.value = type.id
  option.textContent = type.title
  typeField.append(option)
}

addButton.addEventListener('click', () => openEditor(null))
tabToday.addEventListener('click', () => showScreen('today'))
tabHistory.addEventListener('click', () => showScreen('history'))
main.addEventListener('click', onMainClick)
form.addEventListener('submit', onSave)
form.addEventListener('input', () => {
  formError.hidden = true
})
document.querySelector('#cancel').addEventListener('click', () => editor.close())
deleteButton.addEventListener('click', () => {
  confirmPanel.hidden = false
})
confirmCancel.addEventListener('click', () => {
  confirmPanel.hidden = true
})
confirmDelete.addEventListener('click', onDelete)
editor.addEventListener('close', () => {
  confirmPanel.hidden = true
})

start().catch((error) => {
  console.error(error)
  showBanner('Could not open saved workouts on this phone.')
  render()
})

async function start() {
  workouts = await loadWorkouts()
  render()
  keepDataOnThisPhone()
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // The page still works. The copy on the phone is updated the next time it can reach the site.
    })
  }
}

function showScreen(next) {
  screen = next
  render()
}

function render() {
  const now = new Date()
  const today = screen === 'today'
  screenTitle.textContent = today ? 'Today' : 'History'
  screenDate.textContent = today ? longDate(now) : ''
  screenDate.hidden = !today
  tabToday.setAttribute('aria-current', today ? 'page' : 'false')
  tabHistory.setAttribute('aria-current', today ? 'false' : 'page')
  main.replaceChildren(today ? todayView(now) : historyView(now))
}

function todayView(now) {
  const todays = workoutsOnDay(workouts, now)
  if (todays.length === 0) {
    return emptyState(
      'Nothing logged today',
      'Add a run, walk, or any other session when you are ready.',
    )
  }
  return workoutList([{ day: now, workouts: todays }], now, false)
}

function historyView(now) {
  const groups = groupedByDay(workouts)
  if (groups.length === 0) {
    return emptyState(
      'No workouts yet',
      'Workouts you add show up here, grouped by day.',
    )
  }
  return workoutList(groups, now, true)
}

function emptyState(title, copy) {
  const wrap = document.createElement('div')
  wrap.className = 'empty'
  const heading = document.createElement('h2')
  heading.textContent = title
  const text = document.createElement('p')
  text.textContent = copy
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Add workout'
  button.addEventListener('click', () => openEditor(null))
  wrap.append(heading, text, button)
  return wrap
}

function workoutList(groups, now, showHeadings) {
  const list = document.createElement('ul')
  list.className = 'days'
  for (const group of groups) {
    const section = document.createElement('li')
    section.className = 'day'
    if (showHeadings) {
      const heading = document.createElement('h2')
      heading.textContent = dayHeading(group.day, now)
      section.append(heading)
    }
    const items = document.createElement('ul')
    items.className = 'workouts'
    for (const workout of group.workouts) items.append(workoutItem(workout))
    section.append(items)
    list.append(section)
  }
  return list
}

function workoutItem(workout) {
  const item = document.createElement('li')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'workout'
  button.dataset.id = workout.id

  const badge = document.createElement('span')
  badge.className = 'badge'
  badge.setAttribute('aria-hidden', 'true')
  badge.textContent = ICONS[workout.type] ?? ICONS.other

  const text = document.createElement('span')
  text.className = 'workout-text'
  const title = document.createElement('span')
  title.className = 'workout-title'
  title.textContent = typeTitle(workout.type)
  const summary = document.createElement('span')
  summary.className = 'workout-summary'
  summary.textContent = workoutSummary(workout)
  text.append(title, summary)
  if (workout.notes) {
    const notes = document.createElement('span')
    notes.className = 'workout-notes'
    notes.textContent = workout.notes
    text.append(notes)
  }
  button.append(badge, text)
  item.append(button)
  return item
}

function onMainClick(event) {
  const button = event.target.closest('.workout')
  if (!button) return
  const workout = workouts.find((item) => item.id === button.dataset.id)
  if (workout) openEditor(workout)
}

function openEditor(workout) {
  editingId = workout?.id ?? null
  confirmPanel.hidden = true
  formError.hidden = true
  editorTitle.textContent = workout ? 'Edit workout' : 'Add workout'
  deleteButton.hidden = !workout
  typeField.value = workout?.type ?? 'run'
  startField.value = formatDateTimeLocal(workout?.startedAt ?? new Date())
  durationField.value = workout ? String(workout.durationMinutes) : '30'
  distanceField.value = workout?.distanceKilometres == null ? '' : distanceFieldText(workout.distanceKilometres)
  notesField.value = workout?.notes ?? ''
  editor.showModal()
}

async function onSave(event) {
  event.preventDefault()
  const result = validate({
    type: typeField.value,
    startedAt: parseDateTimeLocal(startField.value),
    durationText: durationField.value,
    distanceText: distanceField.value,
    notes: notesField.value,
  })
  if (!result.ok) {
    formError.hidden = false
    formError.textContent = messageFor(result.error)
    return
  }

  const workout = { id: editingId ?? newId(), ...result.value }
  try {
    await putWorkout(workout)
  } catch (error) {
    console.error(error)
    formError.hidden = false
    formError.textContent = 'Could not save this workout on this phone.'
    return
  }

  const index = workouts.findIndex((item) => item.id === workout.id)
  if (index === -1) workouts.push(workout)
  else workouts[index] = workout
  editor.close()
  render()
}

async function onDelete() {
  if (!editingId) return
  const id = editingId
  try {
    await removeWorkout(id)
  } catch (error) {
    console.error(error)
    confirmPanel.hidden = true
    formError.hidden = false
    formError.textContent = 'Could not delete this workout on this phone.'
    return
  }
  workouts = workouts.filter((item) => item.id !== id)
  editor.close()
  render()
}

function showBanner(message) {
  banner.hidden = false
  banner.textContent = message
}

function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `workout-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
