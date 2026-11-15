export function checkDigit(body) {
  let sum = 0
  const digits = String(body).split('').reverse()
  for (let index = 0; index < digits.length; index += 1) {
    sum += Number(digits[index]) * (index % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10
}

export function isEan13(code) {
  return /^\d{13}$/.test(code) && checkDigit(code.slice(0, 12)) === Number(code[12])
}

export function isUpcA(code) {
  return /^\d{12}$/.test(code) && checkDigit(code.slice(0, 11)) === Number(code[11])
}

export function isEan8(code) {
  return /^\d{8}$/.test(code) && checkDigit(code.slice(0, 7)) === Number(code[7])
}

export function expandUpcE(code) {
  if (!/^[01]\d{7}$/.test(code)) return null
  const numberSystem = code[0]
  const data = code.slice(1, 7)
  const check = code[7]
  const last = data[5]
  let middle
  if (last === '0' || last === '1' || last === '2') {
    middle = `${data[0]}${data[1]}${last}0000${data[2]}${data[3]}${data[4]}`
  } else if (last === '3') {
    middle = `${data[0]}${data[1]}${data[2]}00000${data[3]}${data[4]}`
  } else if (last === '4') {
    middle = `${data[0]}${data[1]}${data[2]}${data[3]}00000${data[4]}`
  } else {
    middle = `${data[0]}${data[1]}${data[2]}${data[3]}${data[4]}0000${last}`
  }
  return `${numberSystem}${middle}${check}`
}

export function isUpcE(code) {
  const expanded = expandUpcE(code)
  return expanded != null && isUpcA(expanded)
}

export function barcodeKind(value) {
  const code = String(value ?? '').replace(/\s+/g, '')
  if (isEan13(code)) return { ok: true, code, kind: 'ean-13' }
  if (isUpcA(code)) return { ok: true, code, kind: 'upc-a' }
  if (isEan8(code)) return { ok: true, code, kind: 'ean-8' }
  if (isUpcE(code)) return { ok: true, code, kind: 'upc-e' }
  return { ok: false }
}
