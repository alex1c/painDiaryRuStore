/**
 * Phase 4 medication catalog, intakes, snapshots, and effect rating tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { HeadacheRepository } from '@/src/repositories/HeadacheRepository';
import { MedicationRepository } from '@/src/repositories/MedicationRepository';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('medications phase 4', () => {
  test('schema version is 4 after migration', async () => {
    const db = await openTestDb();
    expect(db.getUserVersion()).toBe(4);
    expect(CURRENT_SCHEMA_VERSION).toBe(4);
  });

  test('A create medication', async () => {
    const db = await openTestDb();
    const meds = new MedicationRepository(db);

    const medication = meds.createMedication({
      name: 'Ибупрофен',
      defaultDose: '400 мг',
    });

    expect(medication.name).toBe('Ибупрофен');
    expect(medication.defaultDose).toBe('400 мг');
    expect(medication.isArchived).toBe(false);
  });

  test('B edit medication', async () => {
    const db = await openTestDb();
    const meds = new MedicationRepository(db);
    const created = meds.createMedication({ name: 'Парацетамол' });

    const updated = meds.updateMedication(created.id, {
      name: 'Парацетамол 500',
      defaultDose: '1 таблетка',
    });

    expect(updated.name).toBe('Парацетамол 500');
    expect(updated.defaultDose).toBe('1 таблетка');
  });

  test('C archive medication', async () => {
    const db = await openTestDb();
    const meds = new MedicationRepository(db);
    const medication = meds.createMedication({ name: 'Нурофен' });

    const archived = meds.archiveMedication(medication.id);
    expect(archived.isArchived).toBe(true);
    expect(meds.getMedicationById(medication.id)?.isArchived).toBe(true);
  });

  test('D archived medication excluded from active list', async () => {
    const db = await openTestDb();
    const meds = new MedicationRepository(db);
    const active = meds.createMedication({ name: 'Активное' });
    const toArchive = meds.createMedication({ name: 'Архивное' });
    meds.archiveMedication(toArchive.id);

    const list = meds.listMedications();
    expect(list.map((m) => m.id)).toEqual([active.id]);
    expect(
      meds.listMedications({ includeArchived: true }).length
    ).toBe(2);
  });

  test('E historical intake survives medication archive', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-01T10:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Ибупрофен' });
    const intake = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      dose: '400 мг',
      takenAt: '2024-06-01T10:30:00.000Z',
    });

    meds.archiveMedication(medication.id);
    meds.updateMedication(medication.id, { name: 'Другое имя' });

    const loaded = meds.getIntakeById(intake.id);
    expect(loaded?.medicationNameSnapshot).toBe('Ибупрофен');
    expect(loaded?.dose).toBe('400 мг');
  });

  test('F create intake linked to episode', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-02T08:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Аспирин' });
    const intake = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      takenAt: '2024-06-02T09:00:00.000Z',
    });

    expect(intake.episodeId).toBe(episode.id);
    expect(meds.listIntakesForEpisode(episode.id)).toHaveLength(1);
  });

  test('G dose snapshot preserved when default dose changes', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-03T08:00:00.000Z',
    });
    const medication = meds.createMedication({
      name: 'Ибупрофен',
      defaultDose: '400 мг',
    });
    const intake = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      dose: '200 мг',
      takenAt: '2024-06-03T09:00:00.000Z',
    });

    meds.updateMedication(medication.id, { defaultDose: '600 мг' });

    expect(meds.getIntakeById(intake.id)?.dose).toBe('200 мг');
  });

  test('H medication name snapshot preserved on rename', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-04T08:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Ибупрофен' });
    const intake = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      takenAt: '2024-06-04T09:00:00.000Z',
    });

    meds.updateMedication(medication.id, { name: 'Нурофен' });

    expect(meds.getIntakeById(intake.id)?.medicationNameSnapshot).toBe(
      'Ибупрофен'
    );
  });

  test('I multiple intakes allowed in one episode', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-05T08:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Ибупрофен' });

    meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      dose: '400 мг',
      takenAt: '2024-06-05T16:30:00.000Z',
    });
    meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      dose: '400 мг',
      takenAt: '2024-06-05T18:00:00.000Z',
    });

    expect(meds.listIntakesForEpisode(episode.id)).toHaveLength(2);
  });

  test('J edit intake dose and time', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-06T08:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Ибупрофен' });
    const intake = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      dose: '400 мг',
      takenAt: '2024-06-06T10:00:00.000Z',
    });

    const updated = meds.updateIntake(intake.id, {
      dose: '200 мг',
      takenAt: '2024-06-06T11:00:00.000Z',
    });

    expect(updated.dose).toBe('200 мг');
    expect(updated.takenAt).toBe('2024-06-06T11:00:00.000Z');
    expect(updated.updatedAt).toBeTruthy();
  });

  test('K delete intake does not delete medication', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-07T08:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Ибупрофен' });
    const intake = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      takenAt: '2024-06-07T09:00:00.000Z',
    });

    meds.deleteIntake(intake.id);

    expect(meds.getIntakeById(intake.id)).toBeNull();
    expect(meds.getMedicationById(medication.id)?.name).toBe('Ибупрофен');
  });

  test('L effect rating', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-08T08:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Ибупрофен' });
    const intake = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      takenAt: '2024-06-08T09:00:00.000Z',
    });

    const rated = meds.setIntakeEffect(intake.id, 'helped_somewhat');
    expect(rated.effect).toBe('helped_somewhat');
  });

  test('M effect_rated_at set on rating', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-09T08:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Ибупрофен' });
    const intake = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      takenAt: '2024-06-09T09:00:00.000Z',
    });

    expect(meds.getIntakeById(intake.id)?.effectRatedAt).toBeNull();

    const rated = meds.setIntakeEffect(
      intake.id,
      'helped_a_lot',
      '2024-06-09T10:00:00.000Z'
    );
    expect(rated.effectRatedAt).toBe('2024-06-09T10:00:00.000Z');
  });

  test('N episode deletion nulls intake episode_id (intake preserved)', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-10T08:00:00.000Z',
    });
    const medication = meds.createMedication({ name: 'Ибупрофен' });
    const intake = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      takenAt: '2024-06-10T09:00:00.000Z',
    });

    headaches.deleteEpisode(episode.id);

    const orphan = meds.getIntakeById(intake.id);
    expect(orphan).not.toBeNull();
    expect(orphan?.episodeId).toBeNull();
  });

  test('O migration adds snapshot columns', async () => {
    const db = await openTestDb();
    const columns = db.getAll<{ name: string }>(
      `PRAGMA table_info(medication_intakes)`
    );
    const names = columns.map((c) => c.name);
    expect(names).toContain('medication_name_snapshot');
    expect(names).toContain('updated_at');
  });

  test('P getOrCreateMedication from quick intake auto-saves', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);

    const episode = headaches.createEpisode({
      startedAt: '2024-06-11T08:00:00.000Z',
    });

    meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationName: 'Новое лекарство',
      defaultDose: '1 таблетка',
      takenAt: '2024-06-11T09:00:00.000Z',
    });

    const list = meds.listMedications();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Новое лекарство');
    expect(list[0].defaultDose).toBe('1 таблетка');
  });

  test('reactivate archived medication', async () => {
    const db = await openTestDb();
    const meds = new MedicationRepository(db);
    const medication = meds.createMedication({ name: 'Восстановить' });
    meds.archiveMedication(medication.id);

    const restored = meds.reactivateMedication(medication.id);
    expect(restored.isArchived).toBe(false);
    expect(meds.listMedications().some((m) => m.id === medication.id)).toBe(
      true
    );
  });
});
