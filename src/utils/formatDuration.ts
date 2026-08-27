/**
 * Human-readable duration formatting for active / completed episodes.
 * Durations are derived — never persisted.
 */

/**
 * Formats a duration in milliseconds as compact Russian text.
 * Examples: "35 мин", "1 ч 20 мин", "5 ч", "менее 1 мин"
 */
export function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return '0 мин';
  }

  const totalMinutes = Math.floor(durationMs / 60_000);

  if (totalMinutes < 1) {
    return 'менее 1 мин';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} мин`;
  }

  if (minutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${minutes} мин`;
}

/**
 * Formats duration between two ISO timestamps (or start → now when end is null).
 */
export function formatDurationBetween(
  startedAtIso: string,
  endedAtIso: string | null,
  nowMs: number = Date.now()
): string {
  const startMs = Date.parse(startedAtIso);
  const endMs = endedAtIso == null ? nowMs : Date.parse(endedAtIso);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return '—';
  }
  return formatDurationMs(Math.max(0, endMs - startMs));
}
