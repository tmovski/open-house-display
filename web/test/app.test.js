// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startApp } from '../site/js/main.js';
import { hashPin } from '../site/js/core/pin.js';
import { freshDb } from './helpers.js';
import { createRepo } from '../site/js/data/repo.js';

let root;
let app;

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app');
});
afterEach(() => app?.scheduler.stop());

const settle = () => new Promise((r) => setTimeout(r, 20));
const setValue = (name, value) => {
  const el = root.querySelector(`[name="${name}"]`);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const submit = (form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

async function appWithListing() {
  const db = await freshDb();
  const repo = createRepo(db);
  await repo.savePinRecord(await hashPin('2468', { iterations: 1000 }));
  await repo.saveListing({
    id: 'L1',
    address: { street: '2418 Linden Court', city: 'Northville', state: 'MI', zip: '48167' },
    price: 489000,
    beds: 4,
    baths: 2.5,
    sqft: 2310,
    description: '',
    heroPhotoId: null,
    agent: { name: 'Alex Rivera', brokerage: '', phone: '', email: '' },
    rooms: [{ id: 'r1', name: 'Kitchen', description: 'Quartz counters', photos: [] }],
  });
  app = await startApp({ root, db, autoSync: false });
  return { app, repo };
}

describe('app', () => {
  it('starts in first-time setup and rejects mismatched PINs', async () => {
    app = await startApp({ root, db: await freshDb(), autoSync: false });
    expect(app.screen).toBe('setup');
    setValue('pin', '1234');
    setValue('confirm', '9999');
    submit(root.querySelector('form'));
    await settle();
    expect(root.textContent).toContain('don’t match');
  });

  it('shows the plaque, price, and host on the welcome screen', async () => {
    await appWithListing();
    expect(app.screen).toBe('welcome');
    expect(root.querySelector('.plaque').textContent).toBe('2418');
    expect(root.textContent).toContain('Linden Court');
    expect(root.textContent).toContain('$489,000');
    expect(root.textContent).toContain('2½');
    expect(root.textContent).toContain('Alex Rivera');
  });

  it('validates the sign-in form, then saves the lead and thanks the visitor', async () => {
    const { repo } = await appWithListing();
    app.go('signin');
    submit(root.querySelector('form'));
    await settle();
    expect(root.querySelector('[role="alert"]').textContent).toMatch(/Fix 3 things/);

    setValue('firstName', 'Maya');
    setValue('lastName', 'Okafor');
    setValue('phone', '248-555-0199');
    submit(root.querySelector('form'));
    await settle();

    expect(app.screen).toBe('thanks');
    expect(root.textContent).toContain('Thanks, Maya.');
    const [lead] = await repo.listLeads();
    expect(lead).toMatchObject({ firstName: 'Maya', phone: '2485550199', listingId: 'L1', synced: 0 });
  });

  it('keeps typed values when showing errors', async () => {
    await appWithListing();
    app.go('signin');
    setValue('firstName', 'Maya');
    setValue('email', 'not-an-email');
    submit(root.querySelector('form'));
    await settle();
    expect(root.querySelector('[name="firstName"]').value).toBe('Maya');
    expect(root.querySelector('[name="email"]').getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the agent-name field only for visitors with an agent', async () => {
    await appWithListing();
    app.go('signin');
    const agentField = root.querySelector('[data-field="agentName"]');
    expect(agentField.hidden).toBe(true);
    const yes = root.querySelector('input[name="hasAgent"][value="yes"]');
    yes.checked = true;
    yes.dispatchEvent(new Event('change', { bubbles: true }));
    expect(agentField.hidden).toBe(false);
  });

  it('treats visitor-typed text as text, never HTML', async () => {
    const { repo } = await appWithListing();
    app.go('signin');
    setValue('firstName', '<img src=x onerror="window.pwned=1">');
    setValue('lastName', 'Test');
    setValue('email', 'x@y.co');
    submit(root.querySelector('form'));
    await settle();
    expect(root.querySelector('img[src="x"]')).toBeNull();
    expect((await repo.listLeads())[0].firstName).toContain('<img');
  });

  it('unlocks agent tools only with the right PIN', async () => {
    await appWithListing();
    app.go('pin');
    const press = (k) => root.querySelector(`.pin__key[aria-label="${k}"]`).click();
    ['1', '1', '1', '1'].forEach(press);
    press('Unlock');
    await settle();
    expect(app.screen).toBe('pin');
    expect(root.textContent).toContain('didn’t match');

    ['2', '4', '6', '8'].forEach(press);
    press('Unlock');
    await settle();
    expect(app.screen).toBe('admin');
  });

  it('routes the Android back button to the welcome screen instead of exiting', async () => {
    await appWithListing();
    app.go('tour');
    expect(root.textContent).toContain('Kitchen');
    expect(globalThis.OpenHouse.onBack()).toBe(true);
    expect(app.screen).toBe('welcome');
  });

  it('lists sign-ins in agent tools without printing stray values', async () => {
    const { repo } = await appWithListing();
    await repo.addLead({ id: 'lead-view-0001', createdAt: new Date().toISOString(), firstName: 'Maya', lastName: 'Okafor', email: 'maya@example.com', phone: '', hasAgent: 'no', agentName: '', timeline: '', consentToContact: false, listingId: 'L1', listingAddress: '', synced: 0, syncedAt: null, syncError: null });
    app.go('admin', { tab: 'leads' });
    await settle();
    const text = root.querySelector('.admin__panel').textContent;
    expect(text).toContain('Maya Okafor');
    expect(text).toContain('Sync is off');
    expect(text).not.toMatch(/false|undefined|null/);
  });
});
