import { describe, expect, it, vi } from 'vitest';
import { backoffDelay, createSyncScheduler, createSyncer, leadsEndpoint } from '../site/js/core/sync.js';
import { freshRepo, makeLead } from './helpers.js';

const settingsOn = { serverUrl: 'https://leads.example.com/', apiKey: 'secret-key' };

/** Fake server: accepts everything except leads whose firstName is "BAD". */
function fakeServer({ status = 200 } = {}) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    if (status !== 200) return { ok: false, status, json: async () => ({}) };
    const accepted = body.leads.filter((l) => l.firstName !== 'BAD').map((l) => l.id);
    const rejected = body.leads.filter((l) => l.firstName === 'BAD').map((l) => ({ id: l.id, errors: { firstName: 'Bad name' } }));
    return { ok: true, status: 200, json: async () => ({ accepted, rejected }) };
  });
  return { fetchImpl, calls };
}

describe('leadsEndpoint', () => {
  it('builds the API URL and refuses non-http addresses', () => {
    expect(leadsEndpoint('https://a.example.com///')).toBe('https://a.example.com/api/leads');
    expect(leadsEndpoint('ftp://a')).toBe('');
    expect(leadsEndpoint('')).toBe('');
  });
});

describe('createSyncer', () => {
  it('does nothing while sync is not configured', async () => {
    const repo = await freshRepo();
    const { fetchImpl } = fakeServer();
    const result = await createSyncer({ repo, fetchImpl, getSettings: async () => ({ serverUrl: '', apiKey: '' }) }).sync();
    expect(result.state).toBe('off');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uploads unsynced leads with the API key and marks them synced', async () => {
    const repo = await freshRepo();
    await repo.addLead(makeLead({ id: 'lead-a-0001' }));
    await repo.addLead(makeLead({ id: 'lead-b-0002' }));
    const { fetchImpl, calls } = fakeServer();
    const syncer = createSyncer({ repo, fetchImpl, getSettings: async () => settingsOn, now: () => Date.UTC(2026, 8, 20) });

    const result = await syncer.sync();
    expect(result).toMatchObject({ state: 'synced', sent: 2 });
    expect(calls[0].url).toBe('https://leads.example.com/api/leads');
    expect(calls[0].headers.Authorization).toBe('Bearer secret-key');
    expect(calls[0].body.leads[0]).not.toHaveProperty('synced');
    expect(await repo.unsyncedLeads()).toHaveLength(0);
    expect((await repo.listLeads())[0].syncedAt).toBe('2026-09-20T00:00:00.000Z');

    expect((await syncer.sync()).state).toBe('up-to-date');
    expect(calls).toHaveLength(1);
  });

  it('sends in batches', async () => {
    const repo = await freshRepo();
    for (let i = 0; i < 5; i++) await repo.addLead(makeLead({ id: `lead-${i}-batch`, createdAt: `2026-09-20T14:0${i}:00.000Z` }));
    const { calls, fetchImpl } = fakeServer();
    const result = await createSyncer({ repo, fetchImpl, getSettings: async () => settingsOn, batchSize: 2 }).sync();
    expect(result.sent).toBe(5);
    expect(calls.map((c) => c.body.leads.length)).toEqual([2, 2, 1]);
    expect(calls[0].body.leads[0].id).toBe('lead-0-batch'); // oldest first
  });

  it('flags rejected leads so they are not retried forever', async () => {
    const repo = await freshRepo();
    await repo.addLead(makeLead({ id: 'lead-bad-0001', firstName: 'BAD' }));
    const { fetchImpl } = fakeServer();
    const syncer = createSyncer({ repo, fetchImpl, getSettings: async () => settingsOn });
    expect(await syncer.sync()).toMatchObject({ state: 'synced', sent: 0, rejected: 1 });
    expect(await repo.counts()).toEqual({ total: 1, waiting: 0, problems: 1 });
    await repo.retryRejected();
    expect(await repo.counts()).toMatchObject({ waiting: 1, problems: 0 });
  });

  it('keeps leads on the tablet when the server fails', async () => {
    const repo = await freshRepo();
    await repo.addLead(makeLead({ id: 'lead-keep-0001' }));
    const { fetchImpl } = fakeServer({ status: 401 });
    const result = await createSyncer({ repo, fetchImpl, getSettings: async () => settingsOn }).sync();
    expect(result.state).toBe('error');
    expect(result.error).toMatch(/API key/);
    expect(await repo.unsyncedLeads()).toHaveLength(1);
  });

  it('reports network errors instead of throwing', async () => {
    const repo = await freshRepo();
    await repo.addLead(makeLead({ id: 'lead-net-0001' }));
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await createSyncer({ repo, fetchImpl, getSettings: async () => settingsOn }).sync();
    expect(result).toMatchObject({ state: 'error', error: 'Failed to fetch' });
  });

  it('shares one pass between overlapping calls', async () => {
    const repo = await freshRepo();
    await repo.addLead(makeLead({ id: 'lead-once-0001' }));
    const { fetchImpl } = fakeServer();
    const syncer = createSyncer({ repo, fetchImpl, getSettings: async () => settingsOn });
    const [a, b] = await Promise.all([syncer.sync(), syncer.sync()]);
    expect(a).toBe(b);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('scheduling', () => {
  it('backs off 30s, 1m, 2m ... up to 15m', () => {
    expect([1, 2, 3, 4, 10].map((n) => backoffDelay(n))).toEqual([30_000, 60_000, 120_000, 240_000, 900_000]);
  });

  it('retries sooner after success and later after failures', async () => {
    vi.useFakeTimers();
    const results = [{ state: 'error', error: 'x' }, { state: 'error', error: 'x' }, { state: 'synced', sent: 1 }];
    const syncer = { sync: vi.fn(async () => results.shift() ?? { state: 'up-to-date' }) };
    const onResult = vi.fn();
    const scheduler = createSyncScheduler({ syncer, onResult, healthyMs: 300_000, kickDelayMs: 1_000 });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(syncer.sync).toHaveBeenCalledTimes(1);
    expect(scheduler.failures).toBe(1);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(syncer.sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(syncer.sync).toHaveBeenCalledTimes(2);

    scheduler.kick(); // a new sign-in shortcuts the backoff
    await vi.advanceTimersByTimeAsync(1_000);
    expect(syncer.sync).toHaveBeenCalledTimes(3);
    expect(scheduler.failures).toBe(0);
    expect(onResult).toHaveBeenLastCalledWith({ state: 'synced', sent: 1 });

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(syncer.sync).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
