export const BUILT_IN_EXERCISES = [
  { id: 'bench-press', name: 'Bench press' },
  { id: 'squat', name: 'Squat' },
  { id: 'deadlift', name: 'Deadlift' },
  { id: 'overhead-press', name: 'Overhead press' },
  { id: 'bent-over-row', name: 'Bent-over row' },
  { id: 'pull-up', name: 'Pull-up' },
  { id: 'lat-pulldown', name: 'Lat pulldown' },
  { id: 'seated-row', name: 'Seated row' },
  { id: 'romanian-deadlift', name: 'Romanian deadlift' },
  { id: 'leg-press', name: 'Leg press' },
  { id: 'hip-thrust', name: 'Hip thrust' },
  { id: 'biceps-curl', name: 'Biceps curl' },
  { id: 'triceps-pushdown', name: 'Triceps pushdown' },
  { id: 'lateral-raise', name: 'Lateral raise' },
  { id: 'face-pull', name: 'Face pull' },
  { id: 'calf-raise', name: 'Calf raise' },
  { id: 'walking-lunge', name: 'Walking lunge' },
  { id: 'dip', name: 'Dip' },
]

export function exerciseName(id, custom = []) {
  return BUILT_IN_EXERCISES.find((item) => item.id === id)?.name
    ?? custom.find((item) => item.id === id)?.name
    ?? 'Exercise'
}

export function exerciseChoices(custom = []) {
  const extra = custom
    .filter((item) => !BUILT_IN_EXERCISES.some((builtIn) => builtIn.id === item.id))
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, 'en-GB'))
  return [...BUILT_IN_EXERCISES, ...extra]
}

/** Epley estimate. Label it as estimated; it is not a measured maximum. */
export function epley1Rm(weightKg, reps) {
  if (!(weightKg > 0) || !Number.isInteger(reps) || reps <= 0) return null
  return weightKg * (1 + reps / 30)
}

export function formatKg(value) {
  if (!Number.isFinite(value)) return ''
  const scaled = Math.round(Math.abs(value) * 100)
  const whole = Math.floor(scaled / 100)
  const fraction = scaled % 100
  const digits = fraction === 0
    ? String(whole)
    : fraction % 10 === 0
      ? `${whole}.${fraction / 10}`
      : `${whole}.${String(fraction).padStart(2, '0')}`
  return value < 0 ? `-${digits}` : digits
}

export function formatSet(weightKg, reps) {
  return `${formatKg(weightKg)} kg × ${reps}`
}

export function parseKg(text) {
  const trimmed = String(text ?? '').trim().replace(',', '.')
  if (trimmed === '') return { ok: true, value: null }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, value: null }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value <= 0) return { ok: false, value: null }
  return { ok: true, value }
}

export function parseReps(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed === '') return { ok: true, value: null }
  if (!/^\d+$/.test(trimmed)) return { ok: false, value: null }
  const value = Number(trimmed)
  if (!Number.isSafeInteger(value) || value <= 0) return { ok: false, value: null }
  return { ok: true, value }
}

export function previousSet(sessions, { exerciseId, setIndex, before }) {
  const beforeMs = before instanceof Date ? before.getTime() : before
  const last = sessions
    .filter((session) => session.finishedAt && session.startedAt.getTime() < beforeMs)
    .filter((session) => session.exercises.some((exercise) => exercise.exerciseId === exerciseId))
    .sort((left, right) => right.startedAt - left.startedAt)[0]
  if (!last) return null
  const exercise = last.exercises.find((item) => item.exerciseId === exerciseId)
  const set = exercise?.sets[setIndex]
  if (!set || !(set.reps > 0)) return null
  if (set.weightKg != null && !(set.weightKg > 0)) return null
  return { weightKg: set.weightKg ?? null, reps: set.reps }
}

export function bestsFromSets(sets) {
  let heaviest = null
  let estimated1Rm = null
  let bestVolume = null
  for (const set of sets) {
    if (set.warmUp || !(set.weightKg > 0) || !(set.reps > 0)) continue
    if (!heaviest || set.weightKg > heaviest.weightKg) {
      heaviest = { weightKg: set.weightKg, reps: set.reps }
    }
    const estimate = epley1Rm(set.weightKg, set.reps)
    if (!estimated1Rm || estimate > estimated1Rm.value) {
      estimated1Rm = { value: estimate, weightKg: set.weightKg, reps: set.reps }
    }
    const volume = set.weightKg * set.reps
    if (!bestVolume || volume > bestVolume.value) {
      bestVolume = { value: volume, weightKg: set.weightKg, reps: set.reps }
    }
  }
  return { heaviest, estimated1Rm, bestVolume }
}

export function doneSetsBefore(sessions, exerciseId, sessionId) {
  const sets = []
  for (const session of sessions) {
    if (!session.finishedAt || session.id === sessionId) continue
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue
      for (const set of exercise.sets) {
        if (set.done && !set.warmUp) sets.push(set)
      }
    }
  }
  return sets
}

