/**
 * Repository for headache episodes, intensity entries, and episode tag sets.
 * All writes validate domain rules before touching SQLite.
 */

import type {
  FactorCode,
  HeadacheSide,
  LocationCode,
  PainCharacterCode,
  SymptomCode,
} from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type {
  CodeLabelInput,
  HeadacheEpisode,
  HeadacheEpisodeInput,
  PainIntensityEntry,
} from '@/src/domain/types';
import {
  validateEpisodeTimes,
  validateIntensity,
} from '@/src/domain/validation';
import type { SqlDatabase } from '@/src/db/types';
import { createId } from '@/src/utils/id';
import { nowIsoUtc } from '@/src/utils/timestamps';

/** Raw SQLite row shape for headache_episodes. */
type EpisodeRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  side: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Raw SQLite row shape for pain_intensity_entries. */
type IntensityRow = {
  id: string;
  episode_id: string;
  recorded_at: string;
  intensity: number;
  created_at: string;
};

export class HeadacheRepository {
  constructor(private readonly db: SqlDatabase) {}

  /** Inserts a new episode; returns the persisted domain entity. */
  createEpisode(input: HeadacheEpisodeInput): HeadacheEpisode {
    validateEpisodeTimes(input.startedAt, input.endedAt ?? null);

    const id = createId();
    const now = nowIsoUtc();
    const endedAt = input.endedAt ?? null;
    const side = input.side ?? null;
    const notes = input.notes ?? null;

    try {
      this.db.run(
        `INSERT INTO headache_episodes
          (id, started_at, ended_at, side, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, input.startedAt, endedAt, side, notes, now, now]
      );
    } catch (err) {
      throw new StorageError('Failed to create headache episode', err);
    }

    return {
      id,
      startedAt: input.startedAt,
      endedAt,
      side: side as HeadacheSide | null,
      notes,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Returns an episode by id, or null if missing. */
  getEpisodeById(id: string): HeadacheEpisode | null {
    const row = this.db.getFirst<EpisodeRow>(
      'SELECT * FROM headache_episodes WHERE id = ?',
      [id]
    );
    return row ? mapEpisode(row) : null;
  }

  /**
   * Returns the currently active episode (ended_at IS NULL), if any.
   * If multiple exist (data anomaly), returns the most recently started.
   */
  getActiveEpisode(): HeadacheEpisode | null {
    const row = this.db.getFirst<EpisodeRow>(
      `SELECT * FROM headache_episodes
       WHERE ended_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`
    );
    return row ? mapEpisode(row) : null;
  }

  /** Lists episodes ordered by started_at descending. */
  listEpisodes(limit = 100): HeadacheEpisode[] {
    const rows = this.db.getAll<EpisodeRow>(
      `SELECT * FROM headache_episodes
       ORDER BY started_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map(mapEpisode);
  }

  /** Partial update of episode scalar fields. */
  updateEpisode(
    id: string,
    patch: Partial<HeadacheEpisodeInput>
  ): HeadacheEpisode {
    const existing = this.getEpisodeById(id);
    if (!existing) {
      throw new StorageError(`Episode not found: ${id}`);
    }

    const startedAt = patch.startedAt ?? existing.startedAt;
    const endedAt =
      patch.endedAt !== undefined ? patch.endedAt : existing.endedAt;
    const side = patch.side !== undefined ? patch.side ?? null : existing.side;
    const notes =
      patch.notes !== undefined ? patch.notes ?? null : existing.notes;

    validateEpisodeTimes(startedAt, endedAt);

    const updatedAt = nowIsoUtc();
    try {
      this.db.run(
        `UPDATE headache_episodes
         SET started_at = ?, ended_at = ?, side = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [startedAt, endedAt, side, notes, updatedAt, id]
      );
    } catch (err) {
      throw new StorageError(`Failed to update episode ${id}`, err);
    }

    return {
      ...existing,
      startedAt,
      endedAt,
      side,
      notes,
      updatedAt,
    };
  }

  /** Marks an episode as ended at the given ISO timestamp (default: now). */
  endEpisode(id: string, endedAt: string = nowIsoUtc()): HeadacheEpisode {
    return this.updateEpisode(id, { endedAt });
  }

  /** Deletes an episode; CASCADE removes intensities and tag rows. */
  deleteEpisode(id: string): void {
    try {
      const result = this.db.run('DELETE FROM headache_episodes WHERE id = ?', [
        id,
      ]);
      if (result.changes === 0) {
        throw new StorageError(`Episode not found: ${id}`);
      }
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`Failed to delete episode ${id}`, err);
    }
  }

  /** Adds a pain intensity reading for an episode. */
  addIntensityEntry(
    episodeId: string,
    intensity: number,
    recordedAt: string = nowIsoUtc()
  ): PainIntensityEntry {
    validateIntensity(intensity);

    if (!this.getEpisodeById(episodeId)) {
      throw new StorageError(`Episode not found: ${episodeId}`);
    }

    const id = createId();
    const createdAt = nowIsoUtc();

    try {
      this.db.run(
        `INSERT INTO pain_intensity_entries
          (id, episode_id, recorded_at, intensity, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, episodeId, recordedAt, intensity, createdAt]
      );
    } catch (err) {
      throw new StorageError('Failed to insert intensity entry', err);
    }

    return {
      id,
      episodeId,
      recordedAt,
      intensity,
      createdAt,
    };
  }

  /** Lists intensity entries for an episode, oldest first. */
  listIntensityEntries(episodeId: string): PainIntensityEntry[] {
    const rows = this.db.getAll<IntensityRow>(
      `SELECT * FROM pain_intensity_entries
       WHERE episode_id = ?
       ORDER BY recorded_at ASC`,
      [episodeId]
    );
    return rows.map(mapIntensity);
  }

  /** Replaces all location tags for an episode inside a transaction. */
  setLocations(
    episodeId: string,
    items: CodeLabelInput<LocationCode>[]
  ): void {
    this.replaceCodeSet('episode_locations', episodeId, items);
  }

  /** Replaces all pain-character tags for an episode. */
  setPainCharacters(
    episodeId: string,
    items: CodeLabelInput<PainCharacterCode>[]
  ): void {
    this.replaceCodeSet('episode_pain_characters', episodeId, items);
  }

  /** Replaces all symptom tags for an episode. */
  setSymptoms(
    episodeId: string,
    items: CodeLabelInput<SymptomCode>[]
  ): void {
    this.replaceCodeSet('episode_symptoms', episodeId, items);
  }

  /** Replaces all factor (possible trigger) tags for an episode. */
  setFactors(
    episodeId: string,
    items: CodeLabelInput<FactorCode>[]
  ): void {
    this.replaceCodeSet('episode_factors', episodeId, items);
  }

  /**
   * Delete-all-then-insert pattern for code tag tables.
   * Runs in a transaction so partial writes never leave an empty set on failure.
   */
  private replaceCodeSet(
    table:
      | 'episode_locations'
      | 'episode_pain_characters'
      | 'episode_symptoms'
      | 'episode_factors',
    episodeId: string,
    items: CodeLabelInput<string>[]
  ): void {
    if (!this.getEpisodeById(episodeId)) {
      throw new StorageError(`Episode not found: ${episodeId}`);
    }

    try {
      this.db.withTransaction(() => {
        this.db.run(`DELETE FROM ${table} WHERE episode_id = ?`, [episodeId]);
        for (const item of items) {
          this.db.run(
            `INSERT INTO ${table} (id, episode_id, code, custom_label)
             VALUES (?, ?, ?, ?)`,
            [createId(), episodeId, item.code, item.customLabel ?? null]
          );
        }
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`Failed to replace set on ${table}`, err);
    }
  }
}

function mapEpisode(row: EpisodeRow): HeadacheEpisode {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    side: row.side as HeadacheSide | null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIntensity(row: IntensityRow): PainIntensityEntry {
  return {
    id: row.id,
    episodeId: row.episode_id,
    recordedAt: row.recorded_at,
    intensity: row.intensity,
    createdAt: row.created_at,
  };
}
