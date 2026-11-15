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
  parseBackup,
  validate,
  workoutSummary,
  workoutsOnDay,
  backupFilename,
  createBackup,
} from './logic.js'
import {
  createPinRecord,
  lockoutRemainingMs,
  messageForPin,
  nextLockout,
  pinError,
  shouldLockAfterBackground,
  verifyPin,
  waitLabel,
} from './pin.js'
import {
  keepDataOnThisPhone,
  loadLockout,
  loadPinRecord,
  loadWorkouts,
  putWorkout,
  removeWorkout,
  replaceWorkouts,
  saveLockout,
  savePinRecord,
  wipeAllData,
} from './storage.js'

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
const backupDialog = document.querySelector('#backup')
const backupMessage = document.querySelector('#backup-message')
const importConfirm = document.querySelector('#import-confirm')
const importSummary = document.querySelector('#import-summary')
const backupFile = document.querySelector('#backup-file')

const gate = document.querySelector('#gate')
const gateStatus = document.querySelector('#gate-status')
const shell = document.querySelector('#shell')
const setupForm = document.querySelector('#setup-form')
const unlockForm = document.querySelector('#unlock-form')
const resetForm = document.querySelector('#reset-form')
const setupError = document.querySelector('#setup-error')
const unlockError = document.querySelector('#unlock-error')
const unlockButton = document.querySelector('#unlock-button')
const unlockPin = document.querySelector('#unlock-pin')
const settingsDialog = document.querySelector('#settings')
const settingsError = document.querySelector('#settings-error')

let workouts = []
let screen = 'today'
let editingId = null
let pendingImport = null
let pinRecord = null
let lockout = { failures: 0, lockedUntil: 0 }
let unlocked = false
let hiddenAt = null
let lockTimer = null

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
document.querySelector('#backup-button').addEventListener('click', openBackup)
document.querySelector('#backup-close').addEventListener('click', () => backupDialog.close())
document.querySelector('#backup-form').addEventListener('submit', (event) => event.preventDefault())
document.querySelector('#export-backup').addEventListener('click', exportBackup)
document.querySelector('#import-backup').addEventListener('click', () => backupFile.click())
backupFile.addEventListener('change', onBackupFile)
document.querySelector('#import-cancel').addEventListener('click', clearPendingImport)
document.querySelector('#import-replace').addEventListener('click', importBackup)
backupDialog.addEventListener('close', clearPendingImport)
setupForm.addEventListener('submit', onSetPin)
unlockForm.addEventListener('submit', onUnlock)
document.querySelector('#forgot-pin').addEventListener('click', () => showGate('reset'))
document.querySelector('#reset-cancel').addEventListener('click', () => showGate('unlock'))
resetForm.addEventListener('submit', onReset)
document.querySelector('#settings-button').addEventListener('click', openSettings)
document.querySelector('#settings-close').addEventListener('click', () => settingsDialog.close())
document.querySelector('#pin-change-form').addEventListener('submit', onChangePin)
document.addEventListener('visibilitychange', onVisibility)

start().catch((error) => {
  console.error(error)
  gateStatus.hidden = false
  gateStatus.textContent = 'Could not open Fitness on this phone.'
})

async function start() {
  pinRecord = await loadPinRecord()
  lockout = await loadLockout()
  if (pinRecord) showGate('unlock')
  else showGate('setup')
  keepDataOnThisPhone()
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // The page still works. The copy on the phone is updated the next time it can reach the site.
    })
  }
}

function showGate(which) {
  gate.hidden = false
  shell.hidden = true
  gateStatus.hidden = true
  setupForm.hidden = which !== 'setup'
  unlockForm.hidden = which !== 'unlock'
  resetForm.hidden = which !== 'reset'
  if (which === 'unlock') armLockoutTimer()
}

async function onSetPin(event) {
  event.preventDefault()
  const pin = document.querySelector('#setup-pin').value
  const again = document.querySelector('#setup-pin-again').value
  const format = pinError(pin)
  if (format) {
    showFormError(setupError, messageForPin(format))
    return
  }
  if (pin !== again) {
    showFormError(setupError, messageForPin('pinMismatch'))
    return
  }
  pinRecord = await createPinRecord(pin)
  await savePinRecord(pinRecord)
  document.querySelector('#setup-pin').value = ''
  document.querySelector('#setup-pin-again').value = ''
  setupError.hidden = true
  await unlockApp()
}

async function onUnlock(event) {
  event.preventDefault()
  const now = Date.now()
  const wait = lockoutRemainingMs(lockout, now)
  if (wait > 0) {
    showFormError(unlockError, `Try again in ${waitLabel(wait)}.`)
    armLockoutTimer()
    return
  }
  const pin = unlockPin.value
  if (pinError(pin)) {
    showFormError(unlockError, messageForPin('pinFormat'))
    return
  }
  const correct = await verifyPin(pin, pinRecord)
  lockout = nextLockout(lockout, Date.now(), correct)
  await saveLockout(lockout)
  unlockPin.value = ''
  if (!correct) {
    const again = lockoutRemainingMs(lockout, Date.now())
    showFormError(unlockError, again > 0
      ? `${messageForPin('pinWrong')} Try again in ${waitLabel(again)}.`
      : messageForPin('pinWrong'))
    armLockoutTimer()
    return
  }
  unlockError.hidden = true
  await unlockApp()
}

async function onReset(event) {
  event.preventDefault()
  await wipeAllData()
  pinRecord = null
  lockout = { failures: 0, lockedUntil: 0 }
  unlocked = false
  workouts = []
  clearInterval(lockTimer)
  document.querySelector('#setup-pin').value = ''
  document.querySelector('#setup-pin-again').value = ''
  showGate('setup')
}

