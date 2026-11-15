import { durationLabel } from './logic.js'
import { formatKcal } from './food.js'
import {
  goalCountdown,
  planPreview,
  weekdayName,
} from './training-plan.js'

export function goalCard(today, plan, progress) {
  const card = document.createElement('article')
  card.className = 'plan-card goal-card'
  const line = document.createElement('p')
  line.className = 'food-kcal'
  line.textContent = goalCountdown(today, plan.goalDate, plan.rateKgPerWeek)
  card.append(line)
  if (progress.lift) {
    const lift = document.createElement('p')
    lift.className = 'plan-summary'
    const best = progress.lift.best == null ? 'none yet' : `${progress.lift.best} kg`
    lift.textContent = `${progress.lift.name} · ${best} of ${progress.lift.targetKg} kg`
    card.append(lift)
  }
  if (progress.run) {
    const run = document.createElement('p')
    run.className = 'plan-summary'
    const best = progress.run.best == null ? 'none yet' : durationLabel(progress.run.best)
    run.textContent = `${progress.run.distanceKm} km · ${best} of ${durationLabel(progress.run.targetMinutes)}`
    card.append(run)
  }
  return card
}

export function openPlanSetup(state, actions) {
  const dialog = document.createElement('dialog')
  dialog.className = 'editor'
  const form = document.createElement('form')
  form.className = 'fields'
  const title = document.createElement('h2')
  title.textContent = state.plan ? 'Edit plan' : 'Make a plan'
  const goalDate = labelled('Goal date', input('date', state.plan?.goalDate ?? ''))
  const current = labelled('Current weight (kg)', input('decimal', state.plan?.currentWeightKg ?? state.weightKg ?? ''))
  const goalWeight = labelled('Goal weight (kg)', input('decimal', state.plan?.goalWeightKg ?? ''))
  const summary = document.createElement('p')
  summary.className = 'food-kcal'
  const notes = document.createElement('div')
  const days = labelled('Training days a week', selectDays(state.plan?.daysPerWeek ?? 3))
  const weekdays = weekdayToggles(state.plan?.weekdays ?? [0, 2, 4])
  const experience = labelled('Experience', selectExperience(state.plan?.experience ?? 'beginner'))
  const routineBox = routineToggles(state.routines, state.plan?.routineIds)
  const liftName = labelled('Lift goal', input('text', state.plan?.lift?.name ?? '', 'Optional, such as Squat'))
  const liftKg = labelled('Lift target (kg)', input('decimal', state.plan?.lift?.targetKg ?? ''))
  const runDistance = labelled('Run goal (km)', input('decimal', state.plan?.run?.distanceKm ?? '', 'Optional'))
  const runMinutes = labelled('Run target (minutes)', input('numeric', state.plan?.run?.targetMinutes ?? ''))
  const error = document.createElement('p')
  error.className = 'form-error'
  error.hidden = true
  const save = document.createElement('button')
  save.type = 'submit'
  save.className = 'pill'
  save.textContent = state.plan ? 'Update plan' : 'Make plan'
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'wide secondary'
  close.textContent = 'Close'
  close.addEventListener('click', () => dialog.close())

  function readNumber(field) {
    const value = field.value.trim().replace(',', '.')
    if (value === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }

  function selectedDays() {
    return [...weekdays.querySelectorAll('input:checked')].map((box) => Number(box.value))
  }

  function paint() {
    const preview = planPreview({
      today: state.today,
      goalDate: goalDate.input.value,
      currentKg: readNumber(current.input),
      goalKg: readNumber(goalWeight.input),
      profile: state.profile,
    })
    notes.replaceChildren()
    if (!preview.ok) {
      summary.textContent = preview.error
      return
    }
    summary.textContent = goalCountdown(state.today, goalDate.input.value, preview.rate)
    if (preview.target != null) {
      const estimate = document.createElement('p')
      estimate.className = 'help'
      estimate.textContent = `Estimate ${formatKcal(preview.maintenance)} kcal to hold weight, ${formatKcal(preview.target)} kcal for this rate. Estimate from the Mifflin-St Jeor formula, not advice.`
      notes.append(estimate)
    } else {
      const missing = document.createElement('p')
      missing.className = 'help'
      missing.textContent = 'Set height, age, sex and activity under Set target to estimate daily kcal.'
      notes.append(missing)
    }
    for (const note of preview.notes) {
      const line = document.createElement('p')
      line.className = 'help'
      line.textContent = note
      notes.append(line)
    }
  }

  for (const field of [goalDate.input, current.input, goalWeight.input]) field.addEventListener('input', paint)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const preview = planPreview({
      today: state.today,
      goalDate: goalDate.input.value,
      currentKg: readNumber(current.input),
      goalKg: readNumber(goalWeight.input),
      profile: state.profile,
    })
    const chosen = selectedDays()
    const daysPerWeek = Number(days.input.value)
    const routineIds = [...routineBox.querySelectorAll('input:checked')].map((box) => box.value)
    const lift = readPair(liftName.input.value, readNumber(liftKg.input))
    const run = readPair(runDistance.input.value, readNumber(runMinutes.input))
    if (!preview.ok || chosen.length !== daysPerWeek || routineIds.length === 0 || lift === undefined || run === undefined) {
      error.hidden = false
      error.textContent = !preview.ok
        ? preview.error
        : routineIds.length === 0
          ? 'Save a routine on Train, or tick at least one.'
          : lift === undefined || run === undefined
            ? 'Enter both parts of a lift or run goal, or leave both blank.'
            : 'Tick the same number of days as you train each week.'
      return
    }
    dialog.close()
    actions.save({
      goalDate: goalDate.input.value,
      currentWeightKg: readNumber(current.input),
      goalWeightKg: readNumber(goalWeight.input),
      rateKgPerWeek: preview.rate,
      daysPerWeek,
      weekdays: chosen,
      experience: experience.input.value,
      routineIds,
      baseKcal: preview.target,
      lift: lift && { name: liftName.input.value.trim(), targetKg: readNumber(liftKg.input) },
      run: run && {
        distanceKm: Number(runDistance.input.value.trim().replace(',', '.')),
        targetMinutes: readNumber(runMinutes.input),
      },
    })
  })
  form.append(
    title, goalDate.label, current.label, goalWeight.label, summary, notes,
    days.label, weekdays, experience.label, routineBox,
    liftName.label, liftKg.label, runDistance.label, runMinutes.label,
    error, save, close,
  )
  dialog.append(form)
  dialog.addEventListener('close', () => dialog.remove())
  document.body.append(dialog)
  dialog.showModal()
  paint()
}

