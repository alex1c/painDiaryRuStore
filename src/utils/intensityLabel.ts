/**
 * Short semantic labels for the 0–10 intensity scale (Russian UI).
 */

/**
 * Returns a brief intensity band label for accessibility / helper text.
 */
export function intensityBandLabel(intensity: number): string {
  if (intensity <= 0) return 'нет боли';
  if (intensity <= 3) return 'слабая';
  if (intensity <= 6) return 'средняя';
  if (intensity <= 9) return 'сильная';
  return 'максимальная';
}

/**
 * Formats intensity as "7/10".
 */
export function formatIntensityScore(intensity: number): string {
  return `${intensity}/10`;
}
