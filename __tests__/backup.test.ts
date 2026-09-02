/**
 * Phase 8 backup export, validation, restore, and rollback tests.
 */

import initSqlJs from 'sql.js';

import { BackupRepository } from '@/src/backup/BackupRepository';
import { BackupService } from '@/src/backup/BackupService';
import { BACKUP_FORMAT, SUPPORTED_BACKUP_VERSION } from '@/src/backup/constants';
import { BACKUP_TABLE_NAMES } from '@/src/backup/tableOrder';
import type { BackupFile } from '@/src/backup/types';
import {
  BackupValidationError,
  parseAndValidateBackup,
} from '@/src/backup/validateBackup';
import { AnalyticsRepository } from '@/src/analytics/AnalyticsRepository';
import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { DataMaintenanceService } from '@/src/data/DataMaintenanceService';
import { HeadacheRepository } from '@/src/repositories/HeadacheRepository';
import { MedicationRepository } from '@/src/repositories/MedicationRepository';
import { CustomFactorRepository } from '@/src/repositories/CustomFactorRepository';
import { DailyCheckInRepository } from '@/src/repositories/DailyCheckInRepository';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';
import { DEFAULT_APP_SETTINGS } from '@/src/domain/types';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

function seedPopulatedDb(db: SqlDatabase): void {
  const headaches = new HeadacheRepository(db);
  const meds = new MedicationRepository(db);
  const factors = new CustomFactorRepository(db);
  const checkIns = new DailyCheckInRepository(db);
  const settings = new SettingsRepository(db);

  const { episode } = headaches.startEpisode({
    intensity: 6,
    startedAt: '2024-06-01T10:00:00.000Z',
  });
  headaches.addIntensityEntry(episode.id, 8, '2024-06-01T11:00:00.000Z');
  headaches.finishEpisode(episode.id, '2024-06-01T14:00:00.000Z');

  const custom = factors.getOrCreate('Дорога');
  headaches.createEpisode({
    startedAt: '2024-06-02T09:00:00.000Z',
    endedAt: '2024-06-02T12:00:00.000Z',
  });
  const { episode: active } = headaches.startEpisode({
    intensity: 4,
    startedAt: '2024-06-03T08:00:00.000Z',
  });
  headaches.replaceEpisodeDetails(active.id, {
    side: 'left',
    factors: [{ code: 'custom', customFactorId: custom.id, customLabel: 'Дорога' }],
  });

  const medication = meds.createMedication({ name: 'Ибупрофен', defaultDose: '400 мг' });
  meds.recordEpisodeIntake({
    episodeId: active.id,
    medicationId: medication.id,
    dose: '400 мг',
    takenAt: '2024-06-03T08:30:00.000Z',
  });
  meds.updateMedication(medication.id, { name: 'Новое имя' });
  meds.archiveMedication(medication.id);

  checkIns.upsertDailyCheckIn({
    localDate: '2024-06-01',
    sleepQuality: 'good',
    stressLevel: 'low',
    notes: 'Нормальный день',
  });

  settings.saveSettings({
    ...DEFAULT_APP_SETTINGS,
    onboardingCompleted: true,
    remindersEnabled: true,
  });
}

describe('backup export', () => {
  test('A export empty database', async () => {
    const db = await openTestDb();
    const repo = new BackupRepository(db);
    const data = repo.exportAllTables();

    for (const table of BACKUP_TABLE_NAMES) {
      expect(Array.isArray(data[table])).toBe(true);
      expect(data[table]).toHaveLength(0);
    }
  });

  test('B export populated database', async () => {
    const db = await openTestDb();
    seedPopulatedDb(db);
    const service = new BackupService(db);
    const payload = service.createBackupPayload();

    expect(payload.format).toBe(BACKUP_FORMAT);
    expect(payload.version).toBe(SUPPORTED_BACKUP_VERSION);
    expect(payload.data.headache_episodes.length).toBeGreaterThan(0);
  });

  test('C all relevant tables included', async () => {
    const db = await openTestDb();
    seedPopulatedDb(db);
    const data = new BackupRepository(db).exportAllTables();

    for (const table of BACKUP_TABLE_NAMES) {
      expect(data[table]).toBeDefined();
    }
  });

  test('D historical medication snapshots preserved in export', async () => {
    const db = await openTestDb();
    seedPopulatedDb(db);
    const data = new BackupRepository(db).exportAllTables();
    const intake = data.medication_intakes[0] as Record<string, unknown>;

    expect(intake.medication_name_snapshot).toBe('Ибупрофен');
  });

  test('E custom factor history preserved', async () => {
    const db = await openTestDb();
    seedPopulatedDb(db);
    const data = new BackupRepository(db).exportAllTables();

    expect(data.custom_factors.length).toBe(1);
    expect(
      data.episode_factors.some((row) => row.custom_factor_id != null)
    ).toBe(true);
  });

  test('F active episode preserved', async () => {
    const db = await openTestDb();
    seedPopulatedDb(db);
    const data = new BackupRepository(db).exportAllTables();
    const activeRows = data.headache_episodes.filter((row) => row.ended_at == null);

    expect(activeRows).toHaveLength(1);
  });
});

