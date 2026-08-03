import { describe, expect, it } from 'vitest';
import { formatInspectionDate, today } from './formatDate';

describe('formatInspectionDate', () => {
  it('renders the calendar day that was stored, with no timezone drift', () => {
    // The bug this pins: `new Date('2026-01-01')` parses as UTC midnight, so in any
    // negative-offset timezone it renders as 31 Dec 2025. inspectionDate is a calendar day
    // (DESIGN.md §2.3), so it's formatted as text and never becomes a Date.
    const formatted = formatInspectionDate('2026-01-01');

    expect(formatted).toBe('1 Jan 2026');
    expect(formatted).not.toContain('Dec');
    expect(formatted).not.toContain('2025');
  });

  it('handles both ends of the year', () => {
    expect(formatInspectionDate('2026-12-31')).toBe('31 Dec 2026');
    expect(formatInspectionDate('2026-06-15')).toBe('15 Jun 2026');
  });

  it('drops the leading zero on the day', () => {
    expect(formatInspectionDate('2026-03-05')).toBe('5 Mar 2026');
  });

  it('falls back to the raw value rather than rendering undefined', () => {
    expect(formatInspectionDate('not-a-date')).toBe('not-a-date');
    expect(formatInspectionDate('2026-13-01')).toBe('2026-13-01');
  });
});

describe('today', () => {
  it("returns the device's local calendar day, not the UTC one", () => {
    const now = new Date();
    const expected = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    // Computed independently of the implementation: a supervisor in IST logging at 01:00
    // must get today's date, not yesterday's.
    expect(today()).toBe(expected);
  });
});
