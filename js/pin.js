export const PIN_ITERATIONS = 150_000
export const FREE_TRIES = 5
export const BACKGROUND_LOCK_MS = 3 * 60 * 1000
export const MAX_LOCKOUT_MS = 60_000

const MESSAGES = {
  pinFormat: 'Use 4 to 6 digits.',
  pinMismatch: 'Those PINs do not match.',
  pinWrong: 'That PIN is not correct.',
}

export function messageForPin(error) {
  return MESSAGES[error] ?? 'Check the PIN and try again.'
}

export function pinError(pin) {
  return /^\d{4,6}$/.test(pin) ? null : 'pinFormat'
}

export function lockoutDelayMs(failures) {
  if (failures < FREE_TRIES) return 0
  const delay = 5000 * 2 ** (failures - FREE_TRIES)
  return Math.min(delay, MAX_LOCKOUT_MS)
}

export function lockoutRemainingMs(state, now) {
  return Math.max(0, state.lockedUntil - now)
}

export function nextLockout(state, now, correct) {
  if (correct) return { failures: 0, lockedUntil: 0 }
  const failures = state.failures + 1
  const delay = lockoutDelayMs(failures)
  return {
    failures,
    lockedUntil: delay === 0 ? 0 : now + delay,
  }
}

export function shouldLockAfterBackground(hiddenAt, visibleAt, lockAfterMs = BACKGROUND_LOCK_MS) {
  if (hiddenAt == null) return false
  return visibleAt - hiddenAt >= lockAfterMs
}

export function waitLabel(milliseconds) {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000))
  return seconds === 1 ? '1 second' : `${seconds} seconds`
}

export async function hashPin(pin, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    256,
  )
  return bytesToHex(new Uint8Array(bits))
}

export async function createPinRecord(pin, iterations = PIN_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return {
    salt: bytesToHex(salt),
    hash: await hashPin(pin, salt, iterations),
    iterations,
  }
}

export async function verifyPin(pin, record) {
  const hash = await hashPin(pin, hexToBytes(record.salt), record.iterations)
  return hashesMatch(hash, record.hash)
}

export function hashesMatch(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

export function bytesToHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}
