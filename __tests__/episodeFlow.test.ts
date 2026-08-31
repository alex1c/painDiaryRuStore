/**
 * Phase 2 episode flow tests: start, intensity, finish, today query, delete, persistence.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { DomainValidationError } from '@/src/domain/validation';
import { HeadacheRepository } from '@/src/repositories/HeadacheRepository';
import { toLocalDateString } from '@/src/utils/localDate';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('episode flow', () => {
  test('schema version is 2 after migrations', async () => {
    const db = await openTestDb();
    expect(db.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe(4);
  });

  test('startEpisode creates episode + initial intensity atomically', async () => {
    const db = await openTestDb();
    const repo = new HeadacheRepository(db);

    const { episode, intensity } = repo.startEpisode({
      intensity: 6,
      startedAt: '2024-06-01T10:00:00.000Z',
    });

    expect(episode.endedAt).toBeNull();
    expect(intensity.intensity).toBe(6);
    expect(intensity.recordedAt).toBe(episode.startedAt);
    expect(repo.getLatestIntensityEntry(episode.id)?.intensity).toBe(6);
    expect(repo.getIntensityEntries(episode.id)).toHaveLength(1);
  });

  test('cannot start a second active episode', async () => {
    const db = await openTestDb();
    const repo = new HeadacheRepository(db);

    repo.startEpisode({ intensity: 4, startedAt: '2024-06-01T10:00:00.000Z' });

    expect(() =>
      repo.startEpisode({ intensity: 5, startedAt: '2024-06-01T11:00:00.000Z' })
    ).toThrow(DomainValidationError);

    expect(repo.countActiveEpisodes()).toBe(1);
  });

  test('intensity history: add, latest, bounds, duplicate skip', async () => {
    const db = await openTestDb();
    const repo = new HeadacheRepository(db);
    const { episode } = repo.startEpisode({
      intensity: 4,
      startedAt: '2024-06-01T10:00:00.000Z',
    });

    expect(
      repo.addIntensityEntry(episode.id, 7, '2024-06-01T10:45:00.000Z')
    ).not.toBeNull();
    expect(repo.getLatestIntensityEntry(episode.id)?.intensity).toBe(7);

    // Same intensity → no new row
    expect(
      repo.addIntensityEntry(episode.id, 7, '2024-06-01T11:00:00.000Z')
    ).toBeNull();
    expect(repo.getIntensityEntries(episode.id)).toHaveLength(2);

    expect(() =>
      repo.addIntensityEntry(episode.id, -1, '2024-06-01T11:05:00.000Z')
    ).toThrow(DomainValidationError);
    expect(() =>
      repo.addIntensityEntry(episode.id, 11, '2024-06-01T11:05:00.000Z')
    ).toThrow(DomainValidationError);

    expect(
      repo.addIntensityEntry(episode.id, 0, '2024-06-01T11:10:00.000Z')
    ).not.toBeNull();
    expect(
      repo.addIntensityEntry(episode.id, 10, '2024-06-01T11:15:00.000Z')
    ).not.toBeNull();
  });

  test('finishEpisode sets endedAt; end before start rejected', async () => {
    const db = await openTestDb();
    const repo = new HeadacheRepository(db);
    const { episode } = repo.startEpisode({
      intensity: 5,
      startedAt: '2024-06-01T12:00:00.000Z',
    });

    expect(() =>
      repo.finishEpisode(episode.id, '2024-06-01T11:00:00.000Z')
    ).toThrow(DomainValidationError);

    const finished = repo.finishEpisode(
      episode.id,
      '2024-06-01T14:00:00.000Z'
    );
    expect(finished.endedAt).toBe('2024-06-01T14:00:00.000Z');
    expect(repo.getActiveEpisode()).toBeNull();
  });

  test('Today query uses local start date; cross-midnight stays on start day', async () => {
    const db = await openTestDb();
    const repo = new HeadacheRepository(db);

    // Use yesterday 23:30 local so start is never "in the future".
    const lateLocal = new Date();
    lateLocal.setDate(lateLocal.getDate() - 1);
    lateLocal.setHours(23, 30, 0, 0);
    const startIso = lateLocal.toISOString();
    const startLocalDate = toLocalDateString(lateLocal);

    const nextMorning = new Date(lateLocal);
    nextMorning.setDate(nextMorning.getDate() + 1);
    nextMorning.setHours(1, 0, 0, 0);

    const { episode } = repo.startEpisode({ intensity: 6, startedAt: startIso });
    repo.finishEpisode(episode.id, nextMorning.toISOString());

    const onStartDay = repo.getCompletedEpisodesForLocalDate(startLocalDate);
    expect(onStartDay.some((e) => e.id === episode.id)).toBe(true);

    const nextLocalDate = toLocalDateString(nextMorning);
    if (nextLocalDate !== startLocalDate) {
      const onEndDay = repo.getCompletedEpisodesForLocalDate(nextLocalDate);
      expect(onEndDay.some((e) => e.id === episode.id)).toBe(false);
    }
  });

  test('delete episode cascades intensity history', async () => {
    const db = await openTestDb();
    const repo = new HeadacheRepository(db);
    const { episode } = repo.startEpisode({
      intensity: 3,
      startedAt: '2024-06-03T08:00:00.000Z',
    });
    repo.addIntensityEntry(episode.id, 8, '2024-06-03T09:00:00.000Z');

    repo.deleteEpisode(episode.id);
    expect(repo.getEpisodeById(episode.id)).toBeNull();
    expect(repo.getIntensityEntries(episode.id)).toHaveLength(0);
  });

  test('persistence: new repository instance still sees active episode', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const adapter = createSqlJsAdapter(raw);
    const db1 = createDatabaseFromClient(adapter);
    const repo1 = new HeadacheRepository(db1);

    const { episode } = repo1.startEpisode({
      intensity: 5,
      startedAt: '2024-06-04T09:00:00.000Z',
    });

    // Simulate relaunch: new repository on same underlying DB.
    const db2 = createDatabaseFromClient(adapter);
    const repo2 = new HeadacheRepository(db2);

    expect(repo2.getActiveEpisode()?.id).toBe(episode.id);
    expect(repo2.getLatestIntensityEntry(episode.id)?.intensity).toBe(5);
  });

  test('anomaly: multiple active episodes → newest wins, data kept', async () => {
    const db = await openTestDb();
    // Insert two actives via raw SQL to simulate corrupted data.
    db.run(
      `INSERT INTO headache_episodes
        (id, started_at, ended_at, side, notes, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, NULL, ?, ?)`,
      ['ep-old', '2024-06-05T08:00:00.000Z', '2024-06-05T08:00:00.000Z', '2024-06-05T08:00:00.000Z']
    );
    db.run(
      `INSERT INTO headache_episodes
        (id, started_at, ended_at, side, notes, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, NULL, ?, ?)`,
      ['ep-new', '2024-06-05T10:00:00.000Z', '2024-06-05T10:00:00.000Z', '2024-06-05T10:00:00.000Z']
    );

    const repo = new HeadacheRepository(db);
    expect(repo.countActiveEpisodes()).toBe(2);
    expect(repo.getActiveEpisode()?.id).toBe('ep-new');
    expect(repo.getEpisodeById('ep-old')).not.toBeNull();
  });
});
