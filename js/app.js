import {
  WORKOUT_TYPES,
  dayHeading,
  dayKey,
  distanceFieldText,
  formatDateTimeLocal,
  messageFor,
  parseDateTimeLocal,
  typeTitle,
  parseBackup,
  validate,
  workoutSummary,
  backupFilename,
  createBackup,
} from './logic.js'
import { createTrainer } from './train.js'
import { calendarView, todayPlanner } from './calendar.js'
import { copyMeal, emptyCopyMessage, foodProfileFromStored, yesterdayKey } from './food.js'
import { foodScreen, foodTodayCard, openFoodDialog, openTargetSheet } from './food-view.js'
import { fetchOffProduct } from './off.js'
import { openPortion, openScanner } from './scanner.js'
import { addDays, londonKey, londonLong, mondayOf, movePlan, removePlan } from './plan.js'
import { BUILT_IN_EXERCISES, doneSetCount, sessionMinutes } from './gym.js'
import { decodeRoutineLink, importRoutine } from './routine-link.js'
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
  loadExercises,
  loadFoodProfile,
  loadFoods,
  loadKcalTarget,
  loadPlans,
  loadProducts,
  loadRoutines,
  loadSessions,
  loadWorkouts,
  putExercise,
  putFood,
  putPlan,
  putProduct,
  putRoutine,
  putSession,
  putWorkout,
  deleteFood,
  deletePlan,
  deleteRoutine,
  deleteSession,
  removeWorkout,
  replaceExercises,
  replaceFoods,
  replacePlans,
  replaceRoutines,
  replaceSessions,
  replaceWorkouts,
  saveFoodProfile,
  saveKcalTarget,
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
const tabTrain = document.querySelector('#tab-train')
const tabCalendar = document.querySelector('#tab-calendar')
const tabFood = document.querySelector('#tab-food')
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
const routineLinkDialog = document.querySelector('#routine-link')
const routineLinkTitle = document.querySelector('#routine-link-title')

let workouts = []
let routines = []
let sessions = []
let customExercises = []
let plans = []
let foods = []
let products = []
let kcalTarget = null
let foodProfile = null
let selectedKey = null
let weekMonday = null
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
tabTrain.addEventListener('click', () => showScreen('train'))
tabCalendar.addEventListener('click', () => showScreen('calendar'))
tabFood.addEventListener('click', () => showScreen('food'))
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
document.querySelector('#routine-link-cancel').addEventListener('click', () => {
  clearRoutineHash()
  routineLinkDialog.close()
})
document.querySelector('#routine-link-add').addEventListener('click', async (event) => {
  event.currentTarget.disabled = true
  const result = await importLink(location.hash)
  if (!result?.ok) event.currentTarget.disabled = false
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
document.querySelector('#open-kcal-target').addEventListener('click', () => showCalorieTarget())
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
    let refreshing = false
    const hadController = Boolean(navigator.serviceWorker.controller)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return
      refreshing = true
      window.location.reload()
    })
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
  routines = []
  sessions = []
  customExercises = []
  plans = []
  foods = []
  products = []
  kcalTarget = null
  foodProfile = null
  trainer.reset()
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
    ;[workouts, routines, sessions, customExercises, plans, foods, kcalTarget, foodProfile, products] = await Promise.all([
      loadWorkouts(),
      loadRoutines(),
      loadSessions(),
      loadExercises(),
      loadPlans(),
      loadFoods(),
      loadKcalTarget(),
      loadFoodProfile(),
      loadProducts(),
    ])
    foodProfile = foodProfileFromStored(foodProfile)
    if (foodProfile === undefined) foodProfile = null
  } catch (error) {
    console.error(error)
    workouts = []
    routines = []
    sessions = []
    customExercises = []
    plans = []
    foods = []
    products = []
    kcalTarget = null
    foodProfile = null
    showBanner('Could not open saved workouts on this phone.')
  }
  render()
  offerRoutineLink()
}

