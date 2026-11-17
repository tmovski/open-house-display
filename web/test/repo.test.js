import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyListing } from '../site/js/data/repo.js';
import { createDemoListing } from '../site/js/data/demo.js';
import { freshRepo, makeLead } from './helpers.js';

describe('repo', () => {
  it('returns default settings and merges updates', async () => {
    const repo = await freshRepo();
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
    await repo.saveSettings({ idleSeconds: 180 });
    expect(await repo.getSettings()).toMatchObject({ idleSeconds: 180, serverUrl: '' });
  });

  it('keeps a stable device id', async () => {
    const repo = await freshRepo();
    expect(await repo.deviceId()).toBe(await repo.deviceId());
  });

  it('lists leads newest first and counts their sync state', async () => {
    const repo = await freshRepo();
    await repo.addLead(makeLead({ id: 'lead-old-0001', createdAt: '2026-09-19T10:00:00.000Z' }));
    await repo.addLead(makeLead({ id: 'lead-new-0002', createdAt: '2026-09-20T10:00:00.000Z' }));
    expect((await repo.listLeads()).map((l) => l.id)).toEqual(['lead-new-0002', 'lead-old-0001']);

    await repo.markSynced(['lead-old-0001'], '2026-09-20T11:00:00.000Z');
    expect(await repo.counts()).toEqual({ total: 2, waiting: 1, problems: 0 });
    expect(await repo.deleteSyncedLeads()).toBe(1);
    expect(await repo.counts()).toEqual({ total: 1, waiting: 1, problems: 0 });
    await repo.deleteAllLeads();
    expect(await repo.counts()).toEqual({ total: 0, waiting: 0, problems: 0 });
  });

  it('refuses duplicate lead ids', async () => {
    const repo = await freshRepo();
    await repo.addLead(makeLead({ id: 'lead-dupe-0001' }));
    await expect(repo.addLead(makeLead({ id: 'lead-dupe-0001' }))).rejects.toBeTruthy();
  });

  it('deletes photos the listing no longer uses', async () => {
    const repo = await freshRepo();
    const listing = await createDemoListing(repo);
    expect(await repo.pruneOrphanPhotos(listing)).toBe(0);

    const removed = listing.rooms.pop();
    const pruned = await repo.pruneOrphanPhotos(listing);
    expect(pruned).toBe(removed.photos.length);
    expect(await repo.getPhoto(removed.photos[0].id)).toBeUndefined();
    expect(await repo.getPhoto(listing.heroPhotoId)).toBeTruthy();
  });

  it('builds a sample listing whose photos all exist', async () => {
    const repo = await freshRepo();
    const listing = await createDemoListing(repo);
    expect(listing.rooms.length).toBeGreaterThan(3);
    for (const p of listing.rooms.flatMap((r) => r.photos)) {
      const record = await repo.getPhoto(p.id);
      expect(record.blob.type).toBe('image/svg+xml');
    }
  });

  it('erases everything', async () => {
    const repo = await freshRepo();
    await repo.saveListing(emptyListing());
    await repo.addLead(makeLead());
    await repo.eraseEverything();
    expect(await repo.getListing()).toBeUndefined();
    expect(await repo.counts()).toMatchObject({ total: 0 });
  });
});