describe('backup validation', () => {
  function buildValidBackup(db: SqlDatabase): string {
    const service = new BackupService(db);
    return service.serializeBackup(service.createBackupPayload());
  }

  test('G validate valid v1 backup', async () => {
    const db = await openTestDb();
    seedPopulatedDb(db);
    const validated = parseAndValidateBackup(buildValidBackup(db));
    expect(validated.preview.episodeCount).toBeGreaterThan(0);
  });

  test('H malformed JSON rejected', () => {
    expect(() => parseAndValidateBackup('{not json')).toThrow(BackupValidationError);
  });

  test('I wrong format rejected', async () => {
    const db = await openTestDb();
    const raw = JSON.parse(buildValidBackup(db)) as BackupFile;
    raw.format = 'other-backup' as typeof BACKUP_FORMAT;
    expect(() => parseAndValidateBackup(JSON.stringify(raw))).toThrow(
      /не резервная копия/
    );
  });

  test('J future version rejected', async () => {
    const db = await openTestDb();
    const raw = JSON.parse(buildValidBackup(db)) as BackupFile;
    raw.version = SUPPORTED_BACKUP_VERSION + 1;
    expect(() => parseAndValidateBackup(JSON.stringify(raw))).toThrow(
      /более новой версией/
    );
  });

  test('K invalid FK rejected', async () => {
    const db = await openTestDb();
    const raw = JSON.parse(buildValidBackup(db)) as BackupFile;
    raw.data.pain_intensity_entries.push({
      id: 'bad-intensity',
      episode_id: 'missing-episode',
      recorded_at: '2024-06-01T10:00:00.000Z',
      intensity: 5,
      created_at: '2024-06-01T10:00:00.000Z',
    });
    expect(() => parseAndValidateBackup(JSON.stringify(raw))).toThrow(
      BackupValidationError
    );
  });

  test('L duplicate id rejected', async () => {
    const db = await openTestDb();
    seedPopulatedDb(db);
    const raw = JSON.parse(buildValidBackup(db)) as BackupFile;
    const first = raw.data.headache_episodes[0] as Record<string, unknown>;
    raw.data.headache_episodes.push({ ...first, notes: 'duplicate' });
    expect(() => parseAndValidateBackup(JSON.stringify(raw))).toThrow(
      /Дублирующийся/
    );
  });

  test('rejects unknown or missing row columns before restore', async () => {
    const db = await openTestDb();
    seedPopulatedDb(db);
    const raw = JSON.parse(buildValidBackup(db)) as BackupFile;
    (raw.data.headache_episodes[0] as Record<string, unknown>).injected_column = 'x';

    expect(() => parseAndValidateBackup(JSON.stringify(raw))).toThrow(
      /Некорректные поля/
    );
  });

  test('preserves safe unknown medication effects for forward compatibility', async () => {
    const db = await openTestDb();
    seedPopulatedDb(db);
    const raw = JSON.parse(buildValidBackup(db)) as BackupFile;
    const intake = raw.data.medication_intakes[0] as Record<string, unknown>;
    intake.effect = 'future_safe_effect';
    intake.effect_rated_at = '2024-06-03T09:00:00.000Z';

    expect(parseAndValidateBackup(JSON.stringify(raw)).file.data.medication_intakes[0].effect)
      .toBe('future_safe_effect');
  });
});