function lockApp() {
  unlocked = false
  workouts = []
  routines = []
  sessions = []
  customExercises = []
  plans = []
  foods = []
  products = []
  kcalTarget = null
  foodProfile = null
  selectedKey = null
  weekMonday = null
  trainer.reset()
  hiddenAt = null
  if (editor.open) editor.close()
  if (backupDialog.open) backupDialog.close()
  if (settingsDialog.open) settingsDialog.close()
  if (routineLinkDialog.open) routineLinkDialog.close()
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close()
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
  const titles = { today: 'Today', train: 'Train', calendar: 'Calendar', food: 'Food', history: 'History' }
  screenTitle.textContent = titles[screen]
  const selection = plannerSelection(now)
  screenDate.textContent = screen === 'today' || screen === 'food' ? londonLong(selection.selectedKey) : ''
  screenDate.hidden = screen !== 'today' && screen !== 'food'
  tabToday.setAttribute('aria-current', screen === 'today' ? 'page' : 'false')
  tabTrain.setAttribute('aria-current', screen === 'train' ? 'page' : 'false')
  tabCalendar.setAttribute('aria-current', screen === 'calendar' ? 'page' : 'false')
  tabFood.setAttribute('aria-current', screen === 'food' ? 'page' : 'false')
  tabHistory.setAttribute('aria-current', screen === 'history' ? 'page' : 'false')
  if (screen === 'train') {
    trainer.render(main)
    return
  }
  if (screen === 'calendar') {
    main.replaceChildren(calendarView(plannerState(selection), plannerActions()))
    return
  }
  if (screen === 'food') {
    main.replaceChildren(foodScreen(foodState(selection), foodActions()))
    return
  }
  if (screen === 'today') {
    const today = todayPlanner(plannerState(selection), plannerActions())
    today.append(foodTodayCard(foodState(selection), () => showScreen('food')))
    main.replaceChildren(today)
    return
  }
  main.replaceChildren(historyView(now))
}

function plannerSelection(now) {
  const todayKey = londonKey(now)
  if (!selectedKey || !weekMonday) {
    selectedKey = todayKey
    weekMonday = mondayOf(todayKey)
  }
  return { todayKey, selectedKey, weekMonday }
}

function plannerState(selection) {
  return {
    ...selection,
    plans,
    routines,
    sessions,
    workouts,
    exercises: customExercises,
  }
}

function foodState(selection) {
  return {
    ...selection,
    foods,
    kcalTarget,
    profile: foodProfile,
    weightKg: null,
  }
}

function foodActions() {
  return {
    selectDay(date) {
      selectedKey = date
      weekMonday = mondayOf(date)
      render()
    },
    shiftWeek(delta) {
      selectedKey = addDays(selectedKey, delta * 7)
      weekMonday = addDays(weekMonday, delta * 7)
      render()
    },
    addFood(meal) {
      openFoodDialog({ meal, entry: null, foods, products, date: selectedKey }, foodSaveActions())
    },
    editFood(entry) {
      openFoodDialog({ meal: entry.meal, entry, foods, products, date: entry.date }, foodSaveActions())
    },
    scan(meal) {
      startScan(meal)
    },
    openTarget() {
      showCalorieTarget()
    },
  }
}

function showCalorieTarget() {
  const selection = plannerSelection(new Date())
  openTargetSheet(foodState(selection), {
    rememberProfile(profile) {
      foodProfile = profile
      saveFoodProfile(profile).catch((error) => console.error(error))
    },
    useTarget(profile, target) {
      foodProfile = profile
      kcalTarget = target
      Promise.all([saveFoodProfile(profile), saveKcalTarget(target)])
        .then(() => render())
        .catch((error) => {
          console.error(error)
          showBanner('Could not save this target on this phone.')
        })
    },
    saveTarget(target) {
      kcalTarget = target
      saveKcalTarget(target)
        .then(() => render())
        .catch((error) => {
          console.error(error)
          showBanner('Could not save this target on this phone.')
        })
    },
  })
}

async function saveFood(value) {
  const entry = {
    id: value.id ?? newId(),
    date: value.date,
    meal: value.meal,
    name: value.name,
    amount: value.amount,
    kcal: value.kcal,
    proteinG: value.proteinG,
    carbsG: value.carbsG,
    fatG: value.fatG,
    barcode: value.barcode,
    createdAt: foods.find((item) => item.id === value.id)?.createdAt ?? new Date().toISOString(),
  }
  try {
    await putFood(entry)
  } catch (error) {
    console.error(error)
    showBanner('Could not save this food on this phone.')
    return
  }
  const index = foods.findIndex((item) => item.id === entry.id)
  if (index === -1) foods.push(entry)
  else foods[index] = entry
  render()
}

async function removeFood(id) {
  try {
    await deleteFood(id)
  } catch (error) {
    console.error(error)
    showBanner('Could not delete this food on this phone.')
    return
  }
  foods = foods.filter((item) => item.id !== id)
  render()
}

async function copyYesterday(meal) {
  const fromDate = yesterdayKey(selectedKey)
  const copies = copyMeal(foods, fromDate, selectedKey, meal, newId, new Date().toISOString())
  if (copies.length === 0) {
    showBanner(emptyCopyMessage(meal))
    return
  }
  try {
    for (const entry of copies) await putFood(entry)
  } catch (error) {
    console.error(error)
    showBanner('Could not copy that meal on this phone.')
    return
  }
  foods.push(...copies)
  render()
}

async function addRecent(entry, meal) {
  await saveFood({
    id: null,
    date: selectedKey,
    meal,
    name: entry.name,
    amount: entry.amount,
    kcal: entry.kcal,
    proteinG: entry.proteinG,
    carbsG: entry.carbsG,
    fatG: entry.fatG,
    barcode: entry.barcode,
  })
}

