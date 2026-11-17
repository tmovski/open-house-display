import { createRepo } from './data/repo.js';
import { openDatabase } from './data/db.js';
import { createPinGate } from './core/pin.js';
import { createIdleTimer } from './core/idle.js';
import { createSyncScheduler, createSyncer } from './core/sync.js';
import { createPhotoCache, toast } from './ui/components.js';
import { welcomeScreen } from './ui/welcome.js';
import { signInScreen, thanksScreen } from './ui/signin.js';
import { tourScreen } from './ui/tour.js';
import { pinScreen, setupScreen } from './ui/pin.js';
import { adminScreen } from './ui/admin/index.js';
import { setKioskMode } from './platform/bridge.js';
import { emptyListing } from './data/repo.js';

const SCREENS = {
  setup: setupScreen,
  welcome: welcomeScreen,
  signin: signInScreen,
  thanks: thanksScreen,
  tour: tourScreen,
  pin: pinScreen,
  admin: adminScreen,
};

const ADMIN_IDLE_MS = 3 * 60_000;

/**
 * Starts the app inside `root`. Everything the screens need hangs off the
 * `app` object, which makes each screen a plain function that's easy to test.
 */
export async function startApp({ root, db, fetchImpl = globalThis.fetch.bind(globalThis), now = () => Date.now(), autoSync = true } = {}) {
  const repo = createRepo(db ?? (await openDatabase()));
  const listeners = new Set();
  let current = { name: null, cleanup: null };
  let idle = null;

  const app = {
    repo,
    now,
    fetch: fetchImpl,
    listing: (await repo.getListing()) ?? null,
    settings: await repo.getSettings(),
    photos: createPhotoCache(repo),
    pinGate: createPinGate({ now }),
    lastSync: null,
    get screen() {
      return current.name;
    },

    go(name, params = {}) {
      current.cleanup?.();
      idle?.stop();
      idle = null;
      root.replaceChildren();
      document.querySelectorAll('.dialog-backdrop').forEach((d) => d.remove());

      if (!app.listing && name !== 'setup') name = 'setup';
      const result = SCREENS[name](root, app, params) ?? {};
      current = { name, cleanup: result.cleanup ?? null };
      root.dataset.screen = name;

      if (result.idle === 'visitor') {
        idle = createIdleTimer({ timeoutMs: app.settings.idleSeconds * 1000, onIdle: () => app.go('welcome') });
      } else if (result.idle === 'admin') {
        idle = createIdleTimer({
          timeoutMs: ADMIN_IDLE_MS,
          onIdle: () => {
            app.go('welcome');
            toast('Agent tools locked after 3 minutes without activity');
          },
        });
      }
      idle?.start();
      if (!result.skipFocus) root.querySelector('h1[tabindex="-1"]')?.focus({ preventScroll: true });
    },

    /** Android back button. Always handled so visitors can't back out of the app. */
    back() {
      if (current.name !== 'welcome' && current.name !== 'setup') app.go('welcome');
      return true;
    },

    async saveListing(listing) {
      app.listing = listing;
      app.listing = await repo.saveListing(listing);
      return app.listing;
    },

    async updateSettings(patch) {
      app.settings = await repo.saveSettings(patch);
      return app.settings;
    },

    async eraseEverything() {
      scheduler.stop();
      await repo.eraseEverything();
      app.listing = null;
      app.settings = await repo.getSettings();
      scheduler.start();
      app.go('setup');
    },

    leadAdded: () => scheduler.kick(),
    syncNow: () => scheduler.runNow(),
    onSyncResult(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  const syncer = createSyncer({ repo, fetchImpl: (...a) => app.fetch(...a), getSettings: () => repo.getSettings(), now });
  const scheduler = createSyncScheduler({
    syncer,
    onResult: (result) => {
      app.lastSync = { ...result, at: new Date(now()).toISOString() };
      listeners.forEach((fn) => fn(app.lastSync));
    },
  });

  if (autoSync) {
    scheduler.start();
    globalThis.addEventListener?.('online', () => scheduler.kick());
  }
  if (app.settings.kioskMode) setKioskMode(true);

  globalThis.OpenHouse = { onBack: () => app.back() };
  app.go(app.listing ? 'welcome' : 'setup');
  app.scheduler = scheduler;
  return app;
}

export { emptyListing };
