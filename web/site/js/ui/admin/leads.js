import { fill, h } from '../dom.js';
import { button, confirmDialog, toast } from '../components.js';
import { formatPhone, timelineLabel } from '../../core/lead.js';
import { csvFileName, leadsToCsv } from '../../core/csv.js';
import { formatDateTime, plural } from '../../core/format.js';
import { saveCsvFile } from '../../platform/bridge.js';

export function leadsTab(panel, app, { refreshBadge }) {
  const summary = h('div', { class: 'lead-summary' });
  const syncLine = h('p', { class: 'sync-line', role: 'status', 'aria-live': 'polite' });
  const actions = h('div', { class: 'lead-actions' });
  const tableWrap = h('div', { class: 'table-wrap' });
  let disposed = false;

  function describeSync(settingsOn, counts) {
    if (!settingsOn) return 'Sync is off. Sign-ins stay on this tablet until you export them. Connect a server in Settings to back them up automatically.';
    const r = app.lastSync;
    if (r?.state === 'error') return `Last sync failed: ${r.error} Sign-ins are safe on this tablet and will retry automatically.`;
    if (counts.waiting > 0) return `${plural(counts.waiting, 'sign-in')} waiting to sync.`;
    if (r?.at) return `Everything is synced. Last checked ${formatDateTime(r.at)}.`;
    return 'Everything is synced.';
  }

  async function render() {
    const [leads, counts, settings] = await Promise.all([app.repo.listLeads(), app.repo.counts(), app.repo.getSettings()]);
    if (disposed) return;
    const syncOn = Boolean(settings.serverUrl && settings.apiKey);

    fill(summary, 
      stat(counts.total, counts.total === 1 ? 'sign-in on this tablet' : 'sign-ins on this tablet'),
      syncOn && stat(counts.waiting, 'waiting to sync'),
      counts.problems > 0 && stat(counts.problems, 'need attention', 'stat--warn'),
    );
    syncLine.textContent = describeSync(syncOn, counts);

    fill(actions, 
      button('Export to spreadsheet', {
        variant: 'primary',
        disabled: leads.length === 0,
        onClick: () => {
          const how = saveCsvFile(csvFileName(new Date(app.now())), leadsToCsv(leads));
          toast(how === 'shared' ? 'Choose where to send the spreadsheet' : 'Spreadsheet downloaded', { tone: 'success' });
        },
      }),
      syncOn &&
        button('Sync now', {
          variant: 'secondary',
          onClick: async (e) => {
            e.currentTarget.disabled = true;
            const result = await app.syncNow();
            toast(result.state === 'error' ? `Sync failed: ${result.error}` : result.sent ? `Synced ${plural(result.sent, 'sign-in')}` : 'Already up to date', {
              tone: result.state === 'error' ? 'error' : 'success',
            });
            render();
          },
        }),
      counts.problems > 0 &&
        button('Retry failed sign-ins', {
          variant: 'secondary',
          onClick: async () => {
            await app.repo.retryRejected();
            await app.syncNow();
            render();
          },
        }),
      syncOn &&
        leads.some((l) => l.synced) &&
        button('Clear synced sign-ins', {
          variant: 'quiet',
          onClick: async () => {
            const ok = await confirmDialog({ title: 'Clear synced sign-ins?', body: 'They are already saved on your server. This only removes the copies on this tablet.', confirmLabel: 'Clear synced' });
            if (!ok) return;
            const n = await app.repo.deleteSyncedLeads();
            toast(`Cleared ${plural(n, 'sign-in')}`);
            render();
            refreshBadge();
          },
        }),
      leads.length > 0 &&
        button('Delete all sign-ins', {
          variant: 'quiet-danger',
          onClick: async () => {
            const unsynced = leads.filter((l) => !l.synced).length;
            const ok = await confirmDialog({
              title: `Delete ${plural(leads.length, 'sign-in')}?`,
              body: unsynced > 0 ? `${plural(unsynced, 'sign-in')} haven’t been synced. Export them first; deleted sign-ins can’t be recovered.` : 'Deleted sign-ins can’t be recovered from this tablet.',
              confirmLabel: 'Delete all',
              danger: true,
            });
            if (!ok) return;
            await app.repo.deleteAllLeads();
            toast('Sign-ins deleted');
            render();
            refreshBadge();
          },
        }),
    );

    tableWrap.replaceChildren(
      leads.length === 0
        ? h('p', { class: 'empty-state', text: 'No sign-ins yet. When visitors sign in on the welcome screen, they show up here.' })
        : h(
            'table',
            { class: 'lead-table' },
            h('caption', { class: 'visually-hidden', text: 'Visitor sign-ins, newest first' }),
            h('thead', {}, h('tr', {}, ['Name', 'Contact', 'Has agent', 'Timeline', 'Signed in', 'Status'].map((c) => h('th', { scope: 'col', text: c })))),
            h(
              'tbody',
              {},
              leads.map((l) =>
                h(
                  'tr',
                  {},
                  h('td', { class: 'lead-table__name', text: `${l.firstName} ${l.lastName}` }),
                  h('td', {}, l.email && h('span', { class: 'lead-table__line', text: l.email }), l.phone && h('span', { class: 'lead-table__line', text: formatPhone(l.phone) })),
                  h('td', { text: l.hasAgent === 'yes' ? l.agentName || 'Yes' : l.hasAgent === 'no' ? 'No' : '' }),
                  h('td', { text: timelineLabel(l.timeline) }),
                  h('td', { text: formatDateTime(l.createdAt) }),
                  h('td', {}, statusChip(l, syncOn)),
                ),
              ),
            ),
          ),
    );
  }

  panel.append(
    h('div', { class: 'admin-section' }, h('h2', { class: 'admin-section__title', text: 'Sign-ins' }), summary, syncLine, actions, tableWrap),
  );
  render();
  const unsubscribe = app.onSyncResult(render);
  return () => {
    disposed = true;
    unsubscribe();
  };
}

function stat(value, label, extra = '') {
  return h('p', { class: `stat ${extra}` }, h('span', { class: 'stat__value', text: String(value) }), h('span', { class: 'stat__label', text: label }));
}

function statusChip(lead, syncOn) {
  if (lead.syncError) {
    const detail = Object.values(lead.syncError.errors ?? {}).join(' ');
    return h('span', { class: 'chip chip--warn', title: detail, text: 'Needs attention' });
  }
  if (lead.synced) return h('span', { class: 'chip chip--ok', text: 'Synced' });
  return h('span', { class: 'chip', text: syncOn ? 'Waiting' : 'On tablet' });
}
