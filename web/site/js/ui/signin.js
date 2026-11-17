import { h } from './dom.js';
import { agentDoor, button, choiceGroup, field, photo } from './components.js';
import { TIMELINES, createLead, validateSignIn } from '../core/lead.js';
import { newId } from '../core/ids.js';

export function signInScreen(root, app, { draft = {}, errors = {} } = {}) {
  const { listing } = app;

  const readForm = (form) => {
    const data = new FormData(form);
    return {
      firstName: data.get('firstName'),
      lastName: data.get('lastName'),
      email: data.get('email'),
      phone: data.get('phone'),
      hasAgent: data.get('hasAgent'),
      agentName: data.get('agentName'),
      timeline: data.get('timeline'),
      consentToContact: data.get('consentToContact') === 'on',
    };
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = readForm(form);
    const result = validateSignIn(input);
    if (!result.ok) {
      app.go('signin', { draft: input, errors: result.errors, keepFocus: true });
      return;
    }
    form.querySelector('button[type="submit"]').disabled = true;
    const lead = createLead(result.value, { id: newId(), now: app.now(), listing });
    await app.repo.addLead(lead);
    app.leadAdded();
    app.go('thanks', { firstName: lead.firstName });
  };

  const errorCount = Object.keys(errors).length;
  const agentNameField = field({ label: 'Agent’s name', name: 'agentName', value: draft.agentName, autocomplete: 'off' });
  agentNameField.hidden = draft.hasAgent !== 'yes';

  const form = h(
    'form',
    { class: 'signin__form', novalidate: true, onSubmit },
    h('h1', { class: 'signin__title', tabindex: '-1', text: 'Sign in to tour the home' }),
    h('p', { class: 'signin__intro', text: 'The agent uses this to follow up with details, disclosures, and price changes.' }),
    errorCount > 0 &&
      h('div', { class: 'form-alert', role: 'alert', tabindex: '-1' }, h('p', { text: errorCount === 1 ? 'Fix 1 thing to continue.' : `Fix ${errorCount} things to continue.` })),
    h(
      'div',
      { class: 'form-grid' },
      field({ label: 'First name', name: 'firstName', value: draft.firstName, error: errors.firstName, autocomplete: 'given-name', autocapitalize: 'words' }),
      field({ label: 'Last name', name: 'lastName', value: draft.lastName, error: errors.lastName, autocomplete: 'family-name', autocapitalize: 'words' }),
    ),
    h(
      'div',
      { class: `contact-group${errors.contact ? ' field--error' : ''}`, dataset: { field: 'contact' } },
      h(
        'div',
        { class: 'form-grid' },
        field({ label: 'Email', name: 'email', type: 'email', value: draft.email, error: errors.email, autocomplete: 'email', autocapitalize: 'off', inputmode: 'email', spellcheck: 'false' }),
        field({ label: 'Mobile phone', name: 'phone', type: 'tel', value: draft.phone, error: errors.phone, autocomplete: 'tel', inputmode: 'tel' }),
      ),
      h('p', { class: errors.contact ? 'field__error' : 'field__hint', text: errors.contact ?? 'Email, phone, or both.' }),
    ),
    choiceGroup({
      legend: 'Are you working with a real estate agent?',
      name: 'hasAgent',
      value: draft.hasAgent,
      options: [
        { value: 'no', label: 'No' },
        { value: 'yes', label: 'Yes' },
      ],
    }),
    agentNameField,
    choiceGroup({ legend: 'When are you hoping to move?', name: 'timeline', value: draft.timeline, options: TIMELINES }),
    h(
      'label',
      { class: 'consent' },
      h('input', { type: 'checkbox', name: 'consentToContact', class: 'consent__input', checked: Boolean(draft.consentToContact) }),
      h(
        'span',
        { class: 'consent__text' },
        listing.agent?.name
          ? `${listing.agent.name} may contact me about this home and similar listings.`
          : 'The listing agent may contact me about this home and similar listings.',
      ),
    ),
    h(
      'div',
      { class: 'signin__actions' },
      button('Sign in', { variant: 'primary', size: 'lg', type: 'submit' }),
      button('Cancel', { variant: 'quiet', size: 'lg', onClick: () => app.go('welcome') }),
    ),
  );

  // Once a visitor edits a field flagged with an error, clear that error.
  form.addEventListener('input', (e) => {
    const wrapper = e.target.closest('[data-field]');
    const group = e.target.closest('[data-field="contact"]');
    for (const el of new Set([wrapper, group])) {
      if (!el?.classList.contains('field--error')) continue;
      el.classList.remove('field--error');
      if (el === group) {
        const note = group.querySelector(':scope > p');
        note.className = 'field__hint';
        note.textContent = 'Email, phone, or both.';
      } else {
        el.querySelectorAll(':scope > .field__error').forEach((m) => m.remove());
      }
    }
    e.target.removeAttribute('aria-invalid');
  });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'hasAgent') agentNameField.hidden = e.target.value !== 'yes';
  });

  const screen = h(
    'main',
    { class: 'screen signin' },
    h('div', { class: 'signin__aside' }, photo(app, listing.heroPhotoId, { alt: '' }), h('div', { class: 'signin__aside-top' }, agentDoor(app, { tone: 'dark' }))),
    h('div', { class: 'signin__panel' }, form),
  );
  root.append(screen);

  if (errorCount > 0) {
    const first = form.querySelector('[aria-invalid="true"]') ?? form.querySelector('.contact-group input');
    queueMicrotask(() => first?.focus());
  }
  // Clear half-typed personal info if a visitor walks away.
  return { idle: 'visitor', skipFocus: errorCount > 0 };
}

export function thanksScreen(root, app, { firstName = '' } = {}) {
  const screen = h(
    'main',
    { class: 'screen thanks' },
    h(
      'div',
      { class: 'thanks__panel' },
      h('h1', { class: 'thanks__title', tabindex: '-1', text: firstName ? `Thanks, ${firstName}.` : 'Thanks for signing in.' }),
      h('p', { class: 'thanks__text', text: 'Enjoy the tour. Take your time, and ask if you’d like to see anything again.' }),
      h(
        'div',
        { class: 'thanks__actions' },
        app.listing.rooms.length > 0 && button('See the rooms', { variant: 'primary', size: 'lg', onClick: () => app.go('tour') }),
        button('Done', { variant: 'on-dark', size: 'lg', onClick: () => app.go('welcome') }),
      ),
    ),
  );
  root.append(screen);
  const t = setTimeout(() => app.go('welcome'), 12_000);
  return { idle: null, cleanup: () => clearTimeout(t) };
}