function openSettings() {
  settingsError.hidden = true
  document.querySelector('#current-pin').value = ''
  document.querySelector('#new-pin').value = ''
  document.querySelector('#new-pin-again').value = ''
  settingsDialog.showModal()
}

async function onChangePin(event) {
  event.preventDefault()
  const now = Date.now()
  const wait = lockoutRemainingMs(lockout, now)
  if (wait > 0) {
    showFormError(settingsError, `Try again in ${waitLabel(wait)}.`)
    return
  }
  const current = document.querySelector('#current-pin').value
  const next = document.querySelector('#new-pin').value
  const again = document.querySelector('#new-pin-again').value
  if (pinError(current)) {
    showFormError(settingsError, messageForPin('pinFormat'))
    return
  }
  const correct = await verifyPin(current, pinRecord)
  lockout = nextLockout(lockout, Date.now(), correct)
  await saveLockout(lockout)
  if (!correct) {
    document.querySelector('#current-pin').value = ''
    const remaining = lockoutRemainingMs(lockout, Date.now())
    showFormError(settingsError, remaining > 0
      ? `${messageForPin('pinWrong')} Try again in ${waitLabel(remaining)}.`
      : messageForPin('pinWrong'))
    return
  }
  const format = pinError(next)
  if (format) {
    showFormError(settingsError, messageForPin(format))
    return
  }
  if (next !== again) {
    showFormError(settingsError, messageForPin('pinMismatch'))
    return
  }
  pinRecord = await createPinRecord(next)
  await savePinRecord(pinRecord)
  document.querySelector('#current-pin').value = ''
  document.querySelector('#new-pin').value = ''
  document.querySelector('#new-pin-again').value = ''
  settingsDialog.close()
  showBanner('PIN changed.', 'success')
}

async function unlockApp() {
  unlocked = true
  hiddenAt = null
  clearInterval(lockTimer)
  unlockButton.disabled = false
  gate.hidden = true
  shell.hidden = false
  try {
    workouts = await loadWorkouts()
  } catch (error) {
    console.error(error)
    workouts = []
    showBanner('Could not open saved workouts on this phone.')
  }
  render()
}

function lockApp() {
  unlocked = false
  workouts = []
  hiddenAt = null
  if (editor.open) editor.close()
  if (backupDialog.open) backupDialog.close()
  if (settingsDialog.open) settingsDialog.close()
  main.replaceChildren()
  shell.hidden = true
  unlockPin.value = ''
  showGate('unlock')
}

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    if (unlocked) hiddenAt = Date.now()
    return
  }
  if (unlocked && shouldLockAfterBackground(hiddenAt, Date.now())) lockApp()
}

function armLockoutTimer() {
  clearInterval(lockTimer)
  const tick = () => {
    const wait = lockoutRemainingMs(lockout, Date.now())
    unlockButton.disabled = wait > 0
    if (wait <= 0) {
      clearInterval(lockTimer)
      return
    }
    unlockError.hidden = false
    unlockError.textContent = `Try again in ${waitLabel(wait)}.`
  }
  tick()
  if (lockoutRemainingMs(lockout, Date.now()) > 0) lockTimer = setInterval(tick, 250)
}

function showFormError(element, message) {
  element.hidden = false
  element.textContent = message
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

function openBackup() {
  clearPendingImport()
  backupMessage.hidden = true
  backupDialog.showModal()
}

async function exportBackup() {
  backupMessage.hidden = true
  const exportedAt = new Date()
  const file = new File(
    [`${JSON.stringify(createBackup(workouts, exportedAt), null, 2)}\n`],
    backupFilename(exportedAt),
    { type: 'application/json' },
  )
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Fitness backup' })
      return
    }
  } catch (error) {
    if (error?.name === 'AbortError') return
  }
  downloadFile(file)
}

function downloadFile(file) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function onBackupFile() {
  const file = backupFile.files?.[0]
  if (!file) return
  let text
  try {
    text = await file.text()
  } catch (error) {
    backupFile.value = ''
    console.error(error)
    showBackupMessage('Could not read that file.')
    return
  }
  backupFile.value = ''
  clearPendingImport()
  const parsed = parseBackup(text)
  if (!parsed.ok) {
    showBackupMessage(messageFor(parsed.error))
    return
  }
  pendingImport = parsed.workouts
  importSummary.textContent = importSummaryText(parsed.workouts.length)
  importConfirm.hidden = false
}

async function importBackup() {
  if (!pendingImport) return
  try {
    await replaceWorkouts(pendingImport)
  } catch (error) {
    console.error(error)
    showBackupMessage('Could not import this backup on this phone.')
    return
  }
  workouts = pendingImport
  backupDialog.close()
  render()
  showBanner('Backup imported.', 'success')
}

function importSummaryText(count) {
  if (count === 0) return 'This backup has no workouts. Importing removes the workouts on this phone.'
  if (count === 1) return 'This backup has 1 workout. Importing replaces the workouts on this phone.'
  return `This backup has ${count} workouts. Importing replaces the workouts on this phone.`
}

function showBackupMessage(message) {
  backupMessage.hidden = false
  backupMessage.textContent = message
}

function clearPendingImport() {
  pendingImport = null
  importConfirm.hidden = true
}

function showBanner(message, kind = 'error') {
  banner.hidden = false
  banner.textContent = message
  banner.classList.toggle('success', kind === 'success')
}

function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `workout-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
