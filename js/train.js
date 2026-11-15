import {
  badgesForSet,
  bestsFromSets,
  doneSetCount,
  doneSetsBefore,
  exerciseChoices,
  exerciseName,
  exerciseSeries,
  formatKg,
  formatSet,
  newPersonalBests,
  parseKg,
  parseReps,
  plansMatch,
  previousSet,
  routineFromSession,
  sessionMinutes,
} from './gym.js'
import { longDate, timeLabel } from './logic.js'

export function createTrainer(api) {
  let mode = 'home'
  let routineDraft = null
  let sessionDraft = null
  let progressId = null
  let chartKey = 'estimated1Rm'
  let picking = false
  let customName = ''
  let confirmDeleteId = null
  let finishNote = null
  let routineMessage = ''

  function reset() {
    mode = 'home'
    routineDraft = null
    sessionDraft = null
    progressId = null
    picking = false
    confirmDeleteId = null
    finishNote = null
  }

  function render(container) {
    container.replaceChildren(view())
  }

  function view() {
    if (mode === 'routine') return routineView()
    if (mode === 'workout') return workoutView()
    if (mode === 'progress') return progressView()
    if (mode === 'finish') return finishView()
    if (mode === 'detail') return detailView()
    return homeView()
  }

  function homeView() {
    const wrap = document.createElement('div')
    wrap.className = 'train'
    const active = api.sessions().find((session) => !session.finishedAt)
    if (active) {
      const resume = document.createElement('button')
      resume.type = 'button'
      resume.className = 'wide'
      resume.textContent = `Resume ${active.name}`
      resume.addEventListener('click', () => openSession(active))
      wrap.append(resume)
    }
    const empty = document.createElement('button')
    empty.type = 'button'
    empty.className = 'wide secondary'
    empty.textContent = 'Start empty workout'
    empty.addEventListener('click', () => startEmpty())
    wrap.append(empty)

    const heading = document.createElement('h2')
    heading.className = 'section-label'
    heading.textContent = 'Routines'
    wrap.append(heading)

    const routines = api.routines().slice().sort((left, right) => left.name.localeCompare(right.name, 'en-GB'))
    if (routines.length === 0) {
      const none = document.createElement('p')
      none.className = 'help'
      none.textContent = 'Save a routine, such as Push day, then start it next time.'
      wrap.append(none)
    }
    const list = document.createElement('ul')
    list.className = 'workouts'
    for (const routine of routines) {
      const item = document.createElement('li')
      item.className = 'routine-row'
      const start = document.createElement('button')
      start.type = 'button'
      start.className = 'workout'
      const text = document.createElement('span')
      text.className = 'workout-text'
      const title = document.createElement('span')
      title.className = 'workout-title'
      title.textContent = routine.name
      const summary = document.createElement('span')
      summary.className = 'workout-summary'
      summary.textContent = routine.exercises.map((exercise) => exerciseName(exercise.exerciseId, api.exercises())).join(', ')
      text.append(title, summary)
      start.append(text)
      start.addEventListener('click', () => startFromRoutine(routine))
      const edit = document.createElement('button')
      edit.type = 'button'
      edit.className = 'quiet'
      edit.textContent = 'Edit'
      edit.addEventListener('click', () => editRoutine(routine))
      item.append(start, edit)
      list.append(item)
    }
    wrap.append(list)

    const create = document.createElement('button')
    create.type = 'button'
    create.className = 'wide'
    create.textContent = 'New routine'
    create.addEventListener('click', () => editRoutine(null))
    wrap.append(create)

    const exercisesHeading = document.createElement('h2')
    exercisesHeading.className = 'section-label'
    exercisesHeading.textContent = 'Exercises'
    wrap.append(exercisesHeading)
    const used = new Map()
    for (const session of api.sessions()) {
      if (!session.finishedAt) continue
      for (const exercise of session.exercises) used.set(exercise.exerciseId, exerciseName(exercise.exerciseId, api.exercises()))
    }
    if (used.size === 0) {
      const none = document.createElement('p')
      none.className = 'help'
      none.textContent = 'Finish a gym workout to see progress here.'
      wrap.append(none)
    } else {
      const exerciseList = document.createElement('ul')
      exerciseList.className = 'workouts'
      for (const [id, name] of [...used.entries()].sort((left, right) => left[1].localeCompare(right[1], 'en-GB'))) {
        const item = document.createElement('li')
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'workout'
        button.textContent = name
        button.addEventListener('click', () => openProgress(id))
        item.append(button)
        exerciseList.append(item)
      }
      wrap.append(exerciseList)
    }
    return wrap
  }

  function editRoutine(routine) {
    routineDraft = routine
      ? structuredClone(routine)
      : { id: api.newId(), name: '', exercises: [] }
    confirmDeleteId = null
    picking = false
    mode = 'routine'
    api.refresh()
  }

  function routineView() {
    const wrap = document.createElement('form')
    wrap.className = 'train'
    wrap.addEventListener('submit', (event) => {
      event.preventDefault()
      saveRoutine()
    })
    wrap.append(bar('Close', routineDraft.id && api.routines().some((item) => item.id === routineDraft.id) ? 'Edit routine' : 'New routine', 'Save', () => {
      mode = 'home'
      api.refresh()
    }))
    const name = document.createElement('input')
    name.value = routineDraft.name
    name.placeholder = 'Routine name'
    name.maxLength = 40
    name.addEventListener('input', () => {
      routineDraft.name = name.value
    })
    wrap.append(field('Name', name))
    if (routineMessage) {
      const message = document.createElement('p')
      message.className = 'form-error'
      message.textContent = routineMessage
      wrap.append(message)
    }
    wrap.append(...exerciseEditors(routineDraft, false))
    if (picking) wrap.append(picker(routineDraft))
    else {
      const add = document.createElement('button')
      add.type = 'button'
      add.className = 'wide secondary'
      add.textContent = 'Add exercise'
      add.addEventListener('click', () => {
        picking = true
        api.refresh()
      })
      wrap.append(add)
    }
    if (api.routines().some((item) => item.id === routineDraft.id)) {
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'danger-text'
      remove.textContent = 'Delete routine'
      remove.addEventListener('click', () => {
        confirmDeleteId = routineDraft.id
        api.refresh()
      })
      wrap.append(remove)
    }
    if (confirmDeleteId === routineDraft.id) {
      wrap.append(confirmBox(
        'Delete this routine?',
        'This removes the saved routine. Logged workouts stay.',
        'Delete routine',
        async () => {
          await api.deleteRoutine(routineDraft.id)
          mode = 'home'
          api.refresh()
        },
        () => {
          confirmDeleteId = null
          api.refresh()
        },
      ))
    }
    return wrap
  }

  async function saveRoutine() {
    const name = routineDraft.name.trim()
    if (name === '' || routineDraft.exercises.length === 0) {
      routineMessage = 'Add a name and at least one exercise.'
      api.refresh()
      return
    }
    routineMessage = ''
    routineDraft.name = name
    await api.putRoutine(routineDraft)
    mode = 'home'
    api.refresh()
  }

  function startEmpty() {
    const existing = api.sessions().find((session) => !session.finishedAt)
    if (existing) {
      openSession(existing)
      return
    }
    openSession({
      id: api.newId(),
      name: 'Workout',
      routineId: null,
      startedAt: new Date(),
      finishedAt: null,
      exercises: [],
    })
  }

  function startFromRoutine(routine) {
    const existing = api.sessions().find((session) => !session.finishedAt)
    if (existing) {
      openSession(existing)
      return
    }
    openSession({
      id: api.newId(),
      name: routine.name,
      routineId: routine.id,
      startedAt: new Date(),
      finishedAt: null,
      exercises: routine.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sets: exercise.sets.map((set) => ({
          weightKg: null,
          reps: null,
          done: false,
          targetWeightKg: set.weightKg,
          targetReps: set.reps,
        })),
      })),
    })
  }

  function openSession(session) {
    sessionDraft = session
    picking = false
    mode = 'workout'
    api.putSession(session).then(() => api.refresh())
  }

  function workoutView() {
    const wrap = document.createElement('div')
    wrap.className = 'train'
    const name = document.createElement('input')
    name.value = sessionDraft.name
    name.maxLength = 40
    name.addEventListener('change', () => {
      sessionDraft.name = name.value.trim() || 'Workout'
      persistSession()
    })
    wrap.append(field('Workout', name))
    wrap.append(...exerciseEditors(sessionDraft, true))
    if (picking) wrap.append(picker(sessionDraft))
    else {
      const add = document.createElement('button')
      add.type = 'button'
      add.className = 'wide secondary'
      add.textContent = 'Add exercise'
      add.addEventListener('click', () => {
        picking = true
        api.refresh()
      })
      wrap.append(add)
    }
    const finish = document.createElement('button')
    finish.type = 'button'
    finish.className = 'wide'
    finish.textContent = 'Finish workout'
    finish.addEventListener('click', () => finishSession())
    wrap.append(finish)
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'danger-text'
    cancel.textContent = 'Cancel workout'
    cancel.addEventListener('click', () => {
      confirmDeleteId = sessionDraft.id
      api.refresh()
    })
    wrap.append(cancel)
    if (confirmDeleteId === sessionDraft.id) {
      wrap.append(confirmBox(
        'Cancel this workout?',
        'This removes the workout in progress. It is not saved to your history.',
        'Cancel workout',
        async () => {
          await api.deleteSession(sessionDraft.id)
          mode = 'home'
          confirmDeleteId = null
          api.refresh()
        },
        () => {
          confirmDeleteId = null
          api.refresh()
        },
      ))
    }
    return wrap
  }

  function exerciseEditors(draft, logging) {
    return draft.exercises.map((exercise, exerciseIndex) => {
      const block = document.createElement('article')
      block.className = 'gym-block'
      const header = document.createElement('div')
      header.className = 'gym-head'
      const title = document.createElement('button')
      title.type = 'button'
      title.className = 'linkish exercise-link'
      title.textContent = exerciseName(exercise.exerciseId, api.exercises())
      if (logging) title.addEventListener('click', () => openProgress(exercise.exerciseId))
      else title.disabled = true
      header.append(title, moveButton('Up', exerciseIndex === 0, () => move(draft, exerciseIndex, -1)), moveButton('Down', exerciseIndex === draft.exercises.length - 1, () => move(draft, exerciseIndex, 1)))
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'quiet'
      remove.textContent = 'Remove'
      remove.addEventListener('click', () => {
        draft.exercises.splice(exerciseIndex, 1)
        if (logging) persistSession()
        else api.refresh()
      })
      header.append(remove)
      block.append(header)

      exercise.sets.forEach((set, setIndex) => {
        const row = document.createElement('div')
        row.className = 'set-row'
        const number = document.createElement('span')
        number.className = 'set-number'
        number.textContent = String(setIndex + 1)
        const weight = document.createElement('input')
        weight.inputMode = 'decimal'
        weight.autocomplete = 'off'
        weight.value = set.weightKg == null ? '' : formatKg(set.weightKg)
        const reps = document.createElement('input')
        reps.inputMode = 'numeric'
        reps.autocomplete = 'off'
        reps.value = set.reps == null ? '' : String(set.reps)
        if (logging) {
          const previous = previousSet(api.sessions(), {
            exerciseId: exercise.exerciseId,
            setIndex,
            before: sessionDraft.startedAt,
          })
          weight.placeholder = previous ? formatKg(previous.weightKg) : (set.targetWeightKg ? formatKg(set.targetWeightKg) : 'kg')
          reps.placeholder = previous ? String(previous.reps) : (set.targetReps ? String(set.targetReps) : 'reps')
          if (previous) {
            const caption = document.createElement('p')
            caption.className = 'previous'
            caption.textContent = `Previous: ${formatSet(previous.weightKg, previous.reps)}`
            block.append(caption)
          }
        } else {
          weight.placeholder = 'kg'
          reps.placeholder = 'reps'
        }
        weight.addEventListener('change', () => {
          const parsed = parseKg(weight.value)
          if (!parsed.ok) {
            weight.value = set.weightKg == null ? '' : formatKg(set.weightKg)
            return
          }
          set.weightKg = parsed.value
          if (logging && set.done && (set.weightKg == null || set.reps == null)) set.done = false
          if (logging) persistSession()
        })
        reps.addEventListener('change', () => {
          const parsed = parseReps(reps.value)
          if (!parsed.ok) {
            reps.value = set.reps == null ? '' : String(set.reps)
            return
          }
          set.reps = parsed.value
          if (logging && set.done && (set.weightKg == null || set.reps == null)) set.done = false
          if (logging) persistSession()
        })
        row.append(number, weight, reps)
        if (logging) {
          const done = document.createElement('button')
          done.type = 'button'
          done.className = set.done ? 'tick on' : 'tick'
          done.textContent = set.done ? 'Done' : 'Log'
          done.addEventListener('click', () => {
            if (set.weightKg == null || set.reps == null) return
            set.done = !set.done
            persistSession()
          })
          row.append(done)
          const earlier = [
            ...doneSetsBefore(api.sessions(), exercise.exerciseId, sessionDraft.id),
            ...exercise.sets.slice(0, setIndex).filter((item) => item.done),
          ]
          const badges = badgesForSet(set, earlier)
          if (badges.length) {
            const badge = document.createElement('span')
            badge.className = 'pb'
            badge.textContent = 'PB'
            badge.title = badges.map(badgeLabel).join(', ')
            row.append(badge)
          }
        }
        block.append(row)
      })
      const addSet = document.createElement('button')
      addSet.type = 'button'
      addSet.className = 'quiet'
      addSet.textContent = 'Add set'
      addSet.addEventListener('click', () => {
        exercise.sets.push(logging
          ? { weightKg: null, reps: null, done: false, targetWeightKg: null, targetReps: null }
          : { weightKg: null, reps: null })
        if (logging) persistSession()
        else api.refresh()
      })
      block.append(addSet)
      return block
    })
  }

  function picker(draft) {
    const box = document.createElement('div')
    box.className = 'picker'
    const custom = document.createElement('input')
    custom.placeholder = 'Your own exercise'
    custom.maxLength = 40
    custom.value = customName
    custom.addEventListener('input', () => {
      customName = custom.value
    })
    const addCustom = document.createElement('button')
    addCustom.type = 'button'
    addCustom.className = 'quiet'
    addCustom.textContent = 'Add'
    addCustom.addEventListener('click', async () => {
      const name = customName.trim()
      if (name === '') return
      const exercise = { id: api.newId(), name }
      await api.putExercise(exercise)
      addExercise(draft, exercise.id)
      customName = ''
      picking = false
      if (mode === 'workout') persistSession()
      else api.refresh()
    })
    const row = document.createElement('div')
    row.className = 'inline'
    row.append(custom, addCustom)
    box.append(row)
    const list = document.createElement('ul')
    list.className = 'workouts'
    for (const exercise of exerciseChoices(api.exercises())) {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'workout'
      button.textContent = exercise.name
      button.addEventListener('click', () => {
        addExercise(draft, exercise.id)
        picking = false
        if (mode === 'workout') persistSession()
        else api.refresh()
      })
      item.append(button)
      list.append(item)
    }
    box.append(list)
    return box
  }

  function addExercise(draft, exerciseId) {
    draft.exercises.push(mode === 'workout'
      ? { exerciseId, sets: [{ weightKg: null, reps: null, done: false, targetWeightKg: null, targetReps: null }] }
      : { exerciseId, sets: [{ weightKg: null, reps: null }] })
  }

  function move(draft, index, direction) {
    const next = index + direction
    const [item] = draft.exercises.splice(index, 1)
    draft.exercises.splice(next, 0, item)
    if (mode === 'workout') persistSession()
    else api.refresh()
  }

  function persistSession() {
    api.putSession(sessionDraft).then(() => api.refresh())
  }

  async function finishSession() {
    sessionDraft.finishedAt = new Date()
    sessionDraft.name = sessionDraft.name.trim() || 'Workout'
    await api.putSession(sessionDraft)
    const routine = api.routines().find((item) => item.id === sessionDraft.routineId) ?? null
    const records = newPersonalBests(sessionDraft, api.sessions())
    finishNote = {
      session: sessionDraft,
      records,
      routine,
      changed: routine ? !plansMatch(routine, sessionDraft) : false,
      saveName: sessionDraft.name,
    }
    mode = 'finish'
    api.refresh()
  }

  function finishView() {
    const wrap = document.createElement('div')
    wrap.className = 'train'
    const heading = document.createElement('h2')
    heading.textContent = 'Workout saved'
    wrap.append(heading)
    if (finishNote.records.length === 0) {
      const none = document.createElement('p')
      none.className = 'help'
      none.textContent = 'No new personal bests.'
      wrap.append(none)
    } else {
      const list = document.createElement('ul')
      list.className = 'pb-list'
      for (const item of finishNote.records) {
        const line = document.createElement('li')
        line.textContent = `${exerciseName(item.exerciseId, api.exercises())}: ${item.records.map(recordLabel).join(', ')}`
        list.append(line)
      }
      wrap.append(list)
    }
    if (finishNote.routine && finishNote.changed) {
      const update = document.createElement('button')
      update.type = 'button'
      update.className = 'wide'
      update.textContent = `Update ${finishNote.routine.name}`
      update.addEventListener('click', async () => {
        finishNote.routine.exercises = routineFromSession(finishNote.session, finishNote.routine)
        if (finishNote.routine.exercises.length) await api.putRoutine(finishNote.routine)
        finishNote.changed = false
        api.refresh()
      })
      wrap.append(update)
    } else if (!finishNote.routine && routineFromSession(finishNote.session).length) {
      const name = document.createElement('input')
      name.value = finishNote.saveName
      name.maxLength = 40
      name.addEventListener('input', () => {
        finishNote.saveName = name.value
      })
      const save = document.createElement('button')
      save.type = 'button'
      save.className = 'wide secondary'
      save.textContent = 'Save as a routine'
      save.addEventListener('click', async () => {
        const trimmed = finishNote.saveName.trim()
        if (trimmed === '') return
        await api.putRoutine({
          id: api.newId(),
          name: trimmed,
          exercises: routineFromSession(finishNote.session),
        })
        finishNote.routine = { id: 'saved' }
        api.refresh()
      })
      wrap.append(field('Routine name', name), save)
    }
    const done = document.createElement('button')
    done.type = 'button'
    done.className = 'wide'
    done.textContent = 'Done'
    done.addEventListener('click', () => {
      mode = 'home'
      api.refresh()
    })
    wrap.append(done)
    return wrap
  }

  function openProgress(exerciseId) {
    progressId = exerciseId
    chartKey = 'estimated1Rm'
    mode = 'progress'
    api.refresh()
  }

  function progressView() {
    const wrap = document.createElement('div')
    wrap.className = 'train'
    wrap.append(bar('Back', exerciseName(progressId, api.exercises()), '', () => {
      mode = 'home'
      api.refresh()
    }))
    const series = exerciseSeries(api.sessions(), progressId)
    const allSets = doneSetsBefore(api.sessions(), progressId, null)
    const bests = bestsFromSets(allSets)
    wrap.append(bestLine('Heaviest', bests.heaviest ? formatSet(bests.heaviest.weightKg, bests.heaviest.reps) : 'None yet'))
    wrap.append(bestLine('Estimated 1RM', bests.estimated1Rm ? `${formatKg(bests.estimated1Rm.value)} kg` : 'None yet'))
    wrap.append(bestLine('Best set volume', bests.bestVolume ? `${formatKg(bests.bestVolume.value)} kg` : 'None yet'))
    const toggle = document.createElement('div')
    toggle.className = 'actions'
    for (const [key, label] of [['estimated1Rm', 'Estimated 1RM'], ['heaviest', 'Best set']]) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = chartKey === key ? 'quiet on' : 'quiet'
      button.textContent = label
      button.addEventListener('click', () => {
        chartKey = key
        api.refresh()
      })
      toggle.append(button)
    }
    wrap.append(toggle, chart(series, chartKey))
    const history = document.createElement('ul')
    history.className = 'pb-list'
    for (const point of series.slice().reverse()) {
      const item = document.createElement('li')
      const parts = [longDate(point.startedAt)]
      if (point.heaviest != null) parts.push(formatKg(point.heaviest) + ' kg')
      if (point.estimated1Rm != null) parts.push(`est. ${formatKg(point.estimated1Rm)} kg`)
      item.textContent = parts.join(' · ')
      history.append(item)
    }
    wrap.append(history)
    return wrap
  }

  function showSession(session) {
    sessionDraft = session
    mode = 'detail'
  }

  function detailView() {
    const wrap = document.createElement('div')
    wrap.className = 'train'
    wrap.append(bar('Back', sessionDraft.name, '', () => {
      mode = 'home'
      api.refresh()
    }))
    const minutes = sessionMinutes(sessionDraft)
    const summary = document.createElement('p')
    summary.className = 'help'
    summary.textContent = `${timeLabel(sessionDraft.startedAt)} · ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} · ${doneSetCount(sessionDraft)} sets`
    wrap.append(summary)
    for (const exercise of sessionDraft.exercises) {
      const block = document.createElement('article')
      block.className = 'gym-block'
      const title = document.createElement('button')
      title.type = 'button'
      title.className = 'linkish exercise-link'
      title.textContent = exerciseName(exercise.exerciseId, api.exercises())
      title.addEventListener('click', () => openProgress(exercise.exerciseId))
      block.append(title)
      exercise.sets.filter((set) => set.done).forEach((set, index) => {
        const line = document.createElement('p')
        line.textContent = `${index + 1}. ${formatSet(set.weightKg, set.reps)}`
        block.append(line)
      })
      wrap.append(block)
    }
    return wrap
  }

  return { render, reset, showSession }
}

