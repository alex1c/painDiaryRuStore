/**
 * Normalization helpers for custom factor names (duplicate protection).
 */

/**
 * Trims, collapses internal whitespace, and lowercases for duplicate detection.
 * Display name stays as the user typed (after trim only).
 */
export function normalizeFactorName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Same user-facing normalization rules for medication duplicate detection. */
export function normalizeMedicationName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
