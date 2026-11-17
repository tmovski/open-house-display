import { describe, expect, it } from 'vitest';
import { createLead, formatPhone, listingAddressLine, normalizePhone, validateIncomingLead, validateSignIn } from '../site/js/core/lead.js';

describe('normalizePhone', () => {
  it.each([
    ['(248) 555-0199', '2485550199'],
    ['248.555.0199', '2485550199'],
    ['+1 248 555 0199', '2485550199'],
    ['555-0199', ''],
    ['2485550199999', ''],
    ['', ''],
    [null, ''],
  ])('%s -> %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it('formats 10 digits for display', () => {
    expect(formatPhone('2485550199')).toBe('(248) 555-0199');
    expect(formatPhone('123')).toBe('123');
  });
});

describe('validateSignIn', () => {
  const base = { firstName: '  Maya ', lastName: 'Okafor', email: 'Maya@Example.com ', phone: '', hasAgent: 'no', timeline: '0-3', consentToContact: true };

  it('accepts a complete sign-in and cleans it up', () => {
    const r = validateSignIn(base);
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ firstName: 'Maya', email: 'maya@example.com', hasAgent: 'no', timeline: '0-3', consentToContact: true });
  });

  it('requires both names', () => {
    const r = validateSignIn({ ...base, firstName: ' ', lastName: '' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(['firstName', 'lastName']));
  });

  it('requires an email or a phone, but not both', () => {
    expect(validateSignIn({ ...base, email: '' }).errors.contact).toMatch(/email or phone/);
    expect(validateSignIn({ ...base, email: '', phone: '248-555-0199' }).ok).toBe(true);
  });

  it('flags a malformed email or phone', () => {
    expect(validateSignIn({ ...base, email: 'maya@' }).errors.email).toBeTruthy();
    expect(validateSignIn({ ...base, phone: '555' }).errors.phone).toBeTruthy();
  });

  it('only keeps the agent name when the visitor has an agent', () => {
    expect(validateSignIn({ ...base, hasAgent: 'no', agentName: 'Jordan' }).value.agentName).toBe('');
    expect(validateSignIn({ ...base, hasAgent: 'yes', agentName: 'Jordan' }).value.agentName).toBe('Jordan');
  });

  it('ignores values that are not on the list', () => {
    const r = validateSignIn({ ...base, hasAgent: 'maybe', timeline: 'someday', consentToContact: 'yes' });
    expect(r.value).toMatchObject({ hasAgent: '', timeline: '', consentToContact: false });
  });

  it('caps very long input', () => {
    expect(validateSignIn({ ...base, firstName: 'a'.repeat(500) }).value.firstName).toHaveLength(80);
  });
});

describe('createLead / validateIncomingLead', () => {
  const listing = { id: 'L1', address: { street: '2418 Linden Court', city: 'Northville', state: 'MI', zip: '48167' } };

  it('builds an unsynced lead tied to the listing', () => {
    const lead = createLead(validateSignIn({ firstName: 'A', lastName: 'B', email: 'a@b.co' }).value, { id: 'abcd-1234-efgh', now: Date.UTC(2026, 8, 20), listing });
    expect(lead).toMatchObject({ id: 'abcd-1234-efgh', listingId: 'L1', listingAddress: '2418 Linden Court, Northville, MI 48167', synced: 0, syncedAt: null });
    expect(lead.createdAt).toBe('2026-09-20T00:00:00.000Z');
  });

  it('lets the server reject bad ids and dates', () => {
    const r = validateIncomingLead({ id: '<x>', createdAt: 'yesterday', firstName: 'A', lastName: 'B', email: 'a@b.co' });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveProperty('id');
    expect(r.errors).toHaveProperty('createdAt');
    expect(validateIncomingLead(null).ok).toBe(false);
  });

  it('formats address lines with missing parts', () => {
    expect(listingAddressLine({ address: { street: '1 Main St', city: '', state: 'MI', zip: '' } })).toBe('1 Main St, MI');
  });
});
