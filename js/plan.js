const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEK_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

export function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
}

export function londonKey(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type).value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function addDays(key, days) {
  const [year, month, day] = key.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  const pad = (number) => String(number).padStart(2, '0')
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`
}

export function weekdayIndex(key) {
  const [year, month, day] = key.split('-').map(Number)
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

export function weekdayLabel(key) {
  return WEEK_LABELS[weekdayIndex(key)]
}

export function dayNumber(key) {
  return String(Number(key.slice(8)))
}

export function mondayOf(key) {
  return addDays(key, -weekdayIndex(key))
}

export function weekDays(mondayKey) {
  return Array.from({ length: 7 }, (_, index) => addDays(mondayKey, index))
}

export function weekLabel(mondayKey) {
  return `${shortDay(mondayKey)} - ${shortDay(addDays(mondayKey, 6))}`
}

export function londonLong(key) {
  const [year, month, day] = key.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${weekday}, ${day} ${MONTHS[month - 1]} ${year}`
}

export function shortDay(key) {
  const [, month, day] = key.split('-').map(Number)
  return `${day} ${MONTHS_SHORT[month - 1]}`
}

export function calendarMondays(todayKey, dates) {
  const mondays = new Set()
  const start = addDays(mondayOf(todayKey), -7)
  const last = addDays(mondayOf(todayKey), 7 * 5)
  for (let monday = start; monday <= last; monday = addDays(monday, 7)) mondays.add(monday)
  for (const date of dates) {
    if (isDateKey(date)) mondays.add(mondayOf(date))
  }
  return [...mondays].sort()
}

export function planFromStored(stored) {
  if (!stored || typeof stored.id !== 'string' || stored.id === '') return null
  if (typeof stored.routineId !== 'string' || stored.routineId === '') return null
  if (!isDateKey(stored.date)) return null
  if (stored.source != null && stored.source !== 'plan') return null
  const plan = { id: stored.id, date: stored.date, routineId: stored.routineId }
  if (stored.source === 'plan') plan.source = 'plan'
  return plan
}

export function planToStored(plan) {
  const stored = { id: plan.id, date: plan.date, routineId: plan.routineId }
  if (plan.source === 'plan') stored.source = 'plan'
  return stored
}

export const HOLD_MS = 400
export const HOLD_SLOP_PX = 10

export function shouldStartDrag(elapsedMs, distancePx) {
  return elapsedMs >= HOLD_MS && distancePx <= HOLD_SLOP_PX
}

export function rowAtPoint(rows, x, y) {
  for (const row of rows) {
    if (x >= row.left && x <= row.right && y >= row.top && y <= row.bottom) return row.date
  }
  return null
}

export function dropAction(plans, planId, fromDate, toDate, takenDates = []) {
  if (!toDate || toDate === fromDate) return { action: 'cancel' }
  if (takenDates.includes(toDate)) return { action: 'blocked' }
  const result = movePlan(plans, planId, toDate)
  if (!result.ok) return { action: result.error === 'alreadyPlanned' ? 'blocked' : 'cancel' }
  return { action: 'move', plans: result.plans }
}

export function movePlan(plans, id, dateKey) {
  if (!isDateKey(dateKey)) return { ok: false }
  const current = plans.find((plan) => plan.id === id)
  if (!current) return { ok: false }
  if (current.date === dateKey) return { ok: true, plans }
  const clash = plans.some((plan) => plan.id !== id && plan.routineId === current.routineId && plan.date === dateKey)
  if (clash) return { ok: false, error: 'alreadyPlanned' }
  return {
    ok: true,
    plans: plans.map((plan) => (plan.id === id ? { ...plan, date: dateKey } : plan)),
  }
}

export function removePlan(plans, id) {
  return plans.filter((plan) => plan.id !== id)
}

export function dayContent(date, { plans, routines, sessions, workouts }) {
  const dayPlans = plans.filter((plan) => plan.date === date).map((plan) => ({
    plan,
    routine: routines.find((routine) => routine.id === plan.routineId) ?? null,
    session: sessions.find((session) => (
      session.finishedAt
      && session.routineId === plan.routineId
      && londonKey(session.startedAt) === date
    )) ?? null,
  }))
  const used = new Set(dayPlans.map((item) => item.session?.id).filter(Boolean))
  const extraSessions = sessions.filter((session) => (
    session.finishedAt
    && londonKey(session.startedAt) === date
    && !used.has(session.id)
  ))
  const cardio = workouts.filter((workout) => londonKey(workout.startedAt) === date)
  return { dayPlans, extraSessions, cardio }
}
