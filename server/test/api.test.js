import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, keyMatches } from '../src/app.js';
import { openStore } from '../src/db.js';

const KEY = 'test-key-that-is-long-enough-123';
let server, base, store;

beforeEach(async () => {
  store = openStore(':memory:');
  const app = createApp({ store, apiKeys: [KEY], allowedOrigins: ['https://appassets.androidplatform.net'], now: () => new Date('2026-09-20T15:00:00Z') });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => {
  server.close();
  store.close();
});

const lead = (over = {}) => ({
  id: '5b0e7c1e-8c1a-4d8e-9a55-1f7f2a1b0c01',
  createdAt: '2026-09-20T14:05:00.000Z',
  firstName: 'Maya',
  lastName: 'Okafor',
  email: 'maya@example.com',
  phone: '2485550199',
  hasAgent: 'no',
  agentName: '',
  timeline: '0-3',
  consentToContact: true,
  listingId: 'listing-1',
  listingAddress: '2418 Linden Court, Northville, MI 48167',
  ...over,
});

const post = (body, key = KEY) =>
  fetch(`${base}/api/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });

test('health check needs no key', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('rejects missing or wrong API keys', async () => {
  assert.equal((await fetch(`${base}/api/leads`)).status, 401);
  assert.equal((await post({ leads: [lead()] }, 'wrong-key')).status, 401);
});

test('stores valid leads and returns their ids as accepted', async () => {
  const res = await post({ deviceId: 'tablet-1', leads: [lead()] });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.accepted, [lead().id]);
  assert.deepEqual(body.rejected, []);
  assert.equal(body.inserted, 1);

  const list = await (await fetch(`${base}/api/leads`, { headers: { Authorization: `Bearer ${KEY}` } })).json();
  assert.equal(list.leads.length, 1);
  assert.equal(list.leads[0].email, 'maya@example.com');
  assert.equal(list.leads[0].consentToContact, true);
  assert.equal(list.leads[0].deviceId, 'tablet-1');
});

test('re-sending the same lead is idempotent (no duplicates)', async () => {
  await post({ leads: [lead()] });
  const again = await (await post({ leads: [lead()] })).json();
  assert.deepEqual(again.accepted, [lead().id]);
  assert.equal(again.inserted, 0);
  assert.equal(store.listLeads().length, 1);
});

test('rejects invalid leads individually while accepting the rest', async () => {
  const bad = lead({ id: 'bad-lead-0001', firstName: '', email: 'nope', phone: '' });
  const body = await (await post({ leads: [lead(), bad] })).json();
  assert.deepEqual(body.accepted, [lead().id]);
  assert.equal(body.rejected.length, 1);
  assert.equal(body.rejected[0].id, 'bad-lead-0001');
  assert.ok(body.rejected[0].errors.firstName);
  assert.ok(body.rejected[0].errors.email);
});

test('validates the request shape and size', async () => {
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ leads: [] })).status, 400);
  const many = Array.from({ length: 101 }, (_, i) => lead({ id: `lead-id-${String(i).padStart(4, '0')}` }));
  assert.equal((await post({ leads: many })).status, 413);
  const malformed = await fetch(`${base}/api/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: '{not json' });
  assert.equal(malformed.status, 400);
});

test('CORS allows the Android WebView origin and nothing else', async () => {
  const ok = await fetch(`${base}/api/leads`, { method: 'OPTIONS', headers: { Origin: 'https://appassets.androidplatform.net' } });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://appassets.androidplatform.net');
  const other = await fetch(`${base}/api/leads`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
});

test('exports a CSV that neutralizes spreadsheet formulas', async () => {
  await post({ leads: [lead({ firstName: '=HYPERLINK("http://x")' })] });
  const res = await fetch(`${base}/api/leads.csv`, { headers: { Authorization: `Bearer ${KEY}` } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /open-house-sign-ins-2026-09-20\.csv/);
  const text = await res.text();
  assert.ok(text.includes(`"'=HYPERLINK(""http://x"")"`));
  assert.ok(text.includes('(248) 555-0199'));
});

test('keyMatches handles different lengths safely', () => {
  assert.equal(keyMatches('short', [KEY]), false);
  assert.equal(keyMatches(KEY, ['other-key-000000000000000000', KEY]), true);
  assert.equal(keyMatches('', [KEY]), false);
});