function bar(closeLabel, title, saveLabel, onClose) {
  const row = document.createElement('div')
  row.className = 'editor-bar'
  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = closeLabel
  close.addEventListener('click', onClose)
  const heading = document.createElement('h2')
  heading.textContent = title
  const save = document.createElement('button')
  save.type = 'submit'
  save.textContent = saveLabel
  save.hidden = saveLabel === ''
  row.append(close, heading, save)
  return row
}

function field(labelText, control) {
  const label = document.createElement('label')
  label.append(document.createTextNode(labelText), control)
  return label
}

function moveButton(text, disabled, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'quiet'
  button.textContent = text
  button.disabled = disabled
  button.addEventListener('click', onClick)
  return button
}

function confirmBox(title, copy, action, onYes, onNo) {
  const box = document.createElement('div')
  box.className = 'import-confirm'
  const heading = document.createElement('h2')
  heading.textContent = title
  const text = document.createElement('p')
  text.textContent = copy
  const actions = document.createElement('div')
  actions.className = 'confirm-actions'
  const no = document.createElement('button')
  no.type = 'button'
  no.textContent = 'Cancel'
  no.addEventListener('click', onNo)
  const yes = document.createElement('button')
  yes.type = 'button'
  yes.className = 'danger-button'
  yes.textContent = action
  yes.addEventListener('click', onYes)
  actions.append(no, yes)
  box.append(heading, text, actions)
  return box
}

