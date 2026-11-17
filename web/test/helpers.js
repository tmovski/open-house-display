import { IDBFactory } from 'fake-indexeddb';
import { openDatabase } from '../site/js/data/db.js';
import { createRepo } from '../site/js/data/repo.js';

/** A brand-new, empty database for each test. */
export async function freshDb() {
  return openDatabase({ indexedDB: new IDBFactory() });
}

export async function freshRepo() {
  return createRepo(await freshDb());
}

export function makeLead(over = {}) {
  return {
    id: over.id ?? `lead-${Math.random().toString(36).slice(2, 12)}`,
    createdAt: '2026-09-20T14:00:00.000Z',
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
    synced: 0,
    syncedAt: null,
    syncError: null,
    ...over,
  };
}
