import { h, icon } from '../dom.js';
import { button } from '../components.js';
import { listingTab } from './listing.js';
import { roomsTab } from './rooms.js';
import { leadsTab } from './leads.js';
import { settingsTab } from './settings.js';

const TABS = [
  { id: 'listing', label: 'Listing', render: listingTab },
  { id: 'rooms', label: 'Rooms and photos', render: roomsTab },
  { id: 'leads', label: 'Sign-ins', render: leadsTab },
  { id: 'settings', label: 'Settings', render: settingsTab },
];

export function adminScreen(root, app, { tab = 'listing' } = {}) {
  let cleanupTab = () => {};
  const panel = h('section', { class: 'admin__panel', role: 'tabpanel', tabindex: '-1' });
  const tabButtons = TABS.map((t) =>
    h('button', { type: 'button', role: 'tab', class: 'admin__tab', id: `tab-${t.id}`, dataset: { tab: t.id }, onClick: () => select(t.id) }, h('span', { text: t.label }), t.id === 'leads' && h('span', { class: 'badge', dataset: { badge: 'leads' } })),
  );

  async function refreshBadge() {
    const { total } = await app.repo.counts();
    const badge = root.querySelector('[data-badge="leads"]');
    if (badge) badge.textContent = total > 0 ? String(total) : '';
  }

  function select(id) {
    cleanupTab();
    tabButtons.forEach((b) => {
      const on = b.dataset.tab === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `tab-${id}`);
    panel.replaceChildren();
    const def = TABS.find((t) => t.id === id) ?? TABS[0];
    cleanupTab = def.render(panel, app, { refreshBadge, selectTab: select }) ?? (() => {});
  }

  const lockAndReturn = () => {
    app.go('welcome');
  };

  root.append(
    h(
      'main',
      { class: 'screen admin' },
      h(
        'header',
        { class: 'admin__header' },
        h('div', { class: 'admin__heading' }, h('h1', { class: 'admin__title', tabindex: '-1', text: 'Agent tools' }), h('p', { class: 'admin__subtitle', text: app.listing.address.street || 'New listing' })),
        h('div', { class: 'admin__tabs', role: 'tablist', 'aria-label': 'Agent tools sections' }, tabButtons),
        button('Lock and return', { variant: 'primary', iconName: 'lock', onClick: lockAndReturn }),
      ),
      panel,
    ),
  );
  select(tab);
  refreshBadge();
  const unsubscribe = app.onSyncResult(() => refreshBadge());
  return {
    idle: 'admin',
    cleanup: () => {
      cleanupTab();
      unsubscribe();
    },
  };
}

export { icon };
