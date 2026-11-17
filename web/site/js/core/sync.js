/**
 * Offline-first sync. Sign-ins are always saved on the tablet first; this
 * module pushes unsent ones to the server whenever it can reach it.
 *
 * Safe to retry: every lead carries a unique id, and the server ignores ids it
 * has already stored, so a dropped connection mid-upload never creates duplicates.
 */

export function leadsEndpoint(serverUrl) {
  const base = String(serverUrl ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) return '';
  return `${base}/api/leads`;
}

export function createSyncer({ repo, fetchImpl = globalThis.fetch, getSettings, now = () => Date.now(), batchSize = 50 }) {
  let running = null;

  async function pushBatches() {
    const settings = await getSettings();
    const url = leadsEndpoint(settings.serverUrl);
    if (!url || !settings.apiKey) return { state: 'off', sent: 0 };

    let sent = 0;
    let rejected = 0;
    for (;;) {
      const batch = await repo.unsyncedLeads(batchSize);
      if (batch.length === 0) break;

      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({ deviceId: await repo.deviceId(), leads: batch.map(toWire) }),
      });
      if (!res.ok) {
        const reason = res.status === 401 ? 'The server rejected the API key.' : `The server responded with ${res.status}.`;
        const err = new Error(reason);
        err.status = res.status;
        throw err;
      }
      const body = await res.json();
      const at = new Date(now()).toISOString();
      const accepted = Array.isArray(body.accepted) ? body.accepted : [];
      const rejects = Array.isArray(body.rejected) ? body.rejected : [];
      await repo.markSynced(accepted, at);
      await repo.markRejected(rejects, at);
      sent += accepted.length;
      rejected += rejects.length;
      // Guard against a misbehaving server that acknowledges nothing: stop instead of looping forever.
      if (accepted.length + rejects.length === 0) throw new Error('The server did not confirm any sign-ins.');
      if (batch.length < batchSize) break;
    }
    return { state: sent + rejected === 0 ? 'up-to-date' : 'synced', sent, rejected };
  }

  return {
    /** Runs one sync pass. Concurrent calls share the same pass. */
    sync() {
      if (!running) {
        running = pushBatches()
          .catch((error) => ({ state: 'error', sent: 0, error: error.message || 'Could not reach the server.' }))
          .finally(() => {
            running = null;
          });
      }
      return running;
    },
  };
}

function toWire(lead) {
  const { synced, syncedAt, syncError, ...rest } = lead;
  return rest;
}

/** Retry delay after `failures` consecutive failed attempts: 30s, 1m, 2m, ... capped at 15m. */
export function backoffDelay(failures, { baseMs = 30_000, maxMs = 15 * 60_000 } = {}) {
  if (failures <= 0) return baseMs;
  return Math.min(maxMs, baseMs * 2 ** (failures - 1));
}

/**
 * Runs the syncer on a schedule: soon after `kick()` (a new sign-in or the
 * network coming back), every few minutes when healthy, and with growing
 * delays while the server is unreachable.
 */
export function createSyncScheduler({ syncer, onResult = () => {}, timers = globalThis, healthyMs = 5 * 60_000, kickDelayMs = 1_500 }) {
  let timer = null;
  let failures = 0;
  let stopped = true;

  const schedule = (ms) => {
    if (stopped) return;
    timers.clearTimeout(timer);
    timer = timers.setTimeout(run, ms);
  };

  async function run() {
    const result = await syncer.sync();
    failures = result.state === 'error' ? failures + 1 : 0;
    onResult(result);
    schedule(result.state === 'error' ? backoffDelay(failures) : healthyMs);
    return result;
  }

  return {
    start() {
      stopped = false;
      schedule(kickDelayMs);
    },
    stop() {
      stopped = true;
      timers.clearTimeout(timer);
    },
    kick: () => schedule(kickDelayMs),
    runNow: () => run(),
    get failures() {
      return failures;
    },
  };
}
