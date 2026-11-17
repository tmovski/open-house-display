import { describe, expect, it } from 'vitest';
import { createPinGate, hashPin, isValidPin, verifyPin } from '../site/js/core/pin.js';

describe('PIN hashing', () => {
  it('verifies the right PIN and rejects others', async () => {
    const record = await hashPin('2468', { iterations: 1000 });
    expect(record.hash).not.toContain('2468');
    expect(await verifyPin('2468', record)).toBe(true);
    expect(await verifyPin('2469', record)).toBe(false);
    expect(await verifyPin('24680', record)).toBe(false);
  });

  it('salts every hash differently', async () => {
    const a = await hashPin('1234', { iterations: 1000 });
    const b = await hashPin('1234', { iterations: 1000 });
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('only allows 4 to 8 digits', async () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345678')).toBe(true);
    expect(isValidPin('123456789')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    await expect(hashPin('12')).rejects.toThrow();
    expect(await verifyPin('1234', null)).toBe(false);
  });
});

describe('createPinGate', () => {
  it('locks after 5 misses, doubling the lock each time', () => {
    let t = 0;
    const gate = createPinGate({ now: () => t, lockMs: 30_000 });
    for (let i = 0; i < 4; i++) gate.recordFailure();
    expect(gate.isLocked()).toBe(false);
    expect(gate.attemptsLeft()).toBe(1);
    gate.recordFailure();
    expect(gate.remainingLockMs()).toBe(30_000);

    t = 30_001;
    expect(gate.isLocked()).toBe(false);
    for (let i = 0; i < 5; i++) gate.recordFailure();
    expect(gate.remainingLockMs()).toBe(60_000);

    gate.recordSuccess();
    expect(gate.isLocked()).toBe(false);
  });
});
