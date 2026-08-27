/**
 * Flexible numeric parsing for form fields (dose, etc.).
 * Supports comma and dot as decimal separators.
 * Incomplete intermediate states return null without throwing so inputs stay editable.
 */

/**
 * Parses a user-typed number string that may use "," or "." as decimal separator.
 *
 * Returns null (without throwing) for incomplete editable states such as:
 * "", ",", ".", "1,", "-.", etc.
 *
 * Returns a finite number when the string is a complete numeric value.
 * Throws only when the string looks complete but is not a valid number
 * (e.g. "1.2.3", "abc").
 */
export function parseFlexibleNumber(input: string): number | null {
  if (typeof input !== 'string') {
    throw new Error('parseFlexibleNumber expects a string');
  }

  const trimmed = input.trim();

  // Empty / lone separators / trailing separator — keep editing, do not throw.
  if (
    trimmed === '' ||
    trimmed === ',' ||
    trimmed === '.' ||
    trimmed === '-' ||
    trimmed === '-,' ||
    trimmed === '-.' ||
    /^-?\d+[.,]$/.test(trimmed)
  ) {
    return null;
  }

  // Normalize comma decimal to dot for Number().
  const normalized = trimmed.replace(',', '.');

  // Reject multiple separators or non-numeric junk that looks "complete".
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    // Incomplete patterns like "1.2." or lone partials already handled above.
    if (/^-?\d+[.,]\d*[.,]?$/.test(trimmed) || /^-?[.,]\d*$/.test(trimmed)) {
      return null;
    }
    throw new Error(`Invalid number: ${input}`);
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number: ${input}`);
  }

  return value;
}

/**
 * Finalizes a number on commit (blur / submit).
 * - Empty string → null (cleared field)
 * - Incomplete non-empty input (e.g. "1,") → throws
 * - Complete value → finite number
 */
export function finalizeNumber(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }

  const parsed = parseFlexibleNumber(trimmed);
  if (parsed === null) {
    throw new Error(`Cannot finalize incomplete number: ${input}`);
  }
  return parsed;
}
