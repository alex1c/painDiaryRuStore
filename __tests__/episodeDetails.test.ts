/**
 * Phase 3 episode details + custom factors tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { CustomFactorRepository } from '@/src/repositories/CustomFactorRepository';
import { HeadacheRepository } from '@/src/repositories/HeadacheRepository';
import { normalizeFactorName } from '@/src/utils/normalizeName';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('episode details', () => {
  test('schema version is 3', async () => {
    const db = await openTestDb();
    expect(db.getUserVersion()).toBe(3);
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });

  test('save / reopen / replace / clear details', async () => {
    const db = await openTestDb();
    const repo = new HeadacheRepository(db);
    const { episode } = repo.startEpisode({
      intensity: 5,
      startedAt: '2024-07-01T10:00:00.000Z',
    });

    repo.replaceEpisodeDetails(episode.id, {
      side: 'right',
      locations: [{ code: 'temple' }, { code: 'eye' }],
      painCharacters: [{ code: 'throbbing' }, { code: 'pressure' }],
      symptoms: [{ code: 'photophobia' }, { code: 'nausea' }],
      factors: [{ code: 'stress' }, { code: 'poor_sleep' }],
    });

    let details = repo.getEpisodeDetails(episode.id);
    expect(details?.episode.side).toBe('right');
    expect(details?.locations.map((l) => l.code).sort()).toEqual([
      'eye',
      'temple',
    ]);
    expect(details?.painCharacters.map((c) => c.code).sort()).toEqual([
      'pressure',
      'throbbing',
    ]);
    expect(details?.symptoms.map((s) => s.code).sort()).toEqual([
      'nausea',
      'photophobia',
    ]);
    expect(details?.factors.map((f) => f.code).sort()).toEqual([
      'poor_sleep',
      'stress',
    ]);
    expect(repo.hasPainDetails(episode.id)).toBe(true);

    // Replace with a different set (no duplicates).
    repo.replaceEpisodeDetails(episode.id, {
      side: 'bilateral',
      locations: [{ code: 'neck' }, { code: 'neck' }],
      painCharacters: [{ code: 'stabbing' }],
      symptoms: [{ code: 'aura' }],
      factors: [{ code: 'screen_time' }],
    });

    details = repo.getEpisodeDetails(episode.id);
    expect(details?.episode.side).toBe('bilateral');
    expect(details?.locations).toHaveLength(1);
    expect(details?.locations[0]?.code).toBe('neck');
    expect(details?.symptoms[0]?.code).toBe('aura');

    // Clear all detail tags + side.
    repo.replaceEpisodeDetails(episode.id, {
      side: null,
      locations: [],
      painCharacters: [],
      symptoms: [],
      factors: [],
    });
    details = repo.getEpisodeDetails(episode.id);
    expect(details?.episode.side).toBeNull();
    expect(details?.locations).toHaveLength(0);
    expect(details?.symptoms).toHaveLength(0);
    expect(details?.factors).toHaveLength(0);
    expect(repo.hasPainDetails(episode.id)).toBe(false);
  });

  test('transaction rolls back when write fails mid-update', async () => {
    const db = await openTestDb();
    const repo = new HeadacheRepository(db);
    const { episode } = repo.startEpisode({
      intensity: 4,
      startedAt: '2024-07-02T10:00:00.000Z',
    });

    repo.replaceEpisodeDetails(episode.id, {
      side: 'left',
      locations: [{ code: 'forehead' }],
      symptoms: [{ code: 'dizziness' }],
      factors: [{ code: 'heat' }],
    });

    const originalRun = db.run.bind(db);
    let insertCount = 0;
    db.run = ((sql: string, params?: unknown[]) => {
      if (
        typeof sql === 'string' &&
        sql.includes('INSERT INTO episode_locations')
      ) {
        insertCount += 1;
        if (insertCount === 1) {
          throw new Error('simulated failure');
        }
      }
      return originalRun(sql, params);
    }) as typeof db.run;

    expect(() =>
      repo.replaceEpisodeDetails(episode.id, {
        side: 'right',
        locations: [{ code: 'temple' }],
        symptoms: [{ code: 'aura' }],
        factors: [{ code: 'stress' }],
      })
    ).toThrow();

    // Restore runner and verify previous details intact.
    db.run = originalRun;
    const details = repo.getEpisodeDetails(episode.id);
    expect(details?.episode.side).toBe('left');
    expect(details?.locations[0]?.code).toBe('forehead');
    expect(details?.symptoms[0]?.code).toBe('dizziness');
    expect(details?.factors[0]?.code).toBe('heat');
  });

  test('delete episode cascades detail relations', async () => {
    const db = await openTestDb();
    const repo = new HeadacheRepository(db);
    const { episode } = repo.startEpisode({
      intensity: 3,
      startedAt: '2024-07-03T08:00:00.000Z',
    });
    repo.replaceEpisodeDetails(episode.id, {
      locations: [{ code: 'temple' }],
      symptoms: [{ code: 'nausea' }],
      factors: [{ code: 'stress' }],
    });

    repo.deleteEpisode(episode.id);
    expect(
      db.getAll(`SELECT * FROM episode_locations WHERE episode_id = ?`, [
        episode.id,
      ])
    ).toHaveLength(0);
    expect(
      db.getAll(`SELECT * FROM episode_symptoms WHERE episode_id = ?`, [
        episode.id,
      ])
    ).toHaveLength(0);
    expect(
      db.getAll(`SELECT * FROM episode_factors WHERE episode_id = ?`, [
        episode.id,
      ])
    ).toHaveLength(0);
  });
});

describe('custom factors', () => {
  test('create, normalize duplicates, reuse, archive keeps history', async () => {
    const db = await openTestDb();
    const customs = new CustomFactorRepository(db);
    const repo = new HeadacheRepository(db);

    expect(normalizeFactorName('  Баня  ')).toBe('баня');

    const a = customs.getOrCreate('Баня');
    const b = customs.getOrCreate('баня');
    const c = customs.getOrCreate('БАНЯ');
    expect(a.id).toBe(b.id);
    expect(b.id).toBe(c.id);
    expect(customs.listActive()).toHaveLength(1);

    const { episode: e1 } = repo.startEpisode({
      intensity: 5,
      startedAt: '2024-07-04T09:00:00.000Z',
    });
    repo.replaceEpisodeDetails(e1.id, {
      factors: [
        {
          code: 'custom',
          customFactorId: a.id,
          customLabel: a.name,
        },
      ],
    });
    repo.finishEpisode(e1.id, '2024-07-04T11:00:00.000Z');

    const { episode: e2 } = repo.startEpisode({
      intensity: 6,
      startedAt: '2024-07-05T09:00:00.000Z',
    });
    repo.replaceEpisodeDetails(e2.id, {
      factors: [
        {
          code: 'custom',
          customFactorId: a.id,
          customLabel: a.name,
        },
      ],
    });

    customs.archive(a.id);
    expect(customs.listActive()).toHaveLength(0);
    expect(customs.getById(a.id)?.isArchived).toBe(true);

    // Historical usage remains.
    expect(repo.listFactors(e1.id)[0]?.customFactorId).toBe(a.id);
    expect(repo.listFactors(e2.id)[0]?.customLabel).toBe('Баня');

    // Creating again un-archives.
    const revived = customs.getOrCreate('Баня');
    expect(revived.id).toBe(a.id);
    expect(revived.isArchived).toBe(false);
  });
});
