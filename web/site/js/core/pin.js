/**
 * Agent PIN handling. The PIN is never stored: we store a salted PBKDF2 hash,
 * and lock the keypad for a while after repeated wrong guesses.
 */
const ITERATIONS = 150_000;
const enc = new TextEncoder();

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function isValidPin(pin) {
  return /^\d{4,8}$/.test(String(pin ?? ''));
}

async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPin(pin, { iterations = ITERATIONS } = {}) {
  if (!isValidPin(pin)) throw new Error('PIN must be 4 to 8 digits.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(pin, salt, iterations);
  return { algorithm: 'PBKDF2-SHA256', iterations, salt: toB64(salt), hash: toB64(bits) };
}

export async function verifyPin(pin, record) {
  if (!record || !isValidPin(pin)) return false;
  const bits = new Uint8Array(await derive(pin, fromB64(record.salt), record.iterations));
  const expected = fromB64(record.hash);
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

/** Tracks wrong attempts: after `maxAttempts` misses, locks for `lockMs`, doubling each time. */
export function createPinGate({ maxAttempts = 5, lockMs = 30_000, now = () => Date.now() } = {}) {
  let failures = 0;
  let lockouts = 0;
  let lockedUntil = 0;
  return {
    remainingLockMs: () => Math.max(0, lockedUntil - now()),
    isLocked() {
      return this.remainingLockMs() > 0;
    },
    recordFailure() {
      failures += 1;
      if (failures >= maxAttempts) {
        lockedUntil = now() + lockMs * 2 ** lockouts;
        lockouts += 1;
        failures = 0;
      }
    },
    recordSuccess() {
      failures = 0;
      lockouts = 0;
      lockedUntil = 0;
    },
    attemptsLeft: () => maxAttempts - failures,
  };
}
