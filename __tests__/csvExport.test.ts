/**
 * Phase 8 CSV escaping, delimiter, Russian UTF-8, and formula-injection tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import {
  CSV_BOM,
  CSV_DELIMITER,
  buildCsvDocument,
  buildCsvRow,
  escapeCsvField,
  sanitizeSpreadsheetCell,
} from '@/src/export/csv';
import { DataExportService } from '@/src/export/DataExportService';
import { HeadacheRepository } from '@/src/repositories/HeadacheRepository';
import { MedicationRepository } from '@/src/repositories/MedicationRepository';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('csv escaping', () => {
  test('A headers are present in document', () => {
    const doc = buildCsvDocument(['a', 'b'], [['1', '2']]);
    expect(doc.startsWith(CSV_BOM)).toBe(true);
    expect(doc).toContain('a;b');
  });

  test('B Russian UTF-8 content preserved', () => {
    const field = escapeCsvField('Боль, сильная');
    expect(field).toContain('Боль');
    const doc = buildCsvDocument(['note'], [['Боль, сильная']]);
    expect(doc).toContain('Боль, сильная');
  });

  test('C semicolon delimiter used', () => {
    const row = buildCsvRow(['one', 'two']);
    expect(row).toBe('one;two');
    expect(CSV_DELIMITER).toBe(';');
  });

  test('D quotes internal double quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  test('E commas inside field are quoted', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  test('F semicolons inside field are quoted', () => {
    expect(escapeCsvField('a;b')).toBe('"a;b"');
  });

  test('G newline inside field stays one CSV field', () => {
    const value = 'Боль, сильная\nпосле дороги';
    const escaped = escapeCsvField(value);
    expect(escaped.startsWith('"')).toBe(true);
    expect(escaped.endsWith('"')).toBe(true);
    expect(escaped).toContain('\n');
  });

  test('H CRLF inside field is quoted', () => {
    const escaped = escapeCsvField('line1\r\nline2');
    expect(escaped.startsWith('"')).toBe(true);
    expect(escaped).toContain('\r\n');
  });
});

describe('csv formula injection', () => {
  test('=SUM(...) is prefixed', () => {
    expect(sanitizeSpreadsheetCell('=SUM(1+1)')).toBe("'=SUM(1+1)");
  });

  test('+cmd is prefixed', () => {
    expect(sanitizeSpreadsheetCell('+cmd')).toBe("'+cmd");
  });

  test('-1+2 is prefixed', () => {
    expect(sanitizeSpreadsheetCell('-1+2')).toBe("'-1+2");
  });

  test('@something is prefixed', () => {
    expect(sanitizeSpreadsheetCell('@something')).toBe("'@something");
  });
});

describe('csv export service', () => {
  test('I medication historical snapshot in CSV', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-01T10:00:00.000Z',
      endedAt: '2024-06-01T12:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Старое имя' });
    meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      takenAt: '2024-06-01T10:30:00.000Z',
    });
    meds.updateMedication(medication.id, { name: 'Новое имя' });

    const csv = new DataExportService(db).buildCsvBundle().medicationIntakes.content;
    expect(csv).toContain('Старое имя');
    expect(csv).not.toContain('Новое имя');
  });

  test('J empty dataset still has headers', async () => {
    const db = await openTestDb();
    const bundle = new DataExportService(db).buildCsvBundle();

    expect(bundle.episodes.content).toContain('episode_id');
    expect(bundle.medicationIntakes.content).toContain('intake_id');
    expect(bundle.dailyCheckIns.content).toContain('date');
  });
});
