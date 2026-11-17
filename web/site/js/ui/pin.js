import { h, icon } from './dom.js';
import { button, field } from './components.js';
import { hashPin, isValidPin, verifyPin } from '../core/pin.js';
import { createDemoListing } from '../data/demo.js';
import { emptyListing } from '../data/repo.js';

/** Keypad that unlocks the agent tools. */
export function pinScreen(root, app, { next = 'admin' } = {}) {
  let entry = '';
  let busy = false;
  const dots = h('div', { class: 'pin__dots', 'aria-hidden': 'true' });
  const status = h('p', { class: 'pin__status', role: 'status', 'aria-live': 'polite' });
  const liveValue = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });

  const renderDots = () => {
    dots.replaceChildren(...Array.from({ length: Math.max(4, entry.length) }, (_, i) => h('span', { class: `pin__dot${i < entry.length ? ' is-filled' : ''}` })));
    liveValue.textContent = `${entry.length} digits entered`;
  };

  const lockMessage = () => {
    const secs = Math.ceil(app.pinGate.remainingLockMs() / 1000);
    return `Too many wrong tries. Try again in ${secs} seconds.`;
  };

  async function submit() {
    if (busy || !entry) return;
    if (app.pinGate.isLocked()) {
      status.textContent = lockMessage();
      return;
    }
    busy = true;
    const ok = await verifyPin(entry, await app.repo.getPinRecord());
    busy = false;
    if (ok) {
      app.pinGate.recordSuccess();
      app.go(next);
      return;
    }
    app.pinGate.recordFailure();
    entry = '';
    renderDots();
    dots.classList.remove('is-wrong');
    void dots.offsetWidth;
    dots.classList.add('is-wrong');
    status.textContent = app.pinGate.isLocked() ? lockMessage() : 'That PIN didn’t match. Try again.';
  }

  const press = (key) => {
    if (key === 'back') entry = entry.slice(0, -1);
    else if (key === 'enter') return submit();
    else if (entry.length < 8) entry += key;
    status.textContent = '';
    renderDots();
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'enter'];
  const pad = h(
    'div',
    { class: 'pin__pad' },
    keys.map((k) =>
      h(
        'button',
        {
          type: 'button',
          class: `pin__key${k === 'enter' ? ' pin__key--enter' : ''}${k === 'back' ? ' pin__key--back' : ''}`,
          'aria-label': k === 'back' ? 'Delete last digit' : k === 'enter' ? 'Unlock' : k,
          onClick: () => press(k),
        },
        k === 'back' ? icon('backspace', { size: 28 }) : k === 'enter' ? icon('check', { size: 30 }) : k,
      ),
    ),
  );

  const onKey = (e) => {
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter') press('enter');
    else if (e.key === 'Escape') app.go('welcome');
  };
  document.addEventListener('keydown', onKey);

  root.append(
    h(
      'main',
      { class: 'screen pin' },
      h(
        'div',
        { class: 'pin__panel' },
        h('span', { class: 'pin__icon' }, icon('lock', { size: 28 })),
        h('h1', { class: 'pin__title', tabindex: '-1', text: 'Enter agent PIN' }),
        dots,
        liveValue,
        status,
        pad,
        button('Back to the open house', { variant: 'on-dark', onClick: () => app.go('welcome') }),
      ),
    ),
  );
  renderDots();
  if (app.pinGate.isLocked()) status.textContent = lockMessage();
  return { idle: 'visitor', cleanup: () => document.removeEventListener('keydown', onKey) };
}

/** First launch: the agent picks a PIN and how to start. */
export function setupScreen(root, app, { errors = {} } = {}) {
  const onSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const pin = String(data.get('pin') ?? '');
    const confirm = String(data.get('confirm') ?? '');
    const start = data.get('start');
    const errs = {};
    if (!isValidPin(pin)) errs.pin = 'Use 4 to 8 digits.';
    else if (pin !== confirm) errs.confirm = 'The two PINs don’t match.';
    if (Object.keys(errs).length) return app.go('setup', { errors: errs });

    e.currentTarget.querySelector('button[type="submit"]').disabled = true;
    await app.repo.savePinRecord(await hashPin(pin));
    const listing = start === 'sample' ? await createDemoListing(app.repo) : emptyListing();
    await app.saveListing(listing);
    app.go(start === 'sample' ? 'welcome' : 'admin', { tab: 'listing' });
  };

  const option = (value, title, detail, checked) =>
    h(
      'label',
      { class: 'start-option' },
      h('input', { type: 'radio', name: 'start', value, class: 'start-option__input', checked }),
      h('span', { class: 'start-option__body' }, h('span', { class: 'start-option__title', text: title }), h('span', { class: 'start-option__detail', text: detail })),
    );

  root.append(
    h(
      'main',
      { class: 'screen setup' },
      h(
        'form',
        { class: 'setup__panel', novalidate: true, onSubmit },
        h('h1', { class: 'setup__title', tabindex: '-1', text: 'Set up this tablet' }),
        h('p', { class: 'setup__intro', text: 'Visitors see the listing and a sign-in form. You reach the agent tools by pressing and holding “Open house” in the top corner, then entering your PIN.' }),
        h(
          'ol',
          { class: 'setup__steps' },
          h(
            'li',
            { class: 'setup__step' },
            h('h2', { class: 'setup__step-title', text: 'Choose an agent PIN' }),
            h(
              'div',
              { class: 'form-grid' },
              field({ label: 'PIN', name: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: '8', error: errors.pin, hint: '4 to 8 digits' }),
              field({ label: 'Confirm PIN', name: 'confirm', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: '8', error: errors.confirm, hint: 'Type it again' }),
            ),
          ),
          h(
            'li',
            { class: 'setup__step' },
            h('h2', { class: 'setup__step-title', text: 'Pick a starting point' }),
            h(
              'div',
              { class: 'start-options' },
              option('blank', 'Blank listing', 'Enter the address, details, and room photos for the home you’re showing.', true),
              option('sample', 'Sample listing', 'Explore the app with a made-up home first. You can replace it any time.', false),
            ),
          ),
        ),
        button('Finish setup', { variant: 'primary', size: 'lg', type: 'submit' }),
      ),
    ),
  );
  return { idle: null };
}