function foodSaveActions() {
  return {
    saveFood,
    deleteFood: removeFood,
    copyYesterday,
    addRecent,
    scan: startScan,
    scanProduct(product, meal) {
      openPortion({ product, meal }, { saveScanned: saveScannedFood })
    },
  }
}

function startScan(meal) {
  openScanner({ meal }, {
    lookup: lookupBarcode,
    notFound(mealId, code) {
      showBanner('Not found')
      openFoodDialog({
        meal: mealId,
        entry: null,
        foods,
        products,
        date: selectedKey,
        barcode: code,
      }, foodSaveActions())
    },
    saveScanned: saveScannedFood,
  })
}

async function lookupBarcode(code) {
  try {
    const result = await fetchOffProduct(code)
    if (!result.found) return { ok: false }
    try {
      await rememberProduct(result.product)
    } catch (error) {
      console.error(error)
    }
    return { ok: true, product: result.product }
  } catch (error) {
    console.error(error)
    const cached = products.find((item) => item.barcode === code)
    if (cached) return { ok: true, product: cached, offline: true }
    return { ok: false }
  }
}

async function rememberProduct(product) {
  const stored = { ...product, updatedAt: new Date().toISOString() }
  await putProduct(stored)
  const index = products.findIndex((item) => item.barcode === stored.barcode)
  if (index === -1) products.push(stored)
  else products[index] = stored
}

function saveScannedFood(value) {
  return saveFood({ ...value, date: selectedKey, id: null })
}

function plannerActions() {
  return {
    selectDay(date) {
      selectedKey = date
      weekMonday = mondayOf(date)
      render()
    },
    shiftWeek(delta) {
      selectedKey = addDays(selectedKey, delta * 7)
      weekMonday = addDays(weekMonday, delta * 7)
      render()
    },
    addPlan: savePlan,
    startPlan(plan) {
      const routine = routines.find((item) => item.id === plan.routineId)
      if (!routine) return
      screen = 'train'
      trainer.startRoutine(routine)
      render()
    },
    movePlan: movePlanned,
    removePlan: dropPlan,
  }
}

async function savePlan(date, routineId) {
  if (plans.some((plan) => plan.date === date && plan.routineId === routineId)) {
    showBanner('That routine is already planned on that day.')
    return
  }
  const plan = { id: newId(), date, routineId }
  try {
    await putPlan(plan)
  } catch (error) {
    console.error(error)
    showBanner('Could not save this plan on this phone.')
    return
  }
  plans.push(plan)
  selectedKey = date
  weekMonday = mondayOf(date)
  render()
}

async function movePlanned(id, date) {
  const result = movePlan(plans, id, date)
  if (!result.ok) {
    showBanner(result.error === 'alreadyPlanned'
      ? 'That routine is already planned on that day.'
      : 'Choose a day.')
    return
  }
  const plan = result.plans.find((item) => item.id === id)
  if (!plan || plan.date === plans.find((item) => item.id === id)?.date) {
    render()
    return
  }
  try {
    await putPlan(plan)
  } catch (error) {
    console.error(error)
    showBanner('Could not move this plan on this phone.')
    return
  }
  plans = result.plans
  selectedKey = plan.date
  weekMonday = mondayOf(plan.date)
  render()
}

async function dropPlan(id) {
  try {
    await deletePlan(id)
  } catch (error) {
    console.error(error)
    showBanner('Could not remove this plan on this phone.')
    return
  }
  plans = removePlan(plans, id)
  render()
}

function historyView(now) {
  const groups = activityGroups()
  if (groups.length === 0) {
    return emptyState(
      'No workouts yet',
      'Workouts you add show up here, grouped by day.',
    )
  }
  return activityList(groups, now, true)
}

