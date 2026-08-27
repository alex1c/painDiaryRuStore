/**
 * Integration-style DB tests using sql.js (in-memory) + repositories.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { HeadacheRepository } from '@/src/repositories/HeadacheRepository';
import { MedicationRepository } from '@/src/repositories/MedicationRepository';
import { nowIsoUtc } from '@/src/utils/timestamps';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const adapter = createSqlJsAdapter(raw);
  return createDatabaseFromClient(adapter);
}

describe('database', () => {
  test('init sets schema version and is idempotent on re-init', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const adapter = createSqlJsAdapter(raw);

    const db1 = createDatabaseFromClient(adapter);
    expect(db1.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);

    // Re-running migrations / createDatabaseFromClient must not destroy data
    // or fail when schema is already current.
    const db2 = createDatabaseFromClient(adapter);
    expect(db2.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);

    const tables = db2.getAll<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'headache_episodes'`
    );
    expect(tables).toHaveLength(1);
  });

  test('episode CRUD + intensity + cascade delete', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);

    const startedAt = '2024-06-01T08:00:00.000Z';
    const episode = headaches.createEpisode({
      startedAt,
      notes: 'Test episode',
    });

    expect(episode.id).toBeTruthy();
    expect(headaches.getEpisodeById(episode.id)?.notes).toBe('Test episode');
    expect(headaches.getActiveEpisode()?.id).toBe(episode.id);

    headaches.addIntensityEntry(episode.id, 6, '2024-06-01T08:30:00.000Z');
    headaches.addIntensityEntry(episode.id, 8, '2024-06-01T09:00:00.000Z');
    expect(headaches.listIntensityEntries(episode.id)).toHaveLength(2);

    headaches.endEpisode(episode.id, '2024-06-01T12:00:00.000Z');
    expect(headaches.getActiveEpisode()).toBeNull();
    expect(headaches.getEpisodeById(episode.id)?.endedAt).toBe(
      '2024-06-01T12:00:00.000Z'
    );

    headaches.deleteEpisode(episode.id);
    expect(headaches.getEpisodeById(episode.id)).toBeNull();
    expect(headaches.listIntensityEntries(episode.id)).toHaveLength(0);
  });

  test('foreign keys: intake requires existing medication', async () => {
    const db = await openTestDb();
    const meds = new MedicationRepository(db);

    expect(() =>
      meds.createIntake({
        medicationId: '00000000-0000-4000-8000-000000000099',
        takenAt: nowIsoUtc(),
      })
    ).toThrow();

    const medication = meds.createMedication({ name: 'Paracetamol' });
    const intake = meds.createIntake({
      medicationId: medication.id,
      takenAt: '2024-06-01T10:00:00.000Z',
      episodeId: null,
      dose: '500',
      unit: 'mg',
    });

    expect(intake.episodeId).toBeNull();
    expect(intake.medicationId).toBe(medication.id);

    meds.setIntakeEffect(intake.id, 'helped_somewhat');
    expect(meds.getIntakeById(intake.id)?.effect).toBe('helped_somewhat');
    expect(meds.getIntakeById(intake.id)?.effectRatedAt).toBeTruthy();
  });

  test('FK cascade: deleting episode nulls intake.episode_id', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-02T08:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Ibuprofen' });
    const intake = meds.createIntake({
      medicationId: medication.id,
      episodeId: episode.id,
      takenAt: '2024-06-02T09:00:00.000Z',
    });

    headaches.deleteEpisode(episode.id);
    expect(meds.getIntakeById(intake.id)?.episodeId).toBeNull();
  });
});
