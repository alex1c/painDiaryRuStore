/**
 * Repository for headache episodes, intensity entries, and episode tag sets.
 * Phase 2 adds atomic startEpisode, one-active-episode guard, and local-day queries.
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
  EpisodeDetails,
  EpisodeDetailsInput,
  EpisodeFactor,
  EpisodeLocation,
  EpisodePainCharacter,
  EpisodeSymptom,
  HeadacheEpisode,
  HeadacheEpisodeInput,
  PainIntensityEntry,
} from '@/src/domain/types';
import {
  DomainValidationError,
  validateEpisodeTimes,
  validateIntensity,
  validateLocalDate,
  validateNotInFuture,
} from '@/src/domain/validation';
import type { SqlDatabase } from '@/src/db/types';
import { createId } from '@/src/utils/id';
import { addDaysToLocalDate, parseLocalDate } from '@/src/utils/localDate';
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

/** Result of startEpisode — episode + mandatory first intensity entry. */
export type StartEpisodeResult = {
  episode: HeadacheEpisode;
  intensity: PainIntensityEntry;
};

/** Options when adding intensity; duplicate same value is skipped by default. */
export type AddIntensityOptions = {
  /**
   * When true, insert even if intensity equals the latest entry.
   * Useful if the user explicitly changed recordedAt.
   */
  force?: boolean;
};

