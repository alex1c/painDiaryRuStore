/**
 * Phase 5 daily check-in repository, migration, and summary tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { migration001Initial } from '@/src/db/migrations/001_initial';
import { migration002IntensityRecordedIndex } from '@/src/db/migrations/002_intensity_recorded_index';
import { migration003CustomFactors } from '@/src/db/migrations/003_custom_factors';
import { migration004MedicationIntakeSnapshots } from '@/src/db/migrations/004_medication_intake_snapshots';
import { migration005MedicationIntakeEpisodeCascade } from '@/src/db/migrations/005_medication_intake_episode_cascade';
import { migration006DailyCheckInPhase5 } from '@/src/db/migrations/006_daily_checkin_phase5';
import { runMigrations } from '@/src/db/migrate';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { DailyCheckInRepository } from '@/src/repositories/DailyCheckInRepository';
import {
  buildDailyCheckInSummaryLine,
  dailyCheckInHasContent,
} from '@/src/utils/checkInSummary';
import { toLocalDateString } from '@/src/utils/localDate';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

async function openPhase4DbAsync(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const db = createSqlJsAdapter(raw);
  db.exec('PRAGMA foreign_keys = ON;');

  const steps = [
    migration001Initial,
    migration002IntensityRecordedIndex,
    migration003CustomFactors,
    migration004MedicationIntakeSnapshots,
    migration005MedicationIntakeEpisodeCascade,
  ];
  for (const migration of steps) {
    db.withTransaction(() => {
      migration.up(db);
      db.setUserVersion(migration.version);
    });
  }
  return db;
}

describe('daily check-in phase 5', () => {
  test('schema version is 6 after full migration', async () => {
    const db = await openTestDb();
    expect(db.getUserVersion()).toBe(6);
    expect(CURRENT_SCHEMA_VERSION).toBe(6);
  });

  test('A create check-in for local date', async () => {
    const db = await openTestDb();
    const repo = new DailyCheckInRepository(db);

    const saved = repo.upsertDailyCheckIn({
      localDate: '2025-03-10',
      sleepQuality: 'bad',
      stressLevel: 'high',
    });

    expect(saved).not.toBeNull();
    expect(saved!.localDate).toBe('2025-03-10');
    expect(saved!.sleepQuality).toBe('bad');
    expect(saved!.stressLevel).toBe('high');
    expect(repo.getDailyCheckIn('2025-03-10')?.id).toBe(saved!.id);
  });

  test('B update same date without duplicate row', async () => {
    const db = await openTestDb();
    const repo = new DailyCheckInRepository(db);

    const first = repo.upsertDailyCheckIn({
      localDate: '2025-03-11',
      hydrationLevel: 'low',
    });
    const second = repo.upsertDailyCheckIn({
      localDate: '2025-03-11',
      stressLevel: 'medium',
    });

    expect(second!.id).toBe(first!.id);
    const rows = db.getAll<{ id: string }>(
      'SELECT id FROM daily_check_ins WHERE local_date = ?',
      ['2025-03-11']
    );
    expect(rows).toHaveLength(1);
    expect(second!.hydrationLevel).toBe('low');
    expect(second!.stressLevel).toBe('medium');
  });

  test('C clear one field back to null', async () => {
    const db = await openTestDb();
    const repo = new DailyCheckInRepository(db);

    repo.upsertDailyCheckIn({
      localDate: '2025-03-12',
      sleepQuality: 'good',
      stressLevel: 'high',
    });

    const updated = repo.upsertDailyCheckIn({
      localDate: '2025-03-12',
      stressLevel: null,
    });

    expect(updated!.sleepQuality).toBe('good');
    expect(updated!.stressLevel).toBeNull();
  });

  test('D delete row when fully empty', async () => {
    const db = await openTestDb();
    const repo = new DailyCheckInRepository(db);

    repo.upsertDailyCheckIn({
      localDate: '2025-03-13',
      caffeineLevel: 'normal',
    });

    const cleared = repo.upsertDailyCheckIn({
      localDate: '2025-03-13',
      caffeineLevel: null,
    });

    expect(cleared).toBeNull();
    expect(repo.getDailyCheckIn('2025-03-13')).toBeNull();
  });

  test('E uniqueness by local_date', async () => {
    const db = await openTestDb();
    const indexes = db.getAll<{ name: string; sql: string }>(
      `SELECT name, sql FROM sqlite_master
       WHERE type = 'index' AND tbl_name = 'daily_check_ins'`
    );
    const uniqueOnDate = indexes.some((idx) =>
      idx.sql?.includes('local_date')
    );
    expect(uniqueOnDate).toBe(true);

    expect(() =>
      db.run(
        `INSERT INTO daily_check_ins
          (id, local_date, notes, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?)`,
        ['a', '2025-03-14', 't1', 't1']
      )
    ).not.toThrow();

    expect(() =>
      db.run(
        `INSERT INTO daily_check_ins
          (id, local_date, notes, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?)`,
        ['b', '2025-03-14', 't2', 't2']
      )
    ).toThrow();
  });

  test('F local date uses device calendar day via toLocalDateString', () => {
    const date = new Date(2025, 0, 15, 23, 30, 0);
    expect(toLocalDateString(date)).toBe('2025-01-15');
  });

  test('G historical list ordering newest first', async () => {
    const db = await openTestDb();
    const repo = new DailyCheckInRepository(db);

    repo.upsertDailyCheckIn({ localDate: '2025-03-01', stressLevel: 'low' });
    repo.upsertDailyCheckIn({ localDate: '2025-03-03', stressLevel: 'high' });
    repo.upsertDailyCheckIn({ localDate: '2025-03-02', stressLevel: 'medium' });

    const list = repo.listDailyCheckIns('2025-03-01', '2025-03-03');
    expect(list.map((row) => row.localDate)).toEqual([
      '2025-03-03',
      '2025-03-02',
      '2025-03-01',
    ]);
  });

  test('H note persistence and note-only check-in', async () => {
    const db = await openTestDb();
    const repo = new DailyCheckInRepository(db);

    const saved = repo.upsertDailyCheckIn({
      localDate: '2025-03-15',
      notes: 'перелёт',
    });

    expect(saved!.notes).toBe('перелёт');
    expect(dailyCheckInHasContent(saved!)).toBe(true);
    expect(repo.getDailyCheckIn('2025-03-15')?.notes).toBe('перелёт');
  });

  test('I migration from Phase 4 schema preserves rows', async () => {
    const db = await openPhase4DbAsync();

    db.run(
      `INSERT INTO daily_check_ins
        (id, local_date, headache_today, sleep_quality, stress_level, notes, created_at, updated_at)
       VALUES (?, ?, 1, 2, 3, ?, ?, ?)`,
      ['legacy-id', '2024-12-01', 'старая заметка', 'c1', 'u1']
    );
    expect(db.getUserVersion()).toBe(5);

    runMigrations(db);
    expect(db.getUserVersion()).toBe(6);

    const row = db.getFirst<{
      local_date: string;
      notes: string | null;
      sleep_quality: string | null;
      headache_today?: number;
    }>('SELECT * FROM daily_check_ins WHERE local_date = ?', ['2024-12-01']);

    expect(row).not.toBeNull();
    expect(row!.notes).toBe('старая заметка');
    expect(row!.sleep_quality).toBeNull();

    const columns = db.getAll<{ name: string }>(
      `PRAGMA table_info(daily_check_ins)`
    );
    expect(columns.map((c) => c.name)).not.toContain('headache_today');
    expect(columns.map((c) => c.name)).toContain('hydration_level');
  });

  test('summary line includes only answered structured fields', async () => {
    const db = await openTestDb();
    const repo = new DailyCheckInRepository(db);

    const saved = repo.upsertDailyCheckIn({
      localDate: '2025-03-16',
      sleepQuality: 'bad',
      stressLevel: 'high',
      hydrationLevel: 'low',
    });

    expect(buildDailyCheckInSummaryLine(saved!)).toBe(
      'Сон: плохо · Стресс: высокий · Воды: мало'
    );
  });

  test('migration 006 is registered', () => {
    expect(migration006DailyCheckInPhase5.version).toBe(6);
  });
});
