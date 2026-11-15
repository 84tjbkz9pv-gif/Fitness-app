import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BACKGROUND_LOCK_MS,
  PIN_ITERATIONS,
  createPinRecord,
  hashPin,
  hashesMatch,
  lockoutDelayMs,
  lockoutRemainingMs,
  messageForPin,
  nextLockout,
  pinError,
  shouldLockAfterBackground,
  verifyPin,
  waitLabel,
} from '../js/pin.js'

test('a PIN must be 4 to 6 digits', () => {
  for (const pin of ['', '123', '1234567', '12a4', '12 4', '1234 ', 'abcd']) {
    assert.equal(pinError(pin), 'pinFormat')
  }
  assert.equal(pinError('1234'), null)
  assert.equal(pinError('123456'), null)
  assert.equal(messageForPin('pinFormat'), 'Use 4 to 6 digits.')
  assert.equal(messageForPin('pinMismatch'), 'Those PINs do not match.')
  assert.equal(messageForPin('pinWrong'), 'That PIN is not correct.')
})

test('the stored value is a salted hash, not the PIN', async () => {
  const salt = new Uint8Array(16).fill(4)
  const hash = await hashPin('1234', salt, 1000)
  assert.equal(hash, await hashPin('1234', salt, 1000))
  assert.notEqual(hash, await hashPin('1235', salt, 1000))
  assert.notEqual(hash, await hashPin('1234', new Uint8Array(16).fill(9), 1000))
  assert.notEqual(hash, '1234')
  assert.equal(hashesMatch(hash, hash), true)
  assert.equal(hashesMatch(hash, `${hash}aa`), false)
  const flipped = `${hash.slice(0, -1)}${hash.endsWith('0') ? '1' : '0'}`
  assert.equal(hashesMatch(hash, flipped), false)

  const record = await createPinRecord('1234', 1000)
  assert.equal(record.iterations, 1000)
  assert.equal(record.salt.length, 32)
  assert.notEqual(record.hash, '1234')
  assert.equal(record.hash.length, 64)
  assert.equal(await verifyPin('1234', record), true)
  assert.equal(await verifyPin('0000', record), false)

  const other = await createPinRecord('1234', 1000)
  assert.notEqual(other.salt, record.salt)
  assert.ok(PIN_ITERATIONS >= 100_000)
})

test('the first four wrong PINs have no delay and the fifth waits', () => {
  let state = { failures: 0, lockedUntil: 0 }
  const now = 1_000_000
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    state = nextLockout(state, now, false)
    assert.equal(state.failures, attempt)
    assert.equal(lockoutDelayMs(attempt), 0)
    assert.equal(state.lockedUntil, 0)
  }
  state = nextLockout(state, now, false)
  assert.equal(state.failures, 5)
  assert.equal(lockoutDelayMs(5), 5000)
  assert.equal(state.lockedUntil, now + 5000)
  assert.equal(lockoutRemainingMs(state, now + 1000), 4000)
  assert.equal(lockoutRemainingMs(state, now + 5000), 0)
})

test('the delay doubles, then a correct PIN clears it', () => {
  assert.equal(lockoutDelayMs(6), 10_000)
  assert.equal(lockoutDelayMs(7), 20_000)
  assert.equal(lockoutDelayMs(8), 40_000)
  assert.equal(lockoutDelayMs(9), 60_000)
  assert.equal(lockoutDelayMs(20), 60_000)
  const cleared = nextLockout({ failures: 8, lockedUntil: 99 }, 100, true)
  assert.deepEqual(cleared, { failures: 0, lockedUntil: 0 })
})

test('the app locks again after a few minutes in the background', () => {
  const hiddenAt = 0
  assert.equal(shouldLockAfterBackground(null, BACKGROUND_LOCK_MS), false)
  assert.equal(shouldLockAfterBackground(hiddenAt, BACKGROUND_LOCK_MS - 1), false)
  assert.equal(shouldLockAfterBackground(hiddenAt, BACKGROUND_LOCK_MS), true)
  assert.equal(shouldLockAfterBackground(hiddenAt, BACKGROUND_LOCK_MS + 60_000), true)
  assert.equal(waitLabel(1000), '1 second')
  assert.equal(waitLabel(1500), '2 seconds')
})
