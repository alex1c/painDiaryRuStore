/**
 * Phase 4 medication catalog, intakes, snapshots, and effect rating tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { migration001Initial } from '@/src/db/migrations/001_initial';
import { migration002IntensityRecordedIndex } from '@/src/db/migrations/002_intensity_recorded_index';
import { migration003CustomFactors } from '@/src/db/migrations/003_custom_factors';
import { migration004MedicationIntakeSnapshots } from '@/src/db/migrations/004_medication_intake_snapshots';
import { migration005MedicationIntakeEpisodeCascade } from '@/src/db/migrations/005_medication_intake_episode_cascade';
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
  test('schema version is current after migration', async () => {
    const db = await openTestDb();
    expect(db.getUserVersion()).toBe(5);
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
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

  test('N episode deletion removes otherwise unreachable episode intake', async () => {
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

    expect(meds.getIntakeById(intake.id)).toBeNull();
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

  test('migration v3 to v4 backfills existing intake snapshot and updated_at', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const db = createSqlJsAdapter(raw);
    db.exec('PRAGMA foreign_keys = ON;');
    for (const migration of [
      migration001Initial,
      migration002IntensityRecordedIndex,
      migration003CustomFactors,
    ]) {
      migration.up(db);
      db.setUserVersion(migration.version);
    }
    db.run(
      `INSERT INTO headache_episodes
       (id, started_at, ended_at, side, notes, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, NULL, ?, ?)`,
      ['episode', '2024-06-01T08:00:00.000Z', 'created', 'created']
    );
    db.run(
      `INSERT INTO medications
       (id, name, default_dose, unit, notes, is_archived, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, NULL, 0, ?, ?)`,
      ['medication', 'Ибупрофен', 'created', 'created']
    );
    db.run(
      `INSERT INTO medication_intakes
       (id, episode_id, medication_id, taken_at, dose, unit, effect,
        effect_rated_at, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, ?)`,
      ['intake', 'episode', 'medication', '2024-06-01T09:00:00.000Z', 'created']
    );

    migration004MedicationIntakeSnapshots.up(db);

    expect(
      db.getFirst<{ medication_name_snapshot: string; updated_at: string }>(
        'SELECT medication_name_snapshot, updated_at FROM medication_intakes WHERE id = ?',
        ['intake']
      )
    ).toEqual({ medication_name_snapshot: 'Ибупрофен', updated_at: 'created' });
  });

  test('migration v4 to v5 preserves intake data and changes episode FK to cascade', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const db = createSqlJsAdapter(raw);
    db.exec('PRAGMA foreign_keys = ON;');
    for (const migration of [
      migration001Initial,
      migration002IntensityRecordedIndex,
      migration003CustomFactors,
      migration004MedicationIntakeSnapshots,
    ]) {
      migration.up(db);
      db.setUserVersion(migration.version);
    }
    db.run(
      `INSERT INTO headache_episodes
       (id, started_at, ended_at, side, notes, created_at, updated_at)
       VALUES ('episode', '2024-06-01T08:00:00.000Z', NULL, NULL, NULL, 'created', 'created')`
    );
    db.run(
      `INSERT INTO medications
       (id, name, default_dose, unit, notes, is_archived, created_at, updated_at)
       VALUES ('medication', 'Ибупрофен', '400 мг', NULL, NULL, 0, 'created', 'created')`
    );
    db.run(
      `INSERT INTO medication_intakes
       (id, episode_id, medication_id, taken_at, dose, unit, effect,
        effect_rated_at, created_at, medication_name_snapshot, updated_at)
       VALUES ('intake', 'episode', 'medication', '2024-06-01T09:00:00.000Z',
        '400 мг', NULL, NULL, NULL, 'created', 'Ибупрофен', 'updated')`
    );

    migration005MedicationIntakeEpisodeCascade.up(db);

    expect(
      db.getFirst<{ dose: string; medication_name_snapshot: string; updated_at: string }>(
        'SELECT dose, medication_name_snapshot, updated_at FROM medication_intakes WHERE id = ?',
        ['intake']
      )
    ).toEqual({ dose: '400 мг', medication_name_snapshot: 'Ибупрофен', updated_at: 'updated' });
    db.run("DELETE FROM headache_episodes WHERE id = 'episode'");
    expect(db.getFirst('SELECT id FROM medication_intakes WHERE id = ?', ['intake'])).toBeNull();
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

  test('normalized catalog names do not create duplicates and archived match reactivates', async () => {
    const db = await openTestDb();
    const meds = new MedicationRepository(db);
    const medication = meds.createMedication({ name: 'Ибупрофен' });

    expect(() => meds.createMedication({ name: '  ИБУПРОФЕН  ' })).toThrow();
    meds.archiveMedication(medication.id);

    const restored = meds.getOrCreateMedication(' ибупрофен ');
    expect(restored.id).toBe(medication.id);
    expect(restored.isArchived).toBe(false);
    expect(meds.listMedications({ includeArchived: true })).toHaveLength(1);
  });

  test('quick intake rolls back a newly created medication when episode FK fails', async () => {
    const db = await openTestDb();
    const meds = new MedicationRepository(db);

    expect(() =>
      meds.recordEpisodeIntake({
        episodeId: 'missing-episode',
        medicationName: 'Не должно сохраниться',
        takenAt: '2024-06-11T09:00:00.000Z',
      })
    ).toThrow();
    expect(meds.listMedications({ includeArchived: true })).toHaveLength(0);
  });

  test('effect timestamp clears and survives unrelated or unchanged edits', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);
    const episode = headaches.createEpisode({ startedAt: '2024-06-12T08:00:00.000Z' });
    const medication = meds.createMedication({ name: 'Тест' });
    const intake = meds.createIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      takenAt: '2024-06-12T09:00:00.000Z',
      effect: 'helped_somewhat',
      effectRatedAt: '2024-06-12T10:00:00.000Z',
    });

    expect(meds.updateIntake(intake.id, { dose: '2' }).effectRatedAt).toBe(
      '2024-06-12T10:00:00.000Z'
    );
    expect(
      meds.updateIntake(intake.id, { effect: 'helped_somewhat' }).effectRatedAt
    ).toBe('2024-06-12T10:00:00.000Z');
    const cleared = meds.updateIntake(intake.id, { effect: null });
    expect(cleared.effect).toBeNull();
    expect(cleared.effectRatedAt).toBeNull();
  });

  test('intakes with identical timestamps have deterministic insertion ordering', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);
    const episode = headaches.createEpisode({ startedAt: '2024-06-13T08:00:00.000Z' });
    const medication = meds.createMedication({ name: 'Порядок' });
    const first = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      takenAt: '2024-06-13T09:00:00.000Z',
    });
    const second = meds.recordEpisodeIntake({
      episodeId: episode.id,
      medicationId: medication.id,
      takenAt: '2024-06-13T09:00:00.000Z',
    });

    const firstRead = meds.listIntakesForEpisode(episode.id).map((item) => item.id);
    const secondRead = meds.listIntakesForEpisode(episode.id).map((item) => item.id);
    expect(firstRead).toEqual(secondRead);
    expect(new Set(firstRead)).toEqual(new Set([first.id, second.id]));
  });
});
