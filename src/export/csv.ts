/**
 * CSV field escaping, delimiter, and spreadsheet formula-injection protection.
 * Uses semicolon delimiter + UTF-8 BOM for Russian Excel on Windows.
 */

/** Semicolon delimiter — opens more reliably in Russian locale Excel. */
export const CSV_DELIMITER = ';';

/** UTF-8 byte order mark prepended to every exported file. */
export const CSV_BOM = '\uFEFF';

const FORMULA_PREFIX_RE = /^[=+\-@]/;

/**
 * Prefixes user-controlled text that could execute as a spreadsheet formula.
 * Excel treats leading = + - @ as formula starters; apostrophe forces literal text.
 */
export function sanitizeSpreadsheetCell(value: string): string {
  if (value.length === 0) {
    return value;
  }
  if (FORMULA_PREFIX_RE.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Escapes one CSV field: sanitizes formula injection, doubles internal quotes,
 * and wraps the field in quotes when it contains delimiter, quotes, or newlines.
 */
export function escapeCsvField(raw: string | null | undefined): string {
  const base = sanitizeSpreadsheetCell(String(raw ?? ''));
  const needsQuotes =
    base.includes(',') ||
    base.includes(CSV_DELIMITER) ||
    base.includes('"') ||
    base.includes('\n') ||
    base.includes('\r');

  if (!needsQuotes) {
    return base;
  }

  return `"${base.replace(/"/g, '""')}"`;
}

/** Joins escaped fields into one CSV row. */
export function buildCsvRow(fields: (string | null | undefined)[]): string {
  return fields.map((field) => escapeCsvField(field)).join(CSV_DELIMITER);
}

/** Builds a full CSV document with BOM, header row, and data rows. */
export function buildCsvDocument(
  headers: string[],
  rows: (string | null | undefined)[][]
): string {
  const lines = [buildCsvRow(headers), ...rows.map((row) => buildCsvRow(row))];
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}
