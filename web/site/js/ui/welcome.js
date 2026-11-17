import { h } from './dom.js';
import { agentDoor, button, photo } from './components.js';
import { formatBaths, formatNumber, formatPrice, splitStreet } from '../core/format.js';
import { formatPhone } from '../core/lead.js';

export function welcomeScreen(root, app) {
  const { listing } = app;
  const a = listing.address;
  const { number, street } = splitStreet(a.street);
  const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const hasContent = Boolean(a.street) || listing.rooms.length > 0;

  const facts = [
    formatPrice(listing.price) && { value: formatPrice(listing.price), label: 'Asking price' },
    listing.beds > 0 && { value: String(listing.beds), label: listing.beds === 1 ? 'Bedroom' : 'Bedrooms' },
    listing.baths > 0 && { value: formatBaths(listing.baths), label: listing.baths === 1 ? 'Bath' : 'Baths' },
    listing.sqft > 0 && { value: formatNumber(listing.sqft), label: 'Square feet' },
  ].filter(Boolean);

  const screen = h(
    'main',
    { class: 'screen welcome' },
    h('div', { class: 'welcome__photo' }, photo(app, listing.heroPhotoId, { alt: a.street ? `Outside ${a.street}` : '' })),
    h('div', { class: 'welcome__scrim', 'aria-hidden': 'true' }),
    h('header', { class: 'welcome__top' }, agentDoor(app, { tone: 'dark' })),
    hasContent
      ? h(
          'section',
          { class: 'welcome__body' },
          h(
            'h1',
            { class: 'welcome__address', tabindex: '-1' },
            number && h('span', { class: 'plaque' }, h('span', { class: 'plaque__number', text: number })),
            h('span', { class: 'welcome__street' }, h('span', { text: street }), cityLine && h('span', { class: 'welcome__city', text: cityLine })),
          ),
          facts.length > 0 &&
            h(
              'dl',
              { class: 'facts' },
              facts.map((f) => h('div', { class: 'facts__item' }, h('dt', { class: 'facts__label', text: f.label }), h('dd', { class: 'facts__value', text: f.value }))),
            ),
          h(
            'div',
            { class: 'welcome__actions' },
            button('Sign in', { variant: 'primary', size: 'lg', onClick: () => app.go('signin') }),
            listing.rooms.length > 0 && button('See the rooms', { variant: 'on-dark', size: 'lg', onClick: () => app.go('tour') }),
          ),
        )
      : h(
          'section',
          { class: 'welcome__body' },
          h('h1', { class: 'welcome__empty-title', tabindex: '-1', text: 'Welcome in' }),
          h('p', { class: 'welcome__empty-text', text: 'This listing is still being set up. Agent: press and hold “Open house” in the corner to add the home’s details and photos.' }),
          button('Sign in', { variant: 'primary', size: 'lg', onClick: () => app.go('signin') }),
        ),
    listing.agent?.name &&
      h(
        'aside',
        { class: 'host-card', 'aria-label': 'Listing agent' },
        h('p', { class: 'host-card__lead', text: 'Hosted by' }),
        h('p', { class: 'host-card__name', text: listing.agent.name }),
        listing.agent.brokerage && h('p', { class: 'host-card__detail', text: listing.agent.brokerage }),
        listing.agent.phone && h('p', { class: 'host-card__detail', text: formatPhone(listing.agent.phone) }),
      ),
    listing.isSample && h('p', { class: 'sample-note', text: 'Sample listing with illustrated photos' }),
  );
  root.append(screen);
  return { idle: null };
}
