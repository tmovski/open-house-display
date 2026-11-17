import { h, icon, debounce } from '../dom.js';
import { button, confirmDialog, photo, toast } from '../components.js';
import { newId } from '../../core/ids.js';
import { prepareImage } from '../../platform/images.js';

export function roomsTab(panel, app) {
  // Work on a copy; every change is saved right away.
  let listing = structuredClone(app.listing);
  const status = h('p', { class: 'save-status', role: 'status', 'aria-live': 'polite' });
  const list = h('ol', { class: 'room-editor-list' });

  const persist = async () => {
    listing = await app.saveListing(listing);
    status.textContent = 'All changes saved';
  };
  const persistSoon = debounce(persist, 500);

  const move = (arr, from, to) => {
    if (to < 0 || to >= arr.length) return;
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
  };

  async function structural(change) {
    persistSoon.cancel();
    change();
    render();
    await persist();
    await app.repo.pruneOrphanPhotos(listing);
  }

  function photoTile(room, ph, index) {
    const isCover = listing.heroPhotoId === ph.id;
    return h(
      'li',
      { class: 'photo-tile' },
      h('div', { class: 'photo-tile__frame' }, photo(app, ph.id, { alt: ph.caption || `${room.name} photo ${index + 1}`, className: 'photo-tile__img' }), isCover && h('span', { class: 'photo-tile__tag', text: 'Cover' })),
      h('label', { class: 'visually-hidden', for: `cap-${ph.id}`, text: `Caption for photo ${index + 1}` }),
      h('input', {
        id: `cap-${ph.id}`,
        class: 'input input--small',
        placeholder: 'Caption (optional)',
        value: ph.caption ?? '',
        onInput: (e) => {
          ph.caption = e.target.value;
          status.textContent = 'Saving…';
          persistSoon();
        },
      }),
      h(
        'div',
        { class: 'photo-tile__actions' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move photo ${index + 1} earlier`, disabled: index === 0, onClick: () => structural(() => move(room.photos, index, index - 1)) }, icon('chevronLeft', { size: 20 })),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move photo ${index + 1} later`, disabled: index === room.photos.length - 1, onClick: () => structural(() => move(room.photos, index, index + 1)) }, icon('chevronRight', { size: 20 })),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Use photo ${index + 1} as cover`, 'aria-pressed': String(isCover), onClick: () => structural(() => (listing.heroPhotoId = ph.id)) }, icon('star', { size: 20 })),
        h(
          'button',
          {
            type: 'button',
            class: 'icon-btn icon-btn--danger',
            'aria-label': `Remove photo ${index + 1}`,
            onClick: () =>
              structural(() => {
                room.photos.splice(index, 1);
                if (listing.heroPhotoId === ph.id) listing.heroPhotoId = null;
              }),
          },
          icon('trash', { size: 20 }),
        ),
      ),
    );
  }

  function roomCard(room, i) {
    const fileId = `photos-${room.id}`;
    return h(
      'li',
      { class: 'room-editor' },
      h(
        'div',
        { class: 'room-editor__head' },
        h('label', { class: 'visually-hidden', for: `name-${room.id}`, text: 'Room name' }),
        h('input', {
          id: `name-${room.id}`,
          class: 'input room-editor__name',
          value: room.name,
          placeholder: 'Room name',
          onInput: (e) => {
            room.name = e.target.value;
            status.textContent = 'Saving…';
            persistSoon();
          },
        }),
        h(
          'div',
          { class: 'room-editor__order' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move ${room.name || 'room'} up`, disabled: i === 0, onClick: () => structural(() => move(listing.rooms, i, i - 1)) }, icon('up', { size: 20 })),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move ${room.name || 'room'} down`, disabled: i === listing.rooms.length - 1, onClick: () => structural(() => move(listing.rooms, i, i + 1)) }, icon('down', { size: 20 })),
          h(
            'button',
            {
              type: 'button',
              class: 'icon-btn icon-btn--danger',
              'aria-label': `Remove ${room.name || 'room'}`,
              onClick: async () => {
                const ok = await confirmDialog({
                  title: `Remove ${room.name || 'this room'}?`,
                  body: `Its ${room.photos.length === 1 ? 'photo' : `${room.photos.length} photos`} will be deleted from this tablet.`,
                  confirmLabel: 'Remove room',
                  danger: true,
                });
                if (!ok) return;
                await structural(() => {
                  listing.rooms.splice(i, 1);
                  if (room.photos.some((p) => p.id === listing.heroPhotoId)) listing.heroPhotoId = null;
                });
                toast('Room removed');
              },
            },
            icon('trash', { size: 20 }),
          ),
        ),
      ),
      h('label', { class: 'visually-hidden', for: `desc-${room.id}`, text: `${room.name} description` }),
      h('textarea', {
        id: `desc-${room.id}`,
        class: 'input input--multiline',
        rows: 2,
        placeholder: 'What should visitors notice here? (optional)',
        value: room.description ?? '',
        onInput: (e) => {
          room.description = e.target.value;
          status.textContent = 'Saving…';
          persistSoon();
        },
      }),
      h('ul', { class: 'photo-grid' }, room.photos.map((ph, pi) => photoTile(room, ph, pi))),
      h('input', {
        type: 'file',
        accept: 'image/*',
        multiple: true,
        id: fileId,
        class: 'visually-hidden',
        onChange: async (e) => {
          const files = [...(e.target.files ?? [])];
          if (!files.length) return;
          status.textContent = `Adding ${files.length === 1 ? 'photo' : `${files.length} photos`}…`;
          for (const file of files) {
            const id = await app.repo.putPhoto(await prepareImage(file));
            room.photos.push({ id, caption: '' });
            if (!listing.heroPhotoId) listing.heroPhotoId = id;
          }
          await structural(() => {});
        },
      }),
      h('label', { for: fileId, class: 'btn btn--secondary btn--small' }, icon('plus', { size: 18 }), h('span', { text: 'Add photos' })),
    );
  }

  function render() {
    list.replaceChildren(...listing.rooms.map(roomCard));
    empty.hidden = listing.rooms.length > 0;
  }

  const empty = h('p', { class: 'empty-state', text: 'No rooms yet. Add the rooms visitors will tour, in the order you’d walk them through the home.' });

  panel.append(
    h(
      'div',
      { class: 'admin-section' },
      h('div', { class: 'admin-section__head' }, h('h2', { class: 'admin-section__title', text: 'Rooms and photos' }), status),
      h('p', { class: 'admin-section__intro', text: 'Visitors browse rooms in this order. Changes save automatically.' }),
      empty,
      list,
      button('Add a room', {
        variant: 'secondary',
        iconName: 'plus',
        onClick: () =>
          structural(() => listing.rooms.push({ id: newId(), name: '', description: '', photos: [] })).then(() => {
            list.querySelector('.room-editor:last-child .room-editor__name')?.focus();
          }),
      }),
    ),
  );
  render();
  return () => persistSoon.flush();
}
