/**
 * Local display formatting for ISO timestamps.
 * Uses the device local timezone — not UTC date slices.
 */

/**
 * Formats an ISO timestamp as local HH:mm (24h, zero-padded).
 */
export function formatLocalTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Formats an ISO timestamp as a readable local date for headers.
 * Example (ru): "чт, 27 августа"
 */
export function formatLocalDateHeading(
  date: Date = new Date(),
  locale = 'ru-RU'
): string {
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Formats a time range for completed episode cards: "14:20–16:05".
 */
export function formatLocalTimeRange(
  startedAtIso: string,
  endedAtIso: string | null
): string {
  const start = formatLocalTime(startedAtIso);
  if (endedAtIso == null) {
    return `${start}–…`;
  }
  return `${start}–${formatLocalTime(endedAtIso)}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