export function badgesForSet(set, earlierSets) {
  if (!set?.done || set.warmUp || !(set.weightKg > 0) || !(set.reps > 0)) return []
  const prior = bestsFromSets(earlierSets)
  const badges = []
  if (!prior.heaviest || set.weightKg > prior.heaviest.weightKg) badges.push('weight')
  const estimate = epley1Rm(set.weightKg, set.reps)
  if (!prior.estimated1Rm || estimate > prior.estimated1Rm.value) badges.push('estimated1Rm')
  const volume = set.weightKg * set.reps
  if (!prior.bestVolume || volume > prior.bestVolume.value) badges.push('volume')
  return badges
}

export function newPersonalBests(session, earlierSessions) {
  const found = []
  for (const exercise of session.exercises) {
    const historical = doneSetsBefore(earlierSessions, exercise.exerciseId, session.id)
    const prior = bestsFromSets(historical)
    const current = exercise.sets.filter((set) => set.done)
    const combined = bestsFromSets([...historical, ...current])
    const records = []
    if (combined.heaviest && (!prior.heaviest || combined.heaviest.weightKg > prior.heaviest.weightKg)) {
      records.push({ kind: 'weight', weightKg: combined.heaviest.weightKg, reps: combined.heaviest.reps })
    }
    if (
      combined.estimated1Rm
      && (!prior.estimated1Rm || combined.estimated1Rm.value > prior.estimated1Rm.value)
    ) {
      records.push({
        kind: 'estimated1Rm',
        value: combined.estimated1Rm.value,
        weightKg: combined.estimated1Rm.weightKg,
        reps: combined.estimated1Rm.reps,
      })
    }
    if (combined.bestVolume && (!prior.bestVolume || combined.bestVolume.value > prior.bestVolume.value)) {
      records.push({
        kind: 'volume',
        value: combined.bestVolume.value,
        weightKg: combined.bestVolume.weightKg,
        reps: combined.bestVolume.reps,
      })
    }
    if (records.length) found.push({ exerciseId: exercise.exerciseId, records })
  }
  return found
}

export function exerciseSeries(sessions, exerciseId) {
  return sessions
    .filter((session) => session.finishedAt && session.exercises.some((exercise) => exercise.exerciseId === exerciseId))
    .slice()
    .sort((left, right) => left.startedAt - right.startedAt)
    .map((session) => {
      const exercise = session.exercises.find((item) => item.exerciseId === exerciseId)
      const bests = bestsFromSets(exercise.sets.filter((set) => set.done))
      return {
        sessionId: session.id,
        name: session.name,
        startedAt: session.startedAt,
        heaviest: bests.heaviest?.weightKg ?? null,
        estimated1Rm: bests.estimated1Rm?.value ?? null,
      }
    })
}

export function plansMatch(routine, session) {
  if (!routine || routine.exercises.length !== session.exercises.length) return false
  return routine.exercises.every((exercise, index) => {
    const actual = session.exercises[index]
    if (!actual || exercise.exerciseId !== actual.exerciseId || exercise.sets.length !== actual.sets.length) return false
    return exercise.sets.every((planned, setIndex) => {
      const logged = actual.sets[setIndex]
      if (!logged?.done) return true
      return planned.reps === logged.reps && planned.weightKg === logged.weightKg
    })
  })
}

export function routineFromSession(session, routine = null) {
  return session.exercises
    .map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      repsOnly: exercise.repsOnly === true,
      sets: exercise.sets.map((set, setIndex) => {
        const planned = routine?.exercises[index]?.exerciseId === exercise.exerciseId
          ? routine.exercises[index].sets[setIndex]
          : null
        return {
          reps: set.reps ?? planned?.reps ?? null,
          weightKg: set.weightKg ?? planned?.weightKg ?? null,
          warmUp: set.warmUp === true || planned?.warmUp === true,
        }
      }),
    }))
    .filter((exercise) => exercise.sets.length > 0)
}

export function sessionMinutes(session) {
  if (!session.finishedAt) return null
  const minutes = Math.round((session.finishedAt.getTime() - session.startedAt.getTime()) / 60000)
  return Math.max(1, minutes)
}

export function doneSetCount(session) {
  return session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.done && !set.warmUp).length,
    0,
  )
}

export function sessionVolumeKg(session) {
  let total = 0
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (!set.done || set.warmUp || !(set.weightKg > 0) || !(set.reps > 0)) continue
      total += set.weightKg * set.reps
    }
  }
  return total
}

export function referenceText(weightKg, reps, repsOnly) {
  if (reps == null) return '—'
  if (repsOnly) return String(reps)
  if (weightKg == null) return `– x ${reps}`
  return `${formatKg(weightKg)}kg x ${reps}`
}

export function setBadge(sets, index) {
  if (sets[index]?.warmUp) return 'W'
  return String(sets.slice(0, index + 1).filter((set) => !set.warmUp).length)
}
