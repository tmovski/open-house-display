import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
// Shared with the tablet app so both sides agree on what a valid sign-in is.
import { validateIncomingLead } from '../../web/site/js/core/lead.js';
import { leadsToCsv, csvFileName } from '../../web/site/js/core/csv.js';

const MAX_BATCH = 100;

const digest = (s) => createHash('sha256').update(String(s)).digest();

/** Constant-time comparison so response timing doesn't leak how much of a key matched. */
export function keyMatches(presented, keys) {
  if (!presented) return false;
  const p = digest(presented);
  return keys.some((k) => timingSafeEqual(p, digest(k)));
}

export function createApp({ store, apiKeys, allowedOrigins = [], now = () => new Date() }) {
  if (!apiKeys?.length) throw new Error('At least one API key is required.');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  // CORS: the Android WebView serves the app from https://appassets.androidplatform.net
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
      });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  const api = express.Router();
  api.use((req, res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!keyMatches(token, apiKeys)) return res.status(401).json({ error: 'Missing or invalid API key.' });
    next();
  });
  api.use(express.json({ limit: '1mb' }));

  api.post('/leads', (req, res) => {
    const { leads, deviceId } = req.body ?? {};
    if (!Array.isArray(leads) || leads.length === 0) return res.status(400).json({ error: 'Body must include a non-empty "leads" array.' });
    if (leads.length > MAX_BATCH) return res.status(413).json({ error: `Send at most ${MAX_BATCH} leads per request.` });

    const valid = [];
    const rejected = [];
    for (const record of leads) {
      const result = validateIncomingLead(record);
      if (result.ok) valid.push(result.value);
      else rejected.push({ id: String(record?.id ?? ''), errors: result.errors });
    }
    const inserted = store.insertLeads(valid, { deviceId: String(deviceId ?? '').slice(0, 64), receivedAt: now().toISOString() });
    // Duplicates count as accepted: the device only needs to know the server has them.
    res.json({ accepted: valid.map((l) => l.id), rejected, inserted });
  });

  api.get('/leads', (req, res) => {
    const since = req.query.since && !Number.isNaN(Date.parse(req.query.since)) ? new Date(req.query.since).toISOString() : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 5000);
    res.json({ leads: store.listLeads({ since, limit }) });
  });

  api.get('/leads.csv', (_req, res) => {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${csvFileName(now())}"` });
    res.send('\ufeff' + leadsToCsv(store.listLeads({ limit: 100_000 })));
  });

  app.use('/api', api);
  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });
  return app;
}
