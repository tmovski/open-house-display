import { transact } from './db.js';
import { newId } from '../core/ids.js';

export const DEFAULT_SETTINGS = Object.freeze({
  serverUrl: '',
  apiKey: '',
  idleSeconds: 90,
  kioskMode: false,
});

export function emptyListing() {
  return {
    id: newId(),
    address: { street: '', city: '', state: 'MI', zip: '' },
    price: 0,
    beds: 0,
    baths: 0,
    sqft: 0,
    description: '',
    heroPhotoId: null,
    agent: { name: '', brokerage: '', phone: '', email: '' },
    rooms: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Everything the app stores, behind plain async functions.
 * UI code never touches IndexedDB directly, which keeps screens simple and
 * lets tests swap in an in-memory database.
 */
export function createRepo(db) {
  const kvGet = (key) => transact(db, 'kv', 'readonly', ({ kv }, done) => done(kv.get(key)));
  const kvSet = (key, value) => transact(db, 'kv', 'readwrite', ({ kv }, done) => done(kv.put(value, key)));

  return {
    // Listing
    getListing: () => kvGet('listing'),
    async saveListing(listing) {
      const next = { ...listing, updatedAt: new Date().toISOString() };
      await kvSet('listing', next);
      return next;
    },

    // Settings
    async getSettings() {
      return { ...DEFAULT_SETTINGS, ...((await kvGet('settings')) ?? {}) };
    },
    async saveSettings(patch) {
      const next = { ...(await this.getSettings()), ...patch };
      await kvSet('settings', next);
      return next;
    },

    // PIN
    getPinRecord: () => kvGet('pin'),
    savePinRecord: (record) => kvSet('pin', record),

    async deviceId() {
      let id = await kvGet('deviceId');
      if (!id) {
        id = newId();
        await kvSet('deviceId', id);
      }
      return id;
    },

    // Photos (stored as Blobs so they work with no internet connection)
    async putPhoto({ blob, width = 0, height = 0 }) {
      const record = { id: newId(), blob, width, height, addedAt: new Date().toISOString() };
      await transact(db, 'photos', 'readwrite', ({ photos }, done) => done(photos.put(record)));
      return record.id;
    },
    getPhoto: (id) => transact(db, 'photos', 'readonly', ({ photos }, done) => done(photos.get(id))),
    async deletePhotos(ids) {
      await transact(db, 'photos', 'readwrite', async ({ photos }, done) => {
        for (const id of ids) await done(photos.delete(id));
      });
    },
    /** Removes stored photos the listing no longer references. */
    async pruneOrphanPhotos(listing) {
      const used = new Set([listing?.heroPhotoId, ...(listing?.rooms ?? []).flatMap((r) => r.photos.map((p) => p.id))]);
      const all = await transact(db, 'photos', 'readonly', ({ photos }, done) => done(photos.getAllKeys()));
      const orphans = all.filter((id) => !used.has(id));
      if (orphans.length) await this.deletePhotos(orphans);
      return orphans.length;
    },

    // Leads
    async addLead(lead) {
      await transact(db, 'leads', 'readwrite', ({ leads }, done) => done(leads.add(lead)));
      return lead;
    },
    async listLeads() {
      const all = await transact(db, 'leads', 'readonly', ({ leads }, done) => done(leads.getAll()));
      return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async unsyncedLeads(limit = 50) {
      const pending = await transact(db, 'leads', 'readonly', ({ leads }, done) =>
        done(leads.index('bySynced').getAll(0)),
      );
      return pending
        .filter((l) => !l.syncError)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit);
    },
    async markSynced(ids, at) {
      await updateLeads(db, ids, (lead) => ({ ...lead, synced: 1, syncedAt: at, syncError: null }));
    },
    /** Leads the server refused (bad data) are flagged so they aren't retried forever. */
    async markRejected(items, at) {
      const reasons = new Map(items.map((r) => [r.id, r.errors]));
      await updateLeads(db, [...reasons.keys()], (lead) => ({
        ...lead,
        syncError: { at, errors: reasons.get(lead.id) ?? {} },
      }));
    },
    async retryRejected() {
      const all = await this.listLeads();
      await updateLeads(
        db,
        all.filter((l) => l.syncError).map((l) => l.id),
        (lead) => ({ ...lead, syncError: null }),
      );
    },
    async counts() {
      const all = await this.listLeads();
      return {
        total: all.length,
        waiting: all.filter((l) => !l.synced && !l.syncError).length,
        problems: all.filter((l) => l.syncError).length,
      };
    },
    async deleteSyncedLeads() {
      const synced = (await this.listLeads()).filter((l) => l.synced);
      await transact(db, 'leads', 'readwrite', async ({ leads }, done) => {
        for (const l of synced) await done(leads.delete(l.id));
      });
      return synced.length;
    },

    async deleteAllLeads() {
      await transact(db, 'leads', 'readwrite', ({ leads }, done) => done(leads.clear()));
    },

    async eraseEverything() {
      await transact(db, ['kv', 'photos', 'leads'], 'readwrite', async ({ kv, photos, leads }, done) => {
        await done(kv.clear());
        await done(photos.clear());
        await done(leads.clear());
      });
    },
  };
}

async function updateLeads(db, ids, change) {
  if (!ids.length) return;
  await transact(db, 'leads', 'readwrite', async ({ leads }, done) => {
    for (const id of ids) {
      const lead = await done(leads.get(id));
      if (lead) await done(leads.put(change(lead)));
    }
  });
}