function badgeLabel(kind) {
  if (kind === 'weight') return 'Heaviest'
  if (kind === 'estimated1Rm') return 'Estimated 1RM'
  return 'Best set volume'
}

function recordLabel(record) {
  if (record.kind === 'weight') return `heaviest ${formatSet(record.weightKg, record.reps)}`
  if (record.kind === 'estimated1Rm') return `estimated 1RM ${formatKg(record.value)} kg`
  return `best set volume ${formatKg(record.value)} kg`
}

function bestLine(label, value) {
  const paragraph = document.createElement('p')
  paragraph.className = 'best-line'
  const strong = document.createElement('strong')
  strong.textContent = label
  paragraph.append(strong, document.createTextNode(` ${value}`))
  return paragraph
}

function chart(series, key) {
  const points = series.filter((point) => point[key] != null)
  if (points.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'help'
    empty.textContent = 'No logged sets yet.'
    return empty
  }
  const width = 320
  const height = 168
  const pad = 28
  const values = points.map((point) => point[key])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const coords = points.map((point, index) => {
    const x = points.length === 1
      ? width / 2
      : pad + (index / (points.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (point[key] - min) / span) * (height - pad * 2)
    return [x, y]
  })
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('class', 'chart')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', key === 'estimated1Rm' ? 'Estimated 1RM over time' : 'Best set over time')
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  line.setAttribute('points', coords.map(([x, y]) => `${x},${y}`).join(' '))
  line.setAttribute('fill', 'none')
  line.setAttribute('stroke', 'currentColor')
  line.setAttribute('stroke-width', '2')
  svg.append(line)
  for (const [x, y] of coords) {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    dot.setAttribute('cx', String(x))
    dot.setAttribute('cy', String(y))
    dot.setAttribute('r', '3.5')
    svg.append(dot)
  }
  const low = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  low.setAttribute('x', '4')
  low.setAttribute('y', String(height - 8))
  low.textContent = formatKg(min)
  const high = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  high.setAttribute('x', '4')
  high.setAttribute('y', '16')
  high.textContent = formatKg(max)
  svg.append(low, high)
  return svg
}
