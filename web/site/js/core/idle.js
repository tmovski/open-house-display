/** Calls onIdle after `timeoutMs` without touches, clicks, or key presses. */
export function createIdleTimer({ timeoutMs, onIdle, target = globalThis.document, timers = globalThis }) {
  const events = ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart'];
  let timer = null;
  const reset = () => {
    timers.clearTimeout(timer);
    timer = timers.setTimeout(onIdle, timeoutMs);
  };
  return {
    start() {
      events.forEach((e) => target.addEventListener(e, reset, { passive: true, capture: true }));
      reset();
    },
    stop() {
      events.forEach((e) => target.removeEventListener(e, reset, { capture: true }));
      timers.clearTimeout(timer);
    },
    reset,
  };
}
