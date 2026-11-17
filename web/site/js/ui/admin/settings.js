import { h } from '../dom.js';
import { button, confirmDialog, field, toast } from '../components.js';
import { hashPin, isValidPin, verifyPin } from '../../core/pin.js';
import { leadsEndpoint } from '../../core/sync.js';
import { createDemoListing } from '../../data/demo.js';
import { emptyListing } from '../../data/repo.js';
import { appVersion, exitApp, isNativeApp, setKioskMode } from '../../platform/bridge.js';

export function settingsTab(panel, app) {
  const s = app.settings;

  const syncForm = h(
    'form',
    {
      class: 'admin-section',
      novalidate: true,
      onSubmit: async (e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        const serverUrl = String(d.get('serverUrl')).trim();
        if (serverUrl && !leadsEndpoint(serverUrl)) {
          toast('The server address must start with https:// or http://', { tone: 'error' });
          return;
        }
        await app.updateSettings({ serverUrl, apiKey: String(d.get('apiKey')).trim() });
        toast(serverUrl ? 'Sync settings saved' : 'Sync turned off', { tone: 'success' });
        if (serverUrl) app.syncNow();
      },
    },
    h('h2', { class: 'admin-section__title', text: 'Back up sign-ins to a server' }),
    h('p', { class: 'admin-section__intro', text: 'Sign-ins are always saved on this tablet first. With a server connected, they’re also copied there whenever the tablet is online.' }),
    h(
      'div',
      { class: 'form-grid' },
      field({ label: 'Server address', name: 'serverUrl', type: 'url', value: s.serverUrl, placeholder: 'https://leads.example.com', autocapitalize: 'off', spellcheck: 'false' }),
      field({ label: 'API key', name: 'apiKey', type: 'password', value: s.apiKey, autocomplete: 'off', hint: 'The key set on your server' }),
    ),
    h(
      'div',
      { class: 'admin-form__actions' },
      button('Save sync settings', { variant: 'primary', type: 'submit' }),
      button('Test connection', {
        variant: 'secondary',
        onClick: async () => {
          const input = syncForm.querySelector('[name="serverUrl"]').value;
          const endpoint = leadsEndpoint(input);
          if (!endpoint) return toast('Enter a server address first.', { tone: 'error' });
          try {
            const res = await app.fetch(endpoint.replace(/\/api\/leads$/, '/healthz'));
            toast(res.ok ? 'Connected to the server' : `The server responded with ${res.status}`, { tone: res.ok ? 'success' : 'error' });
          } catch {
            toast('Couldn’t reach that address. Check it and the tablet’s Wi-Fi.', { tone: 'error' });
          }
        },
      }),
    ),
  );

  const kioskToggle = h('input', {
    type: 'checkbox',
    class: 'switch__input',
    id: 'kiosk-toggle',
    checked: Boolean(s.kioskMode),
    disabled: !isNativeApp(),
    onChange: async (e) => {
      await app.updateSettings({ kioskMode: e.target.checked });
      setKioskMode(e.target.checked);
    },
  });

  const displaySection = h(
    'div',
    { class: 'admin-section' },
    h('h2', { class: 'admin-section__title', text: 'Display' }),
    h(
      'div',
      { class: 'field' },
      h('label', { class: 'field__label', for: 'idle-select', text: 'Return to the welcome screen after' }),
      h('p', { class: 'field__hint', text: 'If nobody touches the screen. Half-finished sign-ins are cleared.' }),
      h(
        'select',
        {
          id: 'idle-select',
          class: 'input input--select',
          onChange: async (e) => {
            await app.updateSettings({ idleSeconds: Number(e.target.value) });
            toast('Saved', { tone: 'success' });
          },
        },
        [45, 90, 180, 300].map((sec) => h('option', { value: String(sec), selected: sec === s.idleSeconds, text: sec < 120 ? `${sec} seconds` : `${sec / 60} minutes` })),
      ),
    ),
    h(
      'div',
      { class: 'switch' },
      kioskToggle,
      h(
        'label',
        { class: 'switch__label', for: 'kiosk-toggle' },
        h('span', { class: 'switch__title', text: 'Kiosk mode' }),
        h('span', { class: 'field__hint', text: isNativeApp() ? 'Pins the app to the screen so visitors can’t leave it or open other apps.' : 'Available in the Android app.' }),
      ),
    ),
  );

  const pinForm = h(
    'form',
    {
      class: 'admin-section',
      novalidate: true,
      onSubmit: async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const d = new FormData(form);
        const [current, next, confirm] = ['currentPin', 'newPin', 'confirmPin'].map((k) => String(d.get(k)));
        if (!(await verifyPin(current, await app.repo.getPinRecord()))) return toast('Your current PIN is incorrect.', { tone: 'error' });
        if (!isValidPin(next)) return toast('The new PIN must be 4 to 8 digits.', { tone: 'error' });
        if (next !== confirm) return toast('The new PINs don’t match.', { tone: 'error' });
        await app.repo.savePinRecord(await hashPin(next));
        form.reset();
        toast('PIN changed', { tone: 'success' });
      },
    },
    h('h2', { class: 'admin-section__title', text: 'Change PIN' }),
    h(
      'div',
      { class: 'form-grid form-grid--three' },
      field({ label: 'Current PIN', name: 'currentPin', type: 'password', inputmode: 'numeric', autocomplete: 'current-password', maxlength: '8' }),
      field({ label: 'New PIN', name: 'newPin', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: '8' }),
      field({ label: 'Confirm new PIN', name: 'confirmPin', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: '8' }),
    ),
    h('div', { class: 'admin-form__actions' }, button('Change PIN', { variant: 'secondary', type: 'submit' })),
  );

  const listingSection = h(
    'div',
    { class: 'admin-section' },
    h('h2', { class: 'admin-section__title', text: 'Listing' }),
    h('p', { class: 'admin-section__intro', text: 'Moving on to a new home? Start fresh. Sign-ins from earlier open houses stay on the tablet.' }),
    h(
      'div',
      { class: 'admin-form__actions' },
      button('Start a new listing', {
        variant: 'secondary',
        onClick: async () => {
          const ok = await confirmDialog({ title: 'Start a new listing?', body: 'The current listing’s details and photos will be removed. Sign-ins are kept.', confirmLabel: 'Start new listing', danger: true });
          if (!ok) return;
          const next = { ...emptyListing(), agent: app.listing.agent };
          await app.saveListing(next);
          await app.repo.pruneOrphanPhotos(next);
          app.go('admin', { tab: 'listing' });
        },
      }),
      button('Load the sample listing', {
        variant: 'quiet',
        onClick: async () => {
          const ok = await confirmDialog({ title: 'Replace with the sample listing?', body: 'The current listing’s details and photos will be removed. Sign-ins are kept.', confirmLabel: 'Load sample' });
          if (!ok) return;
          const next = await createDemoListing(app.repo);
          await app.saveListing(next);
          await app.repo.pruneOrphanPhotos(next);
          app.go('admin', { tab: 'rooms' });
        },
      }),
    ),
  );

  const dangerSection = h(
    'div',
    { class: 'admin-section admin-section--danger' },
    h('h2', { class: 'admin-section__title', text: 'Erase this tablet' }),
    h('p', { class: 'admin-section__intro', text: 'Removes the listing, photos, sign-ins, settings, and PIN, and returns to first-time setup.' }),
    h(
      'div',
      { class: 'admin-form__actions' },
      button('Erase everything', {
        variant: 'danger',
        onClick: async () => {
          const { waiting } = await app.repo.counts();
          const ok = await confirmDialog({
            title: 'Erase everything on this tablet?',
            body: waiting > 0 ? `${waiting} sign-ins haven’t been synced or may not be exported. This can’t be undone.` : 'This can’t be undone.',
            confirmLabel: 'Erase everything',
            danger: true,
          });
          if (!ok) return;
          setKioskMode(false);
          await app.eraseEverything();
        },
      }),
      isNativeApp() &&
        button('Close the app', {
          variant: 'quiet',
          onClick: () => {
            setKioskMode(false);
            exitApp();
          },
        }),
    ),
    h('p', { class: 'field__hint', text: `App version ${appVersion()}` }),
  );

  panel.append(syncForm, displaySection, pinForm, listingSection, dangerSection);
}
