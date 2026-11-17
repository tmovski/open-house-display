import { describe, expect, it } from 'vitest';
import { csvFileName, escapeCell, leadsToCsv, toCsv } from '../site/js/core/csv.js';
import { makeLead } from './helpers.js';

describe('escapeCell', () => {
  it('quotes commas, quotes, and line breaks', () => {
    expect(escapeCell('Smith, Jr.')).toBe('"Smith, Jr."');
    expect(escapeCell('The "Big" House')).toBe('"The ""Big"" House"');
    expect(escapeCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralizes spreadsheet formulas', () => {
    expect(escapeCell('=1+1')).toBe("'=1+1");
    expect(escapeCell('+15551234')).toBe("'+15551234");
    expect(escapeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCell('-2')).toBe("'-2");
  });

  it('handles empty values', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
    expect(escapeCell(0)).toBe('0');
  });
});

describe('leadsToCsv', () => {
  it('writes a header and one friendly row per lead', () => {
    const csv = leadsToCsv([makeLead({ hasAgent: 'yes', agentName: 'Jordan Lee', timeline: '3-6' })]);
    const [header, row, end] = csv.split('\r\n');
    expect(header).toBe('Signed in,First name,Last name,Email,Phone,Working with an agent,Their agent,Buying timeline,OK to contact,Property');
    expect(row).toContain('(248) 555-0199');
    expect(row).toContain('Yes,Jordan Lee,3 to 6 months,Yes');
    expect(row).toContain('"2418 Linden Court, Northville, MI 48167"');
    expect(end).toBe('');
  });

  it('supports custom columns', () => {
    expect(toCsv([{ a: 1 }], [{ header: 'A', key: 'a' }])).toBe('A\r\n1\r\n');
  });

  it('names files by date', () => {
    expect(csvFileName(new Date(2026, 8, 5))).toBe('open-house-sign-ins-2026-09-05.csv');
  });
});
