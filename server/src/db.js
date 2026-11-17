import { DatabaseSync } from 'node:sqlite';

const COLUMNS = [
  ['id', 'id'],
  ['created_at', 'createdAt'],
  ['first_name', 'firstName'],
  ['last_name', 'lastName'],
  ['email', 'email'],
  ['phone', 'phone'],
  ['has_agent', 'hasAgent'],
  ['agent_name', 'agentName'],
  ['timeline', 'timeline'],
  ['consent_to_contact', 'consentToContact'],
  ['listing_id', 'listingId'],
  ['listing_address', 'listingAddress'],
];

/** SQLite storage using Node's built-in driver (no native modules to compile). */
export function openStore(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      device_id TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      has_agent TEXT NOT NULL DEFAULT '',
      agent_name TEXT NOT NULL DEFAULT '',
      timeline TEXT NOT NULL DEFAULT '',
      consent_to_contact INTEGER NOT NULL DEFAULT 0,
      listing_id TEXT NOT NULL DEFAULT '',
      listing_address TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS leads_created_at ON leads (created_at);
  `);

  // INSERT OR IGNORE makes uploads idempotent: re-sending a lead is harmless.
  const insert = db.prepare(`
    INSERT OR IGNORE INTO leads (id, created_at, received_at, device_id, first_name, last_name, email, phone,
      has_agent, agent_name, timeline, consent_to_contact, listing_id, listing_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const selectSince = db.prepare(`SELECT * FROM leads WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?`);

  const fromRow = (row) => ({
    ...Object.fromEntries(COLUMNS.map(([col, key]) => [key, row[col]])),
    consentToContact: row.consent_to_contact === 1,
    receivedAt: row.received_at,
    deviceId: row.device_id,
  });

  return {
    /** Stores leads in one transaction. Returns how many were new. */
    insertLeads(leads, { deviceId = '', receivedAt }) {
      let inserted = 0;
      db.exec('BEGIN');
      try {
        for (const l of leads) {
          const r = insert.run(l.id, l.createdAt, receivedAt, deviceId, l.firstName, l.lastName, l.email, l.phone, l.hasAgent, l.agentName, l.timeline, l.consentToContact ? 1 : 0, l.listingId, l.listingAddress);
          inserted += Number(r.changes);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return inserted;
    },
    listLeads({ since = '1970-01-01T00:00:00.000Z', limit = 1000 } = {}) {
      return selectSince.all(since, limit).map(fromRow);
    },
    close: () => db.close(),
  };
}