function activityGroups() {
  const items = [
    ...workouts.map((workout) => ({ kind: 'cardio', at: workout.startedAt, workout })),
    ...sessions
      .filter((session) => session.finishedAt)
      .map((session) => ({ kind: 'gym', at: session.startedAt, session })),
  ]
  const groups = new Map()
  for (const item of items) {
    const key = dayKey(item.at)
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return [...groups.entries()]
    .sort(([left], [right]) => (left < right ? 1 : left > right ? -1 : 0))
    .map(([key, entries]) => ({
      key,
      day: entries[0].at,
      entries: entries.slice().sort((left, right) => left.at - right.at),
    }))
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

function activityList(groups, now, showHeadings) {
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
    for (const entry of group.entries) items.append(entry.kind === 'gym' ? gymItem(entry.session) : workoutItem(entry.workout))
    section.append(items)
    list.append(section)
  }
  return list
}

function gymItem(session) {
  const item = document.createElement('li')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'workout'
  button.dataset.session = session.id
  const badge = document.createElement('span')
  badge.className = 'badge'
  badge.setAttribute('aria-hidden', 'true')
  badge.textContent = '🏋️'
  const text = document.createElement('span')
  text.className = 'workout-text'
  const title = document.createElement('span')
  title.className = 'workout-title'
  title.textContent = session.name
  const summary = document.createElement('span')
  summary.className = 'workout-summary'
  const minutes = sessionMinutes(session)
  summary.textContent = `${timeLabel(session.startedAt)} · ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} · ${doneSetCount(session)} sets`
  text.append(title, summary)
  button.append(badge, text)
  item.append(button)
  return item
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
  const gymButton = event.target.closest('[data-session]')
  if (gymButton) {
    const session = sessions.find((item) => item.id === gymButton.dataset.session)
    if (!session) return
    screen = 'train'
    trainer.showSession(session)
    render()
    return
  }
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
    [`${JSON.stringify(createBackup(workouts, exportedAt, {
      exercises: customExercises,
      routines,
      sessions,
      plans,
      foods,
      kcalTarget,
      foodProfile,
    }), null, 2)}\n`],
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
  pendingImport = parsed
  importSummary.textContent = importSummaryText(parsed.workouts.length)
  importConfirm.hidden = false
}

async function importBackup() {
  if (!pendingImport) return
  try {
    await replaceWorkouts(pendingImport.workouts)
    await replaceRoutines(pendingImport.routines)
    await replaceSessions(pendingImport.sessions)
    await replaceExercises(pendingImport.exercises)
    await replacePlans(pendingImport.plans ?? [])
    await replaceFoods(pendingImport.foods ?? [])
    await saveKcalTarget(pendingImport.kcalTarget ?? null)
    await saveFoodProfile(pendingImport.foodProfile ?? null)
  } catch (error) {
    console.error(error)
    showBackupMessage('Could not import this backup on this phone.')
    return
  }
  workouts = pendingImport.workouts
  routines = pendingImport.routines
  sessions = pendingImport.sessions
  customExercises = pendingImport.exercises
  plans = pendingImport.plans ?? []
  foods = pendingImport.foods ?? []
  kcalTarget = pendingImport.kcalTarget ?? null
  foodProfile = pendingImport.foodProfile ?? null
  trainer.reset()
  backupDialog.close()
  render()
  showBanner('Backup imported.', 'success')
}

function importSummaryText(count) {
  const tail = 'Importing replaces the workouts, routines, gym sessions, plan, and food log on this phone.'
  if (count === 0) return `This backup has no workouts. ${tail}`
  if (count === 1) return `This backup has 1 workout. ${tail}`
  return `This backup has ${count} workouts. ${tail}`
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

const trainer = createTrainer({
  routines: () => routines,
  sessions: () => sessions,
  exercises: () => customExercises,
  newId,
  refresh() {
    if (unlocked && screen === 'train') render()
  },
  async putRoutine(routine) {
    await putRoutine(routine)
    upsert(routines, routine)
  },
  async deleteRoutine(id) {
    await deleteRoutine(id)
    routines = routines.filter((routine) => routine.id !== id)
    const kept = plans.filter((plan) => plan.routineId !== id)
    if (kept.length !== plans.length) {
      plans = kept
      await replacePlans(plans)
    }
  },
  async putSession(session) {
    await putSession(session)
    upsert(sessions, session)
  },
  async deleteSession(id) {
    await deleteSession(id)
    sessions = sessions.filter((session) => session.id !== id)
  },
  async putExercise(exercise) {
    await putExercise(exercise)
    upsert(customExercises, exercise)
  },
  importLink,
})

function offerRoutineLink() {
  const decoded = decodeRoutineLink(location.hash)
  if (!decoded.ok || routineLinkDialog.open) return
  routineLinkTitle.textContent = `Add routine “${decoded.routine.name}”?`
  routineLinkDialog.showModal()
}

function clearRoutineHash() {
  if (!location.hash.startsWith('#routine=')) return
  history.replaceState(null, '', `${location.pathname}${location.search}`)
}

async function importLink(text) {
  const planned = importRoutine(text, {
    builtIn: BUILT_IN_EXERCISES,
    exercises: customExercises,
    routines,
    newId,
  })
  if (!planned.ok) return { ok: false }
  for (const exercise of planned.newExercises) {
    await putExercise(exercise)
    customExercises.push(exercise)
  }
  await putRoutine(planned.routine)
  routines.push(planned.routine)
  clearRoutineHash()
  if (routineLinkDialog.open) routineLinkDialog.close()
  showScreen('train')
  showBanner(`Added “${planned.routine.name}”.`, 'success')
  return { ok: true }
}

function upsert(list, record) {
  const index = list.findIndex((item) => item.id === record.id)
  if (index === -1) list.push(record)
  else list[index] = record
}

function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `workout-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
