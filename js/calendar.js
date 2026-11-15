import { doneSetCount, exerciseName, sessionMinutes } from './gym.js'
import { durationLabel } from './logic.js'
import {
  calendarMondays,
  dayContent,
  dayNumber,
  isDateKey,
  londonKey,
  weekDays,
  weekdayLabel,
  weekLabel,
} from './plan.js'

export function todayPlanner(state, actions) {
  const wrap = document.createElement('div')
  wrap.className = 'planner'
  wrap.append(weekStrip(state, actions), selectedDay(state, actions))
  return wrap
}

export function calendarView(state, actions) {
  const wrap = document.createElement('div')
  wrap.className = 'calendar'
  const dates = [
    ...state.plans.map((plan) => plan.date),
    ...state.sessions.filter((session) => session.finishedAt).map((session) => londonKey(session.startedAt)),
    ...state.workouts.map((workout) => londonKey(workout.startedAt)),
  ]
  for (const monday of calendarMondays(state.todayKey, dates)) {
    const section = document.createElement('section')
    section.className = 'cal-week'
    const heading = document.createElement('h2')
    heading.textContent = weekLabel(monday)
    section.append(heading)
    for (const date of weekDays(monday)) section.append(calendarDay(date, state, actions))
    wrap.append(section)
  }
  return wrap
}

function weekStrip(state, actions) {
  const strip = document.createElement('div')
  strip.className = 'week-strip'
  strip.append(
    weekArrow('Previous week', '‹', () => actions.shiftWeek(-1)),
    weekDaysRow(state, actions),
    weekArrow('Next week', '›', () => actions.shiftWeek(1)),
  )
  return strip
}

function weekArrow(label, symbol, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'week-arrow'
  button.setAttribute('aria-label', label)
  button.textContent = symbol
  button.addEventListener('click', onClick)
  return button
}

function weekDaysRow(state, actions) {
  const row = document.createElement('div')
  row.className = 'week-days'
  let originX = null
  let swiped = false
  row.addEventListener('touchstart', (event) => {
    originX = event.changedTouches[0].clientX
    swiped = false
  }, { passive: true })
  row.addEventListener('touchend', (event) => {
    if (originX == null) return
    const delta = event.changedTouches[0].clientX - originX
    originX = null
    if (Math.abs(delta) < 48) return
    swiped = true
    actions.shiftWeek(delta > 0 ? -1 : 1)
  }, { passive: true })
  for (const date of weekDays(state.weekMonday)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'week-day'
    if (date === state.todayKey) button.classList.add('today')
    if (date === state.selectedKey) button.classList.add('selected')
    const marked = dayIsMarked(date, state)
    if (marked) button.classList.add('has-dot')
    button.setAttribute('aria-pressed', date === state.selectedKey ? 'true' : 'false')
    button.setAttribute('aria-label', `${weekdayLabel(date)} ${dayNumber(date)}${marked ? ', has a workout' : ''}`)
    const name = document.createElement('span')
    name.className = 'dow'
    name.textContent = weekdayLabel(date)
    const number = document.createElement('span')
    number.className = 'num'
    number.textContent = dayNumber(date)
    const dot = document.createElement('span')
    dot.className = 'dot'
    button.append(name, number, dot)
    button.addEventListener('click', () => {
      if (swiped) {
        swiped = false
        return
      }
      actions.selectDay(date)
    })
    row.append(button)
  }
  return row
}

function selectedDay(state, actions) {
  const wrap = document.createElement('div')
  wrap.className = 'day-card'
  const content = dayContent(state.selectedKey, state)
  appendDayCards(wrap, state.selectedKey, content, state, actions, true)
  if (content.dayPlans.length === 0) wrap.append(restCard(() => chooseRoutine(state.routines, (routine) => actions.addPlan(state.selectedKey, routine.id))))
  return wrap
}

function calendarDay(date, state, actions) {
  const row = document.createElement('div')
  row.className = 'cal-day'
  const label = document.createElement('div')
  label.className = 'cal-label'
  const name = document.createElement('span')
  name.textContent = weekdayLabel(date)
  const number = document.createElement('span')
  number.className = date === state.todayKey ? 'num today' : 'num'
  number.textContent = dayNumber(date)
  label.append(name, number)
  const body = document.createElement('div')
  body.className = 'cal-body'
  const content = dayContent(date, state)
  appendDayCards(body, date, content, state, actions, false)
  if (content.dayPlans.length === 0) {
    body.append(addButton(() => chooseRoutine(state.routines, (routine) => actions.addPlan(date, routine.id))))
  }
  row.append(label, body)
  return row
}

function appendDayCards(parent, date, content, state, actions, withStart) {
  for (const item of content.dayPlans) {
    if (item.session) parent.append(doneCard(item.routine?.name ?? item.session.name, gymSummary(item.session)))
    else if (!item.routine) parent.append(missingCard(item.plan, actions))
    else parent.append(planCard(item, state, actions, withStart))
  }
  for (const session of content.extraSessions) parent.append(doneCard(session.name, gymSummary(session)))
  for (const workout of content.cardio) parent.append(doneCard(workoutTitle(workout), cardioSummary(workout)))
  void date
}