describe('backup restore', () => {
  test('M restore populated backup', async () => {
    const source = await openTestDb();
    seedPopulatedDb(source);
    const service = new BackupService(source);
    const validated = service.validateBackupText(
      service.serializeBackup(service.createBackupPayload())
    );

    const target = await openTestDb();
    new BackupService(target).restoreValidatedBackup(validated);

    const headaches = new HeadacheRepository(target);
    expect(headaches.listEpisodes().length).toBeGreaterThan(0);
    expect(headaches.getActiveEpisode()).not.toBeNull();
    expect(new BackupRepository(target).exportAllTables()).toEqual(
      new BackupRepository(source).exportAllTables()
    );
  });

  test('N restore replaces existing data', async () => {
    const source = await openTestDb();
    seedPopulatedDb(source);
    const backup = new BackupService(source).createBackupPayload();

    const target = await openTestDb();
    new HeadacheRepository(target).startEpisode({
      intensity: 1,
      startedAt: '2025-01-01T10:00:00.000Z',
    });

    const validated = parseAndValidateBackup(JSON.stringify(backup));
    new BackupService(target).restoreValidatedBackup(validated);

    const episodes = new HeadacheRepository(target).listEpisodes();
    expect(episodes.some((ep) => ep.startedAt.startsWith('2024-06'))).toBe(true);
    expect(episodes.some((ep) => ep.startedAt.startsWith('2025-01'))).toBe(false);
  });

  test('O restore rollback on mid-restore failure', async () => {
    const source = await openTestDb();
    seedPopulatedDb(source);
    const validated = new BackupService(source).validateBackupText(
      new BackupService(source).serializeBackup(
        new BackupService(source).createBackupPayload()
      )
    );

    const target = await openTestDb();
    new HeadacheRepository(target).startEpisode({
      intensity: 2,
      startedAt: '2025-02-01T10:00:00.000Z',
    });
    const before = new BackupRepository(target).exportAllTables();

    let insertCount = 0;
    const originalRun = target.run.bind(target);
    target.run = (sql: string, params?: unknown[]) => {
      if (sql.startsWith('INSERT INTO')) {
        insertCount += 1;
        if (insertCount === 4) {
          throw new Error('Simulated restore failure');
        }
      }
      return originalRun(sql, params);
    };

    expect(() =>
      new BackupService(target).restoreValidatedBackup(validated)
    ).toThrow();

    expect(new BackupRepository(target).exportAllTables()).toEqual(before);
  });

  test('restored text IDs do not collide with newly created records', async () => {
    const source = await openTestDb();
    seedPopulatedDb(source);
    const validated = new BackupService(source).validateBackupText(
      new BackupService(source).serializeBackup(new BackupService(source).createBackupPayload())
    );
    const target = await openTestDb();
    new BackupService(target).restoreValidatedBackup(validated);
    const restoredIds = new Set(
      new BackupRepository(target).exportAllTables().headache_episodes.map((row) => row.id)
    );
    const created = new HeadacheRepository(target).createEpisode({
      startedAt: '2024-07-01T10:00:00.000Z',
      endedAt: '2024-07-01T11:00:00.000Z',
    });
    expect(restoredIds.has(created.id)).toBe(false);
  });

  test('P restored analytics semantics stay consistent', async () => {
    const source = await openTestDb();
    seedPopulatedDb(source);
    const before = new AnalyticsRepository(source).buildReport('30d', '2024-06-30');

    const validated = new BackupService(source).validateBackupText(
      new BackupService(source).serializeBackup(
        new BackupService(source).createBackupPayload()
      )
    );

    const target = await openTestDb();
    new BackupService(target).restoreValidatedBackup(validated);
    const after = new AnalyticsRepository(target).buildReport('30d', '2024-06-30');

    expect(after.overview.episodeCount).toBe(before.overview.episodeCount);
    expect(after.overview.headacheDayCount).toBe(before.overview.headacheDayCount);
  });
});

describe('delete all data', () => {
  test('clears user tables and resets settings', async () => {
    const db = await openTestDb();
    seedPopulatedDb(db);

    new DataMaintenanceService(db).deleteAllUserData();

    expect(new HeadacheRepository(db).listEpisodes()).toHaveLength(0);
    expect(new MedicationRepository(db).listMedications({ includeArchived: true })).toHaveLength(0);
    expect(new DailyCheckInRepository(db).listDailyCheckIns('2024-01-01', '2024-12-31')).toHaveLength(0);
    expect(new SettingsRepository(db).getSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });
});
