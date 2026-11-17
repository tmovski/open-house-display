import { createApp } from './app.js';
import { openStore } from './db.js';

const apiKeys = (process.env.API_KEYS ?? process.env.API_KEY ?? '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

if (apiKeys.length === 0 || apiKeys.some((k) => k.length < 24)) {
  console.error('Set API_KEY (or comma-separated API_KEYS) to a random value at least 24 characters long.');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'base64url\'))"');
  process.exit(1);
}

const store = openStore(process.env.DATABASE_FILE ?? 'leads.db');
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'https://appassets.androidplatform.net,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const port = Number(process.env.PORT ?? 8787);
const server = createApp({ store, apiKeys, allowedOrigins }).listen(port, () => {
  console.log(`Open House Display server listening on port ${port}`);
});

const shutdown = () => server.close(() => {
  store.close();
  process.exit(0);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
