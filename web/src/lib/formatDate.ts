/**
 * `inspectionDate` is a calendar day string, never an instant — so it's formatted by
 * splitting the parts, not by constructing a Date. Feeding 'YYYY-MM-DD' to `new Date()`
 * parses it as UTC midnight, which in a negative-offset timezone displays as the day before.
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatInspectionDate(isoDay: string) {
  const [year, month, day] = isoDay.split('-');
  const monthLabel = MONTHS[Number(month) - 1];

  return monthLabel ? `${Number(day)} ${monthLabel} ${year}` : isoDay;
}

/** The device's local calendar day, for defaulting the date picker. */
export function today() {
  const now = new Date();
  const localMidnight = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

  return localMidnight.toISOString().slice(0, 10);
}
