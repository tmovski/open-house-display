import { h } from '../dom.js';
import { button, field, photo, toast } from '../components.js';
import { normalizePhone, formatPhone } from '../../core/lead.js';
import { prepareImage } from '../../platform/images.js';

const toNumber = (v) => {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export function listingTab(panel, app) {
  const l = app.listing;
  let heroPhotoId = l.heroPhotoId;
  const hero = h('div', { class: 'cover-picker__preview' });

  const renderHero = () => {
    hero.replaceChildren(heroPhotoId ? photo(app, heroPhotoId, { alt: 'Cover photo', className: 'cover-picker__img' }) : h('p', { class: 'cover-picker__empty', text: 'No cover photo yet' }));
  };

  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    class: 'visually-hidden',
    id: 'cover-file',
    onChange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      heroPhotoId = await app.repo.putPhoto(await prepareImage(file));
      renderHero();
      e.target.value = '';
    },
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const numbers = { price: toNumber(d.get('price')), beds: toNumber(d.get('beds')), baths: toNumber(d.get('baths')), sqft: toNumber(d.get('sqft')) };
    const bad = Object.entries(numbers).find(([, v]) => Number.isNaN(v));
    if (bad) {
      toast('Price, beds, baths, and square feet must be numbers.', { tone: 'error' });
      e.currentTarget.querySelector(`[name="${bad[0]}"]`)?.focus();
      return;
    }
    const next = {
      ...app.listing,
      address: { street: d.get('street').trim(), city: d.get('city').trim(), state: d.get('state').trim().toUpperCase(), zip: d.get('zip').trim() },
      ...numbers,
      description: d.get('description').trim(),
      heroPhotoId,
      agent: { name: d.get('agentName').trim(), brokerage: d.get('brokerage').trim(), phone: normalizePhone(d.get('agentPhone')) || d.get('agentPhone').trim(), email: d.get('agentEmail').trim() },
      isSample: false,
    };
    await app.saveListing(next);
    await app.repo.pruneOrphanPhotos(next);
    document.querySelector('.admin__subtitle').textContent = next.address.street || 'New listing';
    toast('Listing saved', { tone: 'success' });
  };

  panel.append(
    h(
      'form',
      { class: 'admin-form', novalidate: true, onSubmit },
      l.isSample && h('p', { class: 'notice', text: 'This is the sample listing. Replace the details and photos with the home you’re showing, or start a new listing from Settings.' }),
      h(
        'div',
        { class: 'admin-section' },
        h('h2', { class: 'admin-section__title', text: 'The home' }),
        h(
          'div',
          { class: 'form-grid form-grid--address' },
          field({ label: 'Street address', name: 'street', value: l.address.street, autocomplete: 'off' }),
          field({ label: 'City', name: 'city', value: l.address.city }),
          field({ label: 'State', name: 'state', value: l.address.state, maxlength: '2' }),
          field({ label: 'ZIP code', name: 'zip', value: l.address.zip, inputmode: 'numeric', maxlength: '10' }),
        ),
        h(
          'div',
          { class: 'form-grid form-grid--four' },
          field({ label: 'Asking price', name: 'price', value: l.price || '', inputmode: 'numeric', hint: 'Dollars' }),
          field({ label: 'Bedrooms', name: 'beds', value: l.beds || '', inputmode: 'numeric' }),
          field({ label: 'Bathrooms', name: 'baths', value: l.baths || '', inputmode: 'decimal', hint: 'Use .5 for a half bath' }),
          field({ label: 'Square feet', name: 'sqft', value: l.sqft || '', inputmode: 'numeric' }),
        ),
        field({ label: 'Description', name: 'description', value: l.description, multiline: true }),
        h(
          'div',
          { class: 'cover-picker' },
          h('p', { class: 'field__label', text: 'Cover photo' }),
          h('p', { class: 'field__hint', text: 'Shown full screen on the welcome screen. A street view of the front works best.' }),
          hero,
          fileInput,
          h('label', { for: 'cover-file', class: 'btn btn--secondary', text: heroPhotoId ? 'Replace cover photo' : 'Choose cover photo' }),
        ),
      ),
      h(
        'div',
        { class: 'admin-section' },
        h('h2', { class: 'admin-section__title', text: 'You, the listing agent' }),
        h(
          'div',
          { class: 'form-grid' },
          field({ label: 'Name', name: 'agentName', value: l.agent?.name, autocomplete: 'name' }),
          field({ label: 'Brokerage', name: 'brokerage', value: l.agent?.brokerage }),
          field({ label: 'Phone', name: 'agentPhone', type: 'tel', value: formatPhone(l.agent?.phone), autocomplete: 'tel' }),
          field({ label: 'Email', name: 'agentEmail', type: 'email', value: l.agent?.email, autocomplete: 'email' }),
        ),
      ),
      h('div', { class: 'admin-form__actions' }, button('Save listing', { variant: 'primary', type: 'submit' })),
    ),
  );
  renderHero();
}