function readPair(text, number) {
  const filledText = String(text ?? '').trim() !== ''
  const filledNumber = number != null
  if (!filledText && !filledNumber) return null
  if (filledText && filledNumber && number > 0) return true
  return undefined
}

function labelled(text, field) {
  const label = document.createElement('label')
  label.textContent = text
  label.append(field)
  return { label, input: field }
}

function input(mode, value, placeholder = '') {
  const field = document.createElement('input')
  if (mode === 'date') field.type = 'date'
  else field.inputMode = mode === 'text' ? 'text' : mode === 'numeric' ? 'numeric' : 'decimal'
  field.value = value == null ? '' : String(value)
  if (placeholder) field.placeholder = placeholder
  return field
}

function selectDays(value) {
  const field = document.createElement('select')
  for (let day = 2; day <= 6; day += 1) {
    const option = document.createElement('option')
    option.value = String(day)
    option.textContent = String(day)
    field.append(option)
  }
  field.value = String(value)
  return field
}

function selectExperience(value) {
  const field = document.createElement('select')
  for (const [id, text] of [['beginner', 'Beginner'], ['intermediate', 'Intermediate']]) {
    const option = document.createElement('option')
    option.value = id
    option.textContent = text
    field.append(option)
  }
  field.value = value
  return field
}

function weekdayToggles(selected) {
  const wrap = document.createElement('div')
  wrap.className = 'weekday-picks'
  for (let index = 0; index < 7; index += 1) {
    const label = document.createElement('label')
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.value = String(index)
    box.checked = selected.includes(index)
    label.append(box, document.createTextNode(weekdayName(index)))
    wrap.append(label)
  }
  return wrap
}

function routineToggles(routines, selected) {
  const wrap = document.createElement('div')
  wrap.className = 'routine-picks'
  const heading = document.createElement('h2')
  heading.textContent = 'Routines'
  wrap.append(heading)
  if (routines.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'help'
    empty.textContent = 'Save a routine on Train first.'
    wrap.append(empty)
    return wrap
  }
  for (const routine of routines) {
    const label = document.createElement('label')
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.value = routine.id
    box.checked = selected ? selected.includes(routine.id) : true
    label.append(box, document.createTextNode(routine.name))
    wrap.append(label)
  }
  return wrap
}
