import { barcodeKind } from './barcode.js'
import { nutrientsFor, portionText, productLines } from './off.js'
import { mealTitle } from './food.js'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

export function openScanner({ meal }, actions) {
  const dialog = document.createElement('dialog')
  dialog.className = 'editor'
  const sheet = document.createElement('div')
  sheet.className = 'fields scanner'
  const title = document.createElement('h2')
  title.textContent = `Scan ${mealTitle(meal).toLocaleLowerCase('en-GB')}`
  const frame = document.createElement('div')
  frame.className = 'scanner-frame'
  const video = document.createElement('video')
  video.className = 'scanner-video'
  video.muted = true
  video.setAttribute('playsinline', '')
  video.setAttribute('autoplay', '')
  const box = document.createElement('div')
  box.className = 'scanner-box'
  frame.append(video, box)
  const status = document.createElement('p')
  status.className = 'help'
  status.textContent = 'Point the camera at a barcode.'
  const manual = document.createElement('label')
  manual.textContent = 'Or type the barcode'
  const input = document.createElement('input')
  input.inputMode = 'numeric'
  input.autocomplete = 'off'
  input.placeholder = 'For example 3017620422003'
  manual.append(input)
  const lookup = document.createElement('button')
  lookup.type = 'button'
  lookup.className = 'pill'
  lookup.textContent = 'Look up'
  const error = document.createElement('p')
  error.className = 'form-error'
  error.hidden = true
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'wide secondary'
  close.textContent = 'Close'
  sheet.append(title, frame, status, manual, lookup, error, close)
  dialog.append(sheet)
  let stream = null
  let reader = null
  let stopped = false
  let handled = false

  function stopCamera() {
    stopped = true
    try { reader?.reset() } catch { /* The decoder may already be reset. */ }
    reader = null
    for (const track of stream?.getTracks() ?? []) track.stop()
    stream = null
    video.srcObject = null
  }

  dialog.addEventListener('close', () => {
    stopCamera()
    dialog.remove()
  })
  close.addEventListener('click', () => dialog.close())
  lookup.addEventListener('click', () => lookUp(input.value))
  document.body.append(dialog)
  dialog.showModal()
  startCamera()

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'The camera is not available. Type the barcode instead.'
      return
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      })
    } catch {
      status.textContent = 'The camera is not available. Type the barcode instead.'
      return
    }
    if (stopped) {
      stopCamera()
      return
    }
    video.srcObject = stream
    try { await video.play() } catch { /* Autoplay can wait for a tap. The preview still shows. */ }
    if ('BarcodeDetector' in globalThis) {
      scanWithDetector()
      return
    }
    scanWithZxing()
  }

  async function scanWithDetector() {
    let detector
    try {
      detector = new BarcodeDetector({ formats: FORMATS })
    } catch {
      scanWithZxing()
      return
    }
    const tick = async () => {
      if (stopped || handled || video.readyState < 2) {
        if (!stopped && !handled) requestAnimationFrame(tick)
        return
      }
      try {
        const codes = await detector.detect(video)
        const code = codes.map((item) => item.rawValue).find((value) => barcodeKind(value).ok)
        if (code) {
          lookUp(code)
          return
        }
      } catch { /* This frame had no barcode. */ }
      if (!stopped && !handled) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  async function scanWithZxing() {
    let ZXing
    try {
      ZXing = await loadZxing()
    } catch {
      status.textContent = 'The barcode reader did not load. Type the barcode instead.'
      return
    }
    if (stopped) return
    const hints = new Map()
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E,
    ])
    reader = new ZXing.BrowserMultiFormatReader(hints)
    try {
      await reader.decodeFromVideoElementContinuously(video, (result) => {
        if (!result || handled) return
        const code = result.getText()
        if (barcodeKind(code).ok) lookUp(code)
      })
    } catch {
      if (!stopped) status.textContent = 'The camera is not available. Type the barcode instead.'
    }
  }

  async function lookUp(value) {
    const kind = barcodeKind(value)
    if (!kind.ok) {
      error.hidden = false
      error.textContent = 'That barcode is not valid.'
      return
    }
    if (handled) return
    handled = true
    stopCamera()
    status.textContent = 'Looking up…'
    error.hidden = true
    const result = await actions.lookup(kind.code)
    if (!dialog.open) return
    dialog.close()
    if (!result.ok) {
      actions.notFound(meal, kind.code)
      return
    }
    openPortion({ product: result.product, meal, offline: result.offline }, actions)
  }
}