function planCard(item, state, actions, withStart) {
  const card = document.createElement('article')
  card.className = 'plan-card'
  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'plan-open'
  open.textContent = item.routine.name
  open.addEventListener('click', () => chooseMove(item.plan, item.routine.name, actions))
  card.append(open)
  const list = document.createElement('ul')
  list.className = 'plan-exercises'
  for (const exercise of item.routine.exercises) {
    const line = document.createElement('li')
    line.textContent = exerciseName(exercise.exerciseId, state.exercises)
    list.append(line)
  }
  card.append(list)
  if (withStart) {
    const start = document.createElement('button')
    start.type = 'button'
    start.className = 'pill'
    start.textContent = 'Start'
    start.addEventListener('click', () => actions.startPlan(item.plan))
    card.append(start)
  }
  return card
}

function doneCard(name, summary) {
  const card = document.createElement('article')
  card.className = 'plan-card done'
  const top = document.createElement('div')
  top.className = 'plan-top'
  const title = document.createElement('h2')
  title.textContent = name
  const tick = document.createElement('span')
  tick.className = 'done-tick'
  tick.setAttribute('aria-hidden', 'true')
  tick.textContent = '✓'
  top.append(title, tick)
  const line = document.createElement('p')
  line.className = 'plan-summary'
  line.textContent = summary
  card.append(top, line)
  return card
}

function missingCard(plan, actions) {
  const card = document.createElement('article')
  card.className = 'plan-card'
  const title = document.createElement('h2')
  title.textContent = 'Routine deleted'
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'text-add'
  remove.textContent = 'Remove from plan'
  remove.addEventListener('click', () => actions.removePlan(plan.id))
  card.append(title, remove)
  return card
}

function restCard(onAdd) {
  const card = document.createElement('article')
  card.className = 'plan-card rest'
  const title = document.createElement('h2')
  title.textContent = 'Rest day'
  card.append(title, addButton(onAdd))
  return card
}

function addButton(onAdd) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'text-add'
  button.textContent = '+ Add'
  button.addEventListener('click', onAdd)
  return button
}

function chooseRoutine(routines, onPick) {
  const dialog = document.createElement('dialog')
  dialog.className = 'editor'
  const fields = document.createElement('div')
  fields.className = 'fields'
  const title = document.createElement('h2')
  title.textContent = 'Add a routine'
  fields.append(title)
  const sorted = routines.slice().sort((left, right) => left.name.localeCompare(right.name, 'en-GB'))
  if (sorted.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'help'
    empty.textContent = 'Save a routine on Train, then plan it here.'
    fields.append(empty)
  }
  for (const routine of sorted) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'wide secondary'
    button.textContent = routine.name
    button.addEventListener('click', () => {
      dialog.close()
      onPick(routine)
    })
    fields.append(button)
  }
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'wide'
  close.textContent = 'Close'
  close.addEventListener('click', () => dialog.close())
  fields.append(close)
  dialog.append(fields)
  dialog.addEventListener('close', () => dialog.remove())
  document.body.append(dialog)
  dialog.showModal()
}

function chooseMove(plan, name, actions) {
  const dialog = document.createElement('dialog')
  dialog.className = 'editor'
  const form = document.createElement('form')
  form.className = 'fields'
  const title = document.createElement('h2')
  title.textContent = name
  const label = document.createElement('label')
  label.textContent = 'Move to'
  const input = document.createElement('input')
  input.type = 'date'
  input.id = 'move-date'
  input.value = plan.date
  input.required = true
  label.append(input)
  const error = document.createElement('p')
  error.className = 'form-error'
  error.hidden = true
  const move = document.createElement('button')
  move.type = 'submit'
  move.className = 'pill'
  move.textContent = 'Move'
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'danger-text'
  remove.textContent = 'Remove from plan'
  remove.addEventListener('click', () => {
    dialog.close()
    actions.removePlan(plan.id)
  })
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'wide secondary'
  close.textContent = 'Close'
  close.addEventListener('click', () => dialog.close())
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!isDateKey(input.value)) {
      error.hidden = false
      error.textContent = 'Choose a day.'
      return
    }
    dialog.close()
    actions.movePlan(plan.id, input.value)
  })
  form.append(title, label, error, move, remove, close)
  dialog.append(form)
  dialog.addEventListener('close', () => dialog.remove())
  document.body.append(dialog)
  dialog.showModal()
}

function dayIsMarked(date, state) {
  if (state.plans.some((plan) => plan.date === date)) return true
  if (state.sessions.some((session) => session.finishedAt && londonKey(session.startedAt) === date)) return true
  return state.workouts.some((workout) => londonKey(workout.startedAt) === date)
}

function gymSummary(session) {
  const minutes = sessionMinutes(session)
  const sets = doneSetCount(session)
  const minuteLabel = minutes === 1 ? '1 minute' : `${minutes} minutes`
  const setLabel = sets === 1 ? '1 set' : `${sets} sets`
  return `${minuteLabel} · ${setLabel}`
}

function cardioSummary(workout) {
  const parts = [durationLabel(workout.durationMinutes)]
  if (workout.distanceKilometres != null) parts.push(`${workout.distanceKilometres} km`)
  return parts.join(' · ')
}

function workoutTitle(workout) {
  const titles = { run: 'Run', walk: 'Walk', cycle: 'Cycle', strength: 'Strength', swim: 'Swim', yoga: 'Yoga' }
  return titles[workout.type] ?? 'Workout'
}
