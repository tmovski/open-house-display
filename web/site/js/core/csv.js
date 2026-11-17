import { formatPhone, timelineLabel } from './lead.js';

/**
 * Makes one spreadsheet cell safe:
 *  - quotes cells containing commas, quotes, or line breaks (RFC 4180)
 *  - neutralizes "formula injection": a visitor typing =HYPERLINK(...) as their
 *    name must not become a live formula when the agent opens the file in Excel.
 */
export function escapeCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(c.format ? c.format(row) : row[c.key])).join(','),
  );
  return [header, ...body].join('\r\n') + '\r\n';
}

const yesNo = (v) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '');

export const LEAD_COLUMNS = Object.freeze([
  { header: 'Signed in', format: (l) => l.createdAt },
  { header: 'First name', key: 'firstName' },
  { header: 'Last name', key: 'lastName' },
  { header: 'Email', key: 'email' },
  { header: 'Phone', format: (l) => formatPhone(l.phone) },
  { header: 'Working with an agent', format: (l) => yesNo(l.hasAgent) },
  { header: 'Their agent', key: 'agentName' },
  { header: 'Buying timeline', format: (l) => timelineLabel(l.timeline) },
  { header: 'OK to contact', format: (l) => (l.consentToContact ? 'Yes' : 'No') },
  { header: 'Property', key: 'listingAddress' },
]);

export function leadsToCsv(leads) {
  return toCsv(leads, LEAD_COLUMNS);
}

export function csvFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `open-house-sign-ins-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}