export function openPortion({ product, meal, offline = false }, actions) {
  const dialog = document.createElement('dialog')
  dialog.className = 'editor'
  const sheet = document.createElement('div')
  sheet.className = 'fields'
  const heading = document.createElement('h2')
  heading.textContent = product.name
  const brand = document.createElement('p')
  brand.className = 'help'
  brand.textContent = product.brand || 'No brand listed'
  const saved = document.createElement('p')
  saved.className = 'help'
  saved.textContent = 'Saved on this phone. The lookup did not reach the internet.'
  const mode = document.createElement('div')
    mode.className = 'portion-mode'
    const servings = modeButton('Servings', 'servings')
    const grams = modeButton('Grams', 'grams')
    mode.append(servings, grams)
    const amountLabel = document.createElement('label')
    amountLabel.textContent = 'Amount'
    const amount = document.createElement('input')
    amount.inputMode = 'decimal'
    amount.value = '1'
    amountLabel.append(amount)
    const preview = document.createElement('p')
    preview.className = 'estimate-target'
    const choiceError = document.createElement('p')
    choiceError.className = 'form-error'
    choiceError.hidden = true
    let current = product.kcalPerServing != null || product.servingQuantity ? 'servings' : 'grams'
    if (current === 'grams') amount.value = '100'
    function paint() {
      servings.classList.toggle('on', current === 'servings')
      grams.classList.toggle('on', current === 'grams')
      const nutrients = nutrientsFor(product, { mode: current, amount: amount.value })
      if (!nutrients.ok) {
        preview.textContent = 'Enter an amount.'
        return
      }
      const parts = [`${nutrients.kcal} kcal`]
      if (nutrients.proteinG != null) parts.push(`${nutrients.proteinG} g protein`)
      if (nutrients.carbsG != null) parts.push(`${nutrients.carbsG} g carbs`)
      if (nutrients.fatG != null) parts.push(`${nutrients.fatG} g fat`)
      preview.textContent = parts.join(' · ')
    }
    function modeButton(text, id) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'wide secondary'
      button.textContent = text
      button.addEventListener('click', () => {
        current = id
        if (id === 'servings' && amount.value === '100') amount.value = '1'
        if (id === 'grams' && amount.value === '1') amount.value = String(product.servingQuantity || 100)
        paint()
      })
      return button
    }
    amount.addEventListener('input', paint)
    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'pill'
    add.textContent = actions.label ?? `Add to ${mealTitle(meal).toLocaleLowerCase('en-GB')}`
    add.addEventListener('click', () => {
      const nutrients = nutrientsFor(product, { mode: current, amount: amount.value })
      if (!nutrients.ok) {
        choiceError.hidden = false
        choiceError.textContent = 'Enter an amount.'
        return
      }
      dialog.close()
      actions.saveScanned({
        meal,
        name: product.name,
        amount: portionText({ mode: current, amount: amount.value }),
        kcal: nutrients.kcal,
        proteinG: nutrients.proteinG,
        carbsG: nutrients.carbsG,
        fatG: nutrients.fatG,
        barcode: product.barcode,
        mode: current,
        quantity: Number(amount.value),
      })
    })
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'wide secondary'
    cancel.textContent = 'Close'
    cancel.addEventListener('click', () => dialog.close())
    sheet.append(heading, brand)
    for (const line of productLines(product)) {
      const item = document.createElement('p')
      item.textContent = line
      sheet.append(item)
    }
    if (offline) sheet.append(saved)
    sheet.append(mode, amountLabel, preview, choiceError, add, cancel)
    dialog.append(sheet)
    dialog.addEventListener('close', () => dialog.remove())
    document.body.append(dialog)
    dialog.showModal()
    paint()
}

function loadZxing() {
  if (globalThis.ZXing?.BrowserMultiFormatReader) return Promise.resolve(globalThis.ZXing)
  if (!loadZxing.pending) {
    loadZxing.pending = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = new URL('./vendor/zxing.min.js', import.meta.url)
      script.onload = () => resolve(globalThis.ZXing)
      script.onerror = () => reject(new Error('decoder'))
      document.head.append(script)
    })
  }
  return loadZxing.pending
}
