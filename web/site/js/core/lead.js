/**
 * Visitor sign-in rules. This file has no browser or Node dependencies so the
 * kiosk and the sync server validate leads with exactly the same code.
 */

export const TIMELINES = Object.freeze([
  { value: 'just-looking', label: 'Just looking' },
  { value: '0-3', label: 'Within 3 months' },
  { value: '3-6', label: '3 to 6 months' },
  { value: '6+', label: '6 months or more' },
]);

const TIMELINE_VALUES = new Set(TIMELINES.map((t) => t.value));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const LIMITS = { name: 80, email: 254, agentName: 120, address: 200, listingId: 64 };

const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Returns a 10-digit US phone number, or '' if the input can't be one. */
export function normalizePhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.length === 10 ? digits : '';
}

export function formatPhone(digits) {
  const d = String(digits ?? '');
  if (d.length !== 10) return d;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function timelineLabel(value) {
  return TIMELINES.find((t) => t.value === value)?.label ?? '';
}

/**
 * Validates what a visitor typed. Returns the cleaned-up value plus a
 * field -> message map written for the visitor, not for a developer.
 */
export function validateSignIn(input = {}) {
  const errors = {};
  const phoneRaw = text(input.phone, 40);
  const value = {
    firstName: text(input.firstName, LIMITS.name),
    lastName: text(input.lastName, LIMITS.name),
    email: text(input.email, LIMITS.email).toLowerCase(),
    phone: normalizePhone(phoneRaw),
    hasAgent: input.hasAgent === 'yes' || input.hasAgent === 'no' ? input.hasAgent : '',
    agentName: '',
    timeline: TIMELINE_VALUES.has(input.timeline) ? input.timeline : '',
    consentToContact: input.consentToContact === true,
  };
  if (value.hasAgent === 'yes') value.agentName = text(input.agentName, LIMITS.agentName);

  if (!value.firstName) errors.firstName = 'Enter your first name.';
  if (!value.lastName) errors.lastName = 'Enter your last name.';
  if (value.email && !EMAIL_RE.test(value.email)) errors.email = 'Check the email address. It should look like name@example.com.';
  if (phoneRaw && !value.phone) errors.phone = 'Enter a 10-digit phone number.';
  if (!value.email && !phoneRaw) errors.contact = 'Add an email or phone number so the agent can follow up.';

  return { ok: Object.keys(errors).length === 0, value, errors };
}

/** Builds the stored lead record from a validated sign-in. */
export function createLead(signIn, { id, now, listing }) {
  return {
    id,
    createdAt: new Date(now).toISOString(),
    ...signIn,
    listingId: listing?.id ?? '',
    listingAddress: listing ? listingAddressLine(listing) : '',
    synced: 0,
    syncedAt: null,
    syncError: null,
  };
}

/** Server-side check for a lead arriving from a device. */
export function validateIncomingLead(record) {
  if (!record || typeof record !== 'object') return { ok: false, errors: { record: 'Lead must be an object.' } };
  const result = validateSignIn(record);
  const errors = { ...result.errors };
  if (!ID_RE.test(String(record.id ?? ''))) errors.id = 'Lead id is missing or malformed.';
  const created = Date.parse(record.createdAt);
  if (Number.isNaN(created)) errors.createdAt = 'createdAt must be an ISO date.';
  const value = {
    ...result.value,
    id: String(record.id ?? ''),
    createdAt: Number.isNaN(created) ? '' : new Date(created).toISOString(),
    listingId: text(record.listingId, LIMITS.listingId),
    listingAddress: text(record.listingAddress, LIMITS.address),
  };
  return { ok: Object.keys(errors).length === 0, value, errors };
}

export function listingAddressLine(listing) {
  const a = listing?.address ?? {};
  const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [a.street, cityLine].filter(Boolean).join(', ');
}
