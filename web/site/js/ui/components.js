import { h, icon } from './dom.js';

/** Resolves stored photo ids to object URLs, created once and reused. */
export function createPhotoCache(repo) {
  const urls = new Map();
  return {
    async url(id) {
      if (!id) return null;
      if (!urls.has(id)) {
        const record = await repo.getPhoto(id);
        urls.set(id, record ? URL.createObjectURL(record.blob) : null);
      }
      return urls.get(id);
    },
    forget(id) {
      const u = urls.get(id);
      if (u) URL.revokeObjectURL(u);
      urls.delete(id);
    },
  };
}

export function photo(app, id, { alt = '', className = '' } = {}) {
  const img = h('img', { class: `photo ${className}`, alt, decoding: 'async', draggable: 'false' });
  if (!id) {
    img.hidden = true;
    return img;
  }
  app.photos.url(id).then((src) => {
    if (src) img.src = src;
    else img.hidden = true;
  });
  return img;
}

/**
 * Hidden door to the agent tools: press and hold the "Open house" mark.
 * Visitors don't stumble into it; the agent learns it once during setup.
 */
export function agentDoor(app, { tone = 'light' } = {}) {
  const HOLD_MS = 1500;
  let timer = null;
  const el = h(
    'button',
    {
      type: 'button',
      class: `agent-door agent-door--${tone}`,
      'aria-label': 'Open house. Agent: press and hold for agent tools.',
    },
    h('span', { class: 'agent-door__mark', 'aria-hidden': 'true' }, icon('home', { size: 20 })),
    h('span', { class: 'agent-door__label', text: 'Open house' }),
    h('span', { class: 'agent-door__ring', 'aria-hidden': 'true' }),
  );
  const cancel = () => {
    clearTimeout(timer);
    el.classList.remove('is-holding');
  };
  const start = () => {
    clearTimeout(timer);
    el.classList.add('is-holding');
    timer = setTimeout(() => {
      cancel();
      app.go('pin');
    }, HOLD_MS);
  };
  el.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => el.addEventListener(e, cancel));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  // Keyboard users (and the browser demo): hold Enter or Space.
  el.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      start();
    }
  });
  el.addEventListener('keyup', (e) => {
    if (e.key === 'Enter' || e.key === ' ') cancel();
  });
  return el;
}

export function button(label, { variant = 'secondary', size, iconName, onClick, type = 'button', ...rest } = {}) {
  return h(
    'button',
    { type, class: ['btn', `btn--${variant}`, size && `btn--${size}`].filter(Boolean).join(' '), onClick, ...rest },
    iconName && icon(iconName, { size: size === 'lg' ? 24 : 20 }),
    h('span', { text: label }),
  );
}

let fieldCount = 0;

/** Label + input + hint + error, wired together for screen readers. */
export function field({ label, name, type = 'text', value = '', hint, error, multiline = false, ...attrs }) {
  const id = `f-${name}-${++fieldCount}`;
  const hintId = hint ? `${id}-hint` : null;
  const errorId = `${id}-error`;
  const control = multiline
    ? h('textarea', { id, name, class: 'input input--multiline', rows: 4, ...attrs })
    : h('input', { id, name, type, class: 'input', ...attrs });
  control.value = value ?? '';
  const describedBy = [hintId, error ? errorId : null].filter(Boolean).join(' ');
  if (describedBy) control.setAttribute('aria-describedby', describedBy);
  if (error) control.setAttribute('aria-invalid', 'true');
  return h(
    'div',
    { class: `field${error ? ' field--error' : ''}`, dataset: { field: name } },
    h('label', { class: 'field__label', for: id, text: label }),
    hint && h('p', { class: 'field__hint', id: hintId, text: hint }),
    control,
    error && h('p', { class: 'field__error', id: errorId, text: error }),
  );
}

/** Radio buttons styled as large touch-friendly chips. */
export function choiceGroup({ legend, name, options, value, error }) {
  let n = 0;
  return h(
    'fieldset',
    { class: `choices${error ? ' field--error' : ''}`, dataset: { field: name } },
    h('legend', { class: 'field__label', text: legend }),
    h(
      'div',
      { class: 'choices__row' },
      options.map((opt) => {
        const id = `c-${name}-${++fieldCount}-${n++}`;
        return h(
          'span',
          { class: 'choice' },
          h('input', { type: 'radio', id, name, value: opt.value, class: 'choice__input', checked: opt.value === value }),
          h('label', { for: id, class: 'choice__label', text: opt.label }),
        );
      }),
    ),
    error && h('p', { class: 'field__error', text: error }),
  );
}

export function toast(message, { tone = 'neutral', ms = 3200 } = {}) {
  let region = document.querySelector('.toasts');
  if (!region) {
    region = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  const el = h('div', { class: `toast toast--${tone}`, text: message });
  region.append(el);
  setTimeout(() => el.remove(), ms);
  return el;
}

/** In-app confirmation dialog (native JS dialogs look out of place on a kiosk). */
export function confirmDialog({ title, body, confirmLabel, cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const titleId = `dlg-${++fieldCount}`;
    const close = (result) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
    };
    const confirmBtn = button(confirmLabel, { variant: danger ? 'danger' : 'primary', onClick: () => close(true) });
    const overlay = h(
      'div',
      { class: 'dialog-backdrop', onClick: (e) => e.target === overlay && close(false) },
      h(
        'div',
        { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
        h('h2', { class: 'dialog__title', id: titleId, text: title }),
        body && h('p', { class: 'dialog__body', text: body }),
        h('div', { class: 'dialog__actions' }, button(cancelLabel, { variant: 'quiet', onClick: () => close(false) }), confirmBtn),
      ),
    );
    document.addEventListener('keydown', onKey, true);
    document.body.append(overlay);
    confirmBtn.focus();
  });
}
