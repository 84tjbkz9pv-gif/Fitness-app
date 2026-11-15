import { RUN_TYPES } from './runs.js'

export function openRunDialog(run, date, actions) {
  const dialog = document.createElement('dialog')
  dialog.className = 'editor'
  const form = document.createElement('form')
  form.className = 'fields'
  const title = document.createElement('h2')
  title.textContent = run ? 'Run' : 'Plan a run'
  const type = selectType(run?.type ?? 'easy')
  const distance = labelled('Target distance (km)', input('decimal', run?.targetDistanceKm ?? ''))
  const pace = labelled('Target pace (min/km)', input('text', paceText(run?.targetPaceMinPerKm), '6:00'))
  const reps = labelled('Reps', input('numeric', run?.intervals?.reps ?? ''))
  const repDistance = labelled('Rep distance (km)', input('decimal', run?.intervals?.distanceKm ?? ''))
  const rest = labelled('Rest (seconds)', input('numeric', run?.intervals?.restSeconds ?? ''))
  const actualDistance = labelled('Actual distance (km)', input('decimal', run?.actualDistanceKm ?? ''))
  const actualMinutes = labelled('Actual time (minutes)', input('numeric', run?.actualMinutes ?? ''))
  const notes = labelled('Notes', input('text', run?.notes ?? ''))
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
  remove.hidden = !run
  remove.addEventListener('click', () => {
    dialog.close()
    actions.deleteRun(run.id)
  })
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'wide secondary'
  close.textContent = 'Close'
  close.addEventListener('click', () => dialog.close())

  function showFields() {
    const intervals = type.input.value === 'intervals'
    distance.label.hidden = intervals
    reps.label.hidden = !intervals
    repDistance.label.hidden = !intervals
    rest.label.hidden = !intervals
  }

  type.input.addEventListener('change', showFields)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const result = actions.parse({
      date: run?.date ?? date,
      type: type.input.value,
      distanceText: distance.input.value,
      paceText: pace.input.value,
      repsText: reps.input.value,
      repDistanceText: repDistance.input.value,
      restText: rest.input.value,
      actualDistanceText: actualDistance.input.value,
      actualMinutesText: actualMinutes.input.value,
      notes: notes.input.value,
    })
    if (!result.ok) {
      error.hidden = false
      error.textContent = result.error
      return
    }
    dialog.close()
    actions.saveRun({ id: run?.id ?? null, date: run?.date ?? date, ...result.value })
  })
  form.append(
    title, type.label, distance.label, reps.label, repDistance.label, rest.label, pace.label,
    actualDistance.label, actualMinutes.label, notes.label, error, save, remove, close,
  )
  dialog.append(form)
  dialog.addEventListener('close', () => dialog.remove())
  document.body.append(dialog)
  dialog.showModal()
  showFields()
}

function paceText(minutesPerKm) {
  if (!(minutesPerKm > 0)) return ''
  const total = Math.round(minutesPerKm * 60)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
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
  field.value = value == null ? '' : String(value)
  if (placeholder) field.placeholder = placeholder
  return field
}

function selectType(value) {
  const field = document.createElement('select')
  for (const item of RUN_TYPES) {
    const option = document.createElement('option')
    option.value = item.id
    option.textContent = item.title
    field.append(option)
  }
  field.value = value
  return labelled('Type', field)
}