export class HeadacheRepository {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Atomically creates an active episode and its first intensity entry.
   * Rejects when another active episode already exists (v1: one at a time).
   */
  startEpisode(input: {
    intensity: number;
    startedAt?: string;
  }): StartEpisodeResult {
    validateIntensity(input.intensity);

    const startedAt = input.startedAt ?? nowIsoUtc();
    validateEpisodeTimes(startedAt, null);
    validateNotInFuture(startedAt, 'startedAt');

    if (this.countActiveEpisodes() > 0) {
      throw new DomainValidationError(
        'An active headache episode already exists',
        'activeEpisode'
      );
    }

    const episodeId = createId();
    const intensityId = createId();
    const now = nowIsoUtc();

    try {
      this.db.withTransaction(() => {
        this.db.run(
          `INSERT INTO headache_episodes
            (id, started_at, ended_at, side, notes, created_at, updated_at)
           VALUES (?, ?, NULL, NULL, NULL, ?, ?)`,
          [episodeId, startedAt, now, now]
        );

        this.db.run(
          `INSERT INTO pain_intensity_entries
            (id, episode_id, recorded_at, intensity, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [intensityId, episodeId, startedAt, input.intensity, now]
        );
      });
    } catch (err) {
      if (err instanceof DomainValidationError) throw err;
      throw new StorageError('Failed to start headache episode', err);
    }

    return {
      episode: {
        id: episodeId,
        startedAt,
        endedAt: null,
        side: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
      intensity: {
        id: intensityId,
        episodeId,
        recordedAt: startedAt,
        intensity: input.intensity,
        createdAt: now,
      },
    };
  }

  /** Inserts a new episode without intensity (legacy/tests); prefer startEpisode. */
  createEpisode(input: HeadacheEpisodeInput): HeadacheEpisode {
    validateEpisodeTimes(input.startedAt, input.endedAt ?? null);
    if (input.endedAt == null) {
      validateNotInFuture(input.startedAt, 'startedAt');
      // Same one-active rule as startEpisode — protect non-UI callers too.
      if (this.countActiveEpisodes() > 0) {
        throw new DomainValidationError(
          'An active headache episode already exists',
          'activeEpisode'
        );
      }
    }

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
   * If multiple exist (data anomaly), returns the most recently started
   * and logs a warning in development — does not delete user data.
   */
  getActiveEpisode(): HeadacheEpisode | null {
    const activeCount = this.countActiveEpisodes();
    if (activeCount > 1 && typeof __DEV__ !== 'undefined' && __DEV__) {
      // Deterministic recovery: newest started_at wins; keep all rows.
      console.warn(
        `[HeadacheRepository] Data anomaly: ${activeCount} active episodes; using newest`
      );
    }

    const row = this.db.getFirst<EpisodeRow>(
      `SELECT * FROM headache_episodes
       WHERE ended_at IS NULL
       ORDER BY started_at DESC, created_at DESC, id DESC
       LIMIT 1`
    );
    return row ? mapEpisode(row) : null;
  }

  /** Counts episodes with ended_at IS NULL. */
  countActiveEpisodes(): number {
    const row = this.db.getFirst<{ c: number }>(
      `SELECT COUNT(*) AS c FROM headache_episodes WHERE ended_at IS NULL`
    );
    return row?.c ?? 0;
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

  /**
   * Completed episodes whose startedAt falls on the given local calendar day.
   * Cross-midnight episodes belong to the local date of startedAt (not end).
   */
  getCompletedEpisodesForLocalDate(localDate: string): HeadacheEpisode[] {
    validateLocalDate(localDate);

    const dayStart = parseLocalDate(localDate);
    const dayEnd = parseLocalDate(addDaysToLocalDate(localDate, 1));
    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    const rows = this.db.getAll<EpisodeRow>(
      `SELECT * FROM headache_episodes
       WHERE ended_at IS NOT NULL
         AND started_at >= ?
         AND started_at < ?
       ORDER BY started_at DESC`,
      [startIso, endIso]
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
    if (endedAt == null) {
      validateNotInFuture(startedAt, 'startedAt');
    }

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

  /**
   * Finishes an active episode by setting endedAt.
   * Rejects if already finished or endedAt < startedAt.
   */
  finishEpisode(id: string, endedAt: string = nowIsoUtc()): HeadacheEpisode {
    const existing = this.getEpisodeById(id);
    if (!existing) {
      throw new StorageError(`Episode not found: ${id}`);
    }
    if (existing.endedAt != null) {
      throw new DomainValidationError(
        'Episode is already finished',
        'endedAt'
      );
    }

    validateNotInFuture(endedAt, 'endedAt');
    return this.updateEpisode(id, { endedAt });
  }

  /** Marks an episode as ended (alias kept for Phase 1 callers/tests). */
  endEpisode(id: string, endedAt: string = nowIsoUtc()): HeadacheEpisode {
    return this.finishEpisode(id, endedAt);
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

  /**
   * Adds a pain intensity reading.
   * Skips insert when intensity equals the latest entry (unless force / different time intent).
   * Returns null when skipped as a no-op duplicate.
   */
  addIntensityEntry(
    episodeId: string,
    intensity: number,
    recordedAt: string = nowIsoUtc(),
    options: AddIntensityOptions = {}
  ): PainIntensityEntry | null {
    validateIntensity(intensity);
    validateNotInFuture(recordedAt, 'recordedAt');

    if (!this.getEpisodeById(episodeId)) {
      throw new StorageError(`Episode not found: ${episodeId}`);
    }

    const latest = this.getLatestIntensityEntry(episodeId);
    if (
      !options.force &&
      latest != null &&
      latest.intensity === intensity
    ) {
      // Same intensity as last reading — avoid meaningless duplicate rows.
      return null;
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

  /**
   * Latest intensity for an episode.
   * Deterministic order: recorded_at DESC, created_at DESC, id DESC.
   */
  getLatestIntensityEntry(episodeId: string): PainIntensityEntry | null {
    const row = this.db.getFirst<IntensityRow>(
      `SELECT * FROM pain_intensity_entries
       WHERE episode_id = ?
       ORDER BY recorded_at DESC, created_at DESC, id DESC
       LIMIT 1`,
      [episodeId]
    );
    return row ? mapIntensity(row) : null;
  }

  /** Maximum intensity recorded for an episode (for Today history cards). */
  getMaxIntensity(episodeId: string): number | null {
    const row = this.db.getFirst<{ max_intensity: number | null }>(
      `SELECT MAX(intensity) AS max_intensity
       FROM pain_intensity_entries
       WHERE episode_id = ?`,
      [episodeId]
    );
    return row?.max_intensity ?? null;
  }

  /** Lists intensity entries for an episode, oldest first (stable tie-break). */
  listIntensityEntries(episodeId: string): PainIntensityEntry[] {
    const rows = this.db.getAll<IntensityRow>(
      `SELECT * FROM pain_intensity_entries
       WHERE episode_id = ?
       ORDER BY recorded_at ASC, created_at ASC, id ASC`,
      [episodeId]
    );
    return rows.map(mapIntensity);
  }

  /** Alias matching Phase 2 naming. */
  getIntensityEntries(episodeId: string): PainIntensityEntry[] {
    return this.listIntensityEntries(episodeId);
  }

  /**
   * Full episode details aggregate for UI screens.
   * Returns null if the episode does not exist.
   */
  getEpisodeDetails(episodeId: string): EpisodeDetails | null {
    const episode = this.getEpisodeById(episodeId);
    if (!episode) {
      return null;
    }

    return {
      episode,
      intensities: this.getIntensityEntries(episodeId),
      latestIntensity: this.getLatestIntensityEntry(episodeId),
      maxIntensity: this.getMaxIntensity(episodeId),
      locations: this.listLocations(episodeId),
      painCharacters: this.listPainCharacters(episodeId),
      symptoms: this.listSymptoms(episodeId),
      factors: this.listFactors(episodeId),
    };
  }

  /** True when side or any detail tag set is non-empty. */
  hasPainDetails(episodeId: string): boolean {
    const details = this.getEpisodeDetails(episodeId);
    if (!details) return false;
    return (
      details.episode.side != null ||
      details.locations.length > 0 ||
      details.painCharacters.length > 0 ||
      details.symptoms.length > 0 ||
      details.factors.length > 0
    );
  }

  /**
   * Atomically replaces side + all detail tag sets.
   * Empty arrays clear previous values. Partial mid-failure rolls back.
   */
  replaceEpisodeDetails(
    episodeId: string,
    input: EpisodeDetailsInput
  ): EpisodeDetails {
    const existing = this.getEpisodeById(episodeId);
    if (!existing) {
      throw new StorageError(`Episode not found: ${episodeId}`);
    }

    const side = input.side !== undefined ? input.side : existing.side;
    // Undefined means "leave unchanged"; empty array means "clear".
    const locations =
      input.locations !== undefined
        ? input.locations
        : this.listLocations(episodeId).map((row) => ({
            code: row.code,
            customLabel: row.customLabel,
          }));
    const painCharacters =
      input.painCharacters !== undefined
        ? input.painCharacters
        : this.listPainCharacters(episodeId).map((row) => ({
            code: row.code,
            customLabel: row.customLabel,
          }));
    const symptoms =
      input.symptoms !== undefined
        ? input.symptoms
        : this.listSymptoms(episodeId).map((row) => ({
            code: row.code,
            customLabel: row.customLabel,
          }));
    const factors =
      input.factors !== undefined
        ? input.factors
        : this.listFactors(episodeId).map((row) => ({
            code: row.code,
            customLabel: row.customLabel,
            customFactorId: row.customFactorId,
          }));

    // Deduplicate by code (+ customFactorId for customs) before write.
    const uniqueLocations = dedupeCodeLabels(locations);
    const uniqueCharacters = dedupeCodeLabels(painCharacters);
    const uniqueSymptoms = dedupeCodeLabels(symptoms);
    const uniqueFactors = dedupeFactors(factors);

    for (const f of uniqueFactors) {
      if (f.code === 'custom' && !f.customFactorId) {
        throw new DomainValidationError(
          'Custom factor rows require customFactorId',
          'factors'
        );
      }
    }

    const updatedAt = nowIsoUtc();

    try {
      this.db.withTransaction(() => {
        this.db.run(
          `UPDATE headache_episodes SET side = ?, updated_at = ? WHERE id = ?`,
          [side, updatedAt, episodeId]
        );

        this.replaceCodeSetInner('episode_locations', episodeId, uniqueLocations);
        this.replaceCodeSetInner(
          'episode_pain_characters',
          episodeId,
          uniqueCharacters
        );
        this.replaceCodeSetInner('episode_symptoms', episodeId, uniqueSymptoms);
        this.replaceFactorsInner(episodeId, uniqueFactors);
      });
    } catch (err) {
      if (err instanceof DomainValidationError || err instanceof StorageError) {
        throw err;
      }
      throw new StorageError(
        `Failed to replace details for episode ${episodeId}`,
        err
      );
    }

    const details = this.getEpisodeDetails(episodeId);
    if (!details) {
      throw new StorageError(`Episode missing after details save: ${episodeId}`);
    }
    return details;
  }

  listLocations(episodeId: string): EpisodeLocation[] {
    return this.db
      .getAll<TagRow>(
        `SELECT * FROM episode_locations WHERE episode_id = ? ORDER BY code ASC`,
        [episodeId]
      )
      .map((row) => ({
        id: row.id,
        episodeId: row.episode_id,
        code: row.code as LocationCode,
        customLabel: row.custom_label,
      }));
  }

  listPainCharacters(episodeId: string): EpisodePainCharacter[] {
    return this.db
      .getAll<TagRow>(
        `SELECT * FROM episode_pain_characters WHERE episode_id = ? ORDER BY code ASC`,
        [episodeId]
      )
      .map((row) => ({
        id: row.id,
        episodeId: row.episode_id,
        code: row.code as PainCharacterCode,
        customLabel: row.custom_label,
      }));
  }

  listSymptoms(episodeId: string): EpisodeSymptom[] {
    return this.db
      .getAll<TagRow>(
        `SELECT * FROM episode_symptoms WHERE episode_id = ? ORDER BY code ASC`,
        [episodeId]
      )
      .map((row) => ({
        id: row.id,
        episodeId: row.episode_id,
        code: row.code as SymptomCode,
        customLabel: row.custom_label,
      }));
  }

  listFactors(episodeId: string): EpisodeFactor[] {
    return this.db
      .getAll<FactorRow>(
        `SELECT * FROM episode_factors WHERE episode_id = ? ORDER BY code ASC, id ASC`,
        [episodeId]
      )
      .map((row) => ({
        id: row.id,
        episodeId: row.episode_id,
        code: row.code as FactorCode,
        customLabel: row.custom_label,
        customFactorId: row.custom_factor_id ?? null,
      }));
  }

  /** Replaces all location tags for an episode inside a transaction. */
  setLocations(
    episodeId: string,
    items: CodeLabelInput<LocationCode>[]
  ): void {
    if (!this.getEpisodeById(episodeId)) {
      throw new StorageError(`Episode not found: ${episodeId}`);
    }
    try {
      this.db.withTransaction(() => {
        this.replaceCodeSetInner(
          'episode_locations',
          episodeId,
          dedupeCodeLabels(items)
        );
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to replace locations', err);
    }
  }

  /** Replaces all pain-character tags for an episode. */
  setPainCharacters(
    episodeId: string,
    items: CodeLabelInput<PainCharacterCode>[]
  ): void {
    if (!this.getEpisodeById(episodeId)) {
      throw new StorageError(`Episode not found: ${episodeId}`);
    }
    try {
      this.db.withTransaction(() => {
        this.replaceCodeSetInner(
          'episode_pain_characters',
          episodeId,
          dedupeCodeLabels(items)
        );
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to replace pain characters', err);
    }
  }

  /** Replaces all symptom tags for an episode. */
  setSymptoms(
    episodeId: string,
    items: CodeLabelInput<SymptomCode>[]
  ): void {
    if (!this.getEpisodeById(episodeId)) {
      throw new StorageError(`Episode not found: ${episodeId}`);
    }
    try {
      this.db.withTransaction(() => {
        this.replaceCodeSetInner(
          'episode_symptoms',
          episodeId,
          dedupeCodeLabels(items)
        );
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to replace symptoms', err);
    }
  }

  /** Replaces all factor (possible trigger) tags for an episode. */
  setFactors(
    episodeId: string,
    items: {
      code: FactorCode;
      customLabel?: string | null;
      customFactorId?: string | null;
    }[]
  ): void {
    if (!this.getEpisodeById(episodeId)) {
      throw new StorageError(`Episode not found: ${episodeId}`);
    }
    try {
      this.db.withTransaction(() => {
        this.replaceFactorsInner(episodeId, dedupeFactors(items));
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to replace factors', err);
    }
  }

  /** Delete-all-then-insert for simple code tables (caller must be in a transaction). */
  private replaceCodeSetInner(
    table:
      | 'episode_locations'
      | 'episode_pain_characters'
      | 'episode_symptoms',
    episodeId: string,
    items: CodeLabelInput<string>[]
  ): void {
    this.db.run(`DELETE FROM ${table} WHERE episode_id = ?`, [episodeId]);
    for (const item of items) {
      this.db.run(
        `INSERT INTO ${table} (id, episode_id, code, custom_label)
         VALUES (?, ?, ?, ?)`,
        [createId(), episodeId, item.code, item.customLabel ?? null]
      );
    }
  }

  /** Delete-all-then-insert for episode_factors including custom_factor_id. */
  private replaceFactorsInner(
    episodeId: string,
    items: {
      code: FactorCode;
      customLabel?: string | null;
      customFactorId?: string | null;
    }[]
  ): void {
    this.db.run(`DELETE FROM episode_factors WHERE episode_id = ?`, [episodeId]);
    for (const item of items) {
      this.db.run(
        `INSERT INTO episode_factors
          (id, episode_id, code, custom_label, custom_factor_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          createId(),
          episodeId,
          item.code,
          item.customLabel ?? null,
          item.customFactorId ?? null,
        ]
      );
    }
  }
}

type TagRow = {
  id: string;
  episode_id: string;
  code: string;
  custom_label: string | null;
};

type FactorRow = TagRow & {
  custom_factor_id: string | null;
};

function dedupeCodeLabels<T extends string>(
  items: CodeLabelInput<T>[]
): CodeLabelInput<T>[] {
  const seen = new Set<string>();
  const out: CodeLabelInput<T>[] = [];
  for (const item of items) {
    const key = `${item.code}::${item.customLabel ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeFactors(
  items: {
    code: FactorCode;
    customLabel?: string | null;
    customFactorId?: string | null;
  }[]
): {
  code: FactorCode;
  customLabel?: string | null;
  customFactorId?: string | null;
}[] {
  const seen = new Set<string>();
  const out: typeof items = [];
  for (const item of items) {
    const key =
      item.code === 'custom'
        ? `custom::${item.customFactorId ?? ''}`
        : item.code;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
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
