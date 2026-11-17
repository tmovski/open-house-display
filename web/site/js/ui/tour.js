import { h, icon } from './dom.js';
import { agentDoor, button, photo } from './components.js';
import { splitStreet } from '../core/format.js';

export function tourScreen(root, app, { roomIndex = 0 } = {}) {
  const rooms = app.listing.rooms;
  let r = Math.min(roomIndex, Math.max(0, rooms.length - 1));
  let p = 0;

  const stage = h('div', { class: 'tour__stage' });
  const caption = h('p', { class: 'tour__caption', 'aria-live': 'polite' });
  const counter = h('p', { class: 'tour__counter' });
  const title = h('h1', { class: 'tour__room', tabindex: '-1' });
  const description = h('p', { class: 'tour__description' });
  const prevBtn = h('button', { type: 'button', class: 'stage-nav stage-nav--prev', 'aria-label': 'Previous photo', onClick: () => step(-1) }, icon('chevronLeft', { size: 36 }));
  const nextBtn = h('button', { type: 'button', class: 'stage-nav stage-nav--next', 'aria-label': 'Next photo', onClick: () => step(1) }, icon('chevronRight', { size: 36 }));

  const roomList = h(
    'ol',
    { class: 'room-list' },
    rooms.map((room, i) =>
      h(
        'li',
        {},
        h(
          'button',
          { type: 'button', class: 'room-list__item', dataset: { index: String(i) }, onClick: () => show(i, 0) },
          h('span', { class: 'room-list__name', text: room.name || 'Untitled room' }),
          h('span', { class: 'room-list__count', text: room.photos.length === 1 ? '1 photo' : `${room.photos.length} photos` }),
        ),
      ),
    ),
  );

  function show(roomI, photoI) {
    r = roomI;
    p = photoI;
    const room = rooms[r];
    title.textContent = room.name || 'Untitled room';
    description.textContent = room.description || '';
    const current = room.photos[p];
    const img = current ? photo(app, current.id, { alt: current.caption || room.name, className: 'tour__photo' }) : null;
    stage.replaceChildren(
      img ?? h('div', { class: 'tour__no-photo' }, icon('image', { size: 48 }), h('p', { text: 'No photos of this room yet' })),
    );
    caption.textContent = current?.caption ?? '';
    counter.textContent = room.photos.length > 1 ? `Photo ${p + 1} of ${room.photos.length}` : '';
    roomList.querySelectorAll('.room-list__item').forEach((btn, i) => {
      btn.classList.toggle('is-current', i === r);
      if (i === r) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
    const atStart = r === 0 && p === 0;
    const atEnd = r === rooms.length - 1 && p >= room.photos.length - 1;
    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
  }

  /** Steps through photos, rolling over into the next or previous room. */
  function step(dir) {
    const room = rooms[r];
    const np = p + dir;
    if (np >= 0 && np < room.photos.length) return show(r, np);
    const nr = r + dir;
    if (nr < 0 || nr >= rooms.length) return;
    show(nr, dir > 0 ? 0 : Math.max(0, rooms[nr].photos.length - 1));
  }

  // Swipe left/right on the photo.
  let startX = null;
  stage.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
  });
  stage.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  });
  const onKey = (e) => {
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  };
  document.addEventListener('keydown', onKey);

  const { number, street } = splitStreet(app.listing.address.street);

  const screen = h(
    'main',
    { class: 'screen tour' },
    h(
      'nav',
      { class: 'tour__rail', 'aria-label': 'Rooms' },
      h('div', { class: 'tour__rail-top' }, agentDoor(app, { tone: 'dark' })),
      h('p', { class: 'tour__home' }, number && h('span', { class: 'tour__home-number', text: number }), h('span', { text: street })),
      roomList,
      h(
        'div',
        { class: 'tour__rail-actions' },
        button('Sign in', { variant: 'primary', onClick: () => app.go('signin') }),
        button('Back to start', { variant: 'on-dark', onClick: () => app.go('welcome') }),
      ),
    ),
    h(
      'section',
      { class: 'tour__main' },
      h('div', { class: 'tour__viewer' }, stage, prevBtn, nextBtn),
      h('div', { class: 'tour__info' }, h('div', { class: 'tour__heading' }, title, counter), caption, description),
    ),
  );
  root.append(screen);
  if (rooms.length) show(r, 0);
  return { idle: 'visitor', cleanup: () => document.removeEventListener('keydown', onKey) };
}
