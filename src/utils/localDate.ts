/**
 * Local calendar-date utilities (YYYY-MM-DD).
 * IMPORTANT: Never derive a "day" by taking substring(0, 10) of a UTC ISO timestamp —
 * that can shift the calendar day relative to the user's local timezone.
 * Parsing here is locale-independent (no Date.parse of date-only strings).
 */

/** Matches strict YYYY-MM-DD with zero-padded month/day. */
export const LOCAL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats a Date's local calendar components as YYYY-MM-DD.
 * Uses getFullYear / getMonth / getDate (local), never UTC getters.
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Parses a YYYY-MM-DD string into a Date at local midnight.
 * Does not use locale-dependent Date.parse — components are split numerically.
 * Throws if the string is not a valid local date.
 */
export function parseLocalDate(localDate: string): Date {
  if (!isValidLocalDateString(localDate)) {
    throw new Error(`Invalid local date string: ${localDate}`);
  }

  const [yearStr, monthStr, dayStr] = localDate.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  // Construct at local midnight without UTC reinterpretation.
  const result = new Date(year, month - 1, day, 0, 0, 0, 0);

  // Guard against JS Date overflow (e.g. 2024-02-31 → March).
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${localDate}`);
  }

  return result;
}

/**
 * Returns true if value matches YYYY-MM-DD and represents a real calendar day.
 */
export function isValidLocalDateString(value: string): boolean {
  if (typeof value !== 'string' || !LOCAL_DATE_REGEX.test(value)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const probe = new Date(year, month - 1, day);
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

/**
 * Lexicographic compare of two YYYY-MM-DD strings (safe because of zero-padding).
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareLocalDates(a: string, b: string): number {
  if (!isValidLocalDateString(a) || !isValidLocalDateString(b)) {
    throw new Error(`compareLocalDates requires valid YYYY-MM-DD, got: ${a}, ${b}`);
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Adds (or subtracts) whole days to a local date string, returning YYYY-MM-DD.
 */
export function addDaysToLocalDate(localDate: string, days: number): string {
  const date = parseLocalDate(localDate);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function pad4(n: number): string {
  const s = String(n);
  if (s.length >= 4) return s;
  return s.padStart(4, '0');
}
