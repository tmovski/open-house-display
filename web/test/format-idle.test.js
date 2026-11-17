import { describe, expect, it, vi } from 'vitest';
import { formatBaths, formatNumber, formatPrice, plural, splitStreet } from '../site/js/core/format.js';
import { createIdleTimer } from '../site/js/core/idle.js';

describe('format', () => {
  it('splits the house number off the street', () => {
    expect(splitStreet('2418 Linden Court')).toEqual({ number: '2418', street: 'Linden Court' });
    expect(splitStreet('12B Elm St')).toEqual({ number: '12B', street: 'Elm St' });
    expect(splitStreet('Lot 4 Elm St')).toEqual({ number: '', street: 'Lot 4 Elm St' });
  });

  it('formats listing numbers', () => {
    expect(formatPrice(489000)).toBe('$489,000');
    expect(formatPrice(0)).toBe('');
    expect(formatNumber(2310)).toBe('2,310');
    expect(formatBaths(2.5)).toBe('2½');
    expect(formatBaths(3)).toBe('3');
    expect(plural(1, 'sign-in')).toBe('1 sign-in');
    expect(plural(3, 'sign-in')).toBe('3 sign-ins');
  });
});

describe('createIdleTimer', () => {
  it('fires after inactivity and resets on touch', () => {
    vi.useFakeTimers();
    const target = new EventTarget();
    const onIdle = vi.fn();
    const idle = createIdleTimer({ timeoutMs: 1000, onIdle, target });
    idle.start();
    vi.advanceTimersByTime(900);
    target.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(900);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onIdle).toHaveBeenCalledTimes(1);
    idle.stop();
    vi.advanceTimersByTime(5000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
