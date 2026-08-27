/**
 * Repository for reusable custom possible-factors (archive, not hard-delete).
 */

import { StorageError } from '@/src/domain/errors';
import type { CustomFactor } from '@/src/domain/types';
import { DomainValidationError } from '@/src/domain/validation';
import type { SqlDatabase } from '@/src/db/types';
import { createId } from '@/src/utils/id';
import { normalizeFactorName } from '@/src/utils/normalizeName';
import { nowIsoUtc } from '@/src/utils/timestamps';

type CustomFactorRow = {
  id: string;
  name: string;
  normalized_name: string;
  is_archived: number;
  created_at: string;
  updated_at: string;
};

export class CustomFactorRepository {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Creates or reuses a custom factor by normalized name.
   * If an archived row matches, it is un-archived and returned.
   */
  getOrCreate(name: string): CustomFactor {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (trimmed.length === 0) {
      throw new DomainValidationError(
        'Custom factor name must not be empty',
        'name'
      );
    }

    const normalized = normalizeFactorName(trimmed);
    const existing = this.db.getFirst<CustomFactorRow>(
      `SELECT * FROM custom_factors WHERE normalized_name = ?`,
      [normalized]
    );

    if (existing) {
      if (existing.is_archived === 1) {
        const updatedAt = nowIsoUtc();
        this.db.run(
          `UPDATE custom_factors
           SET is_archived = 0, name = ?, updated_at = ?
           WHERE id = ?`,
          [trimmed, updatedAt, existing.id]
        );
        return {
          ...mapCustom(existing),
          name: trimmed,
          isArchived: false,
          updatedAt,
        };
      }
      return mapCustom(existing);
    }

    const id = createId();
    const now = nowIsoUtc();
    try {
      this.db.run(
        `INSERT INTO custom_factors
          (id, name, normalized_name, is_archived, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
        [id, trimmed, normalized, now, now]
      );
    } catch (err) {
      throw new StorageError('Failed to create custom factor', err);
    }

    return {
      id,
      name: trimmed,
      normalizedName: normalized,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Active (non-archived) custom factors for pickers. */
  listActive(): CustomFactor[] {
    const rows = this.db.getAll<CustomFactorRow>(
      `SELECT * FROM custom_factors
       WHERE is_archived = 0
       ORDER BY name COLLATE NOCASE ASC`
    );
    return rows.map(mapCustom);
  }

  getById(id: string): CustomFactor | null {
    const row = this.db.getFirst<CustomFactorRow>(
      `SELECT * FROM custom_factors WHERE id = ?`,
      [id]
    );
    return row ? mapCustom(row) : null;
  }

  /**
   * Soft-archives a custom factor so it is not offered for new episodes.
   * Historical episode_factors rows keep their custom_factor_id / label.
   */
  archive(id: string): void {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError(`Custom factor not found: ${id}`);
    }
    this.db.run(
      `UPDATE custom_factors SET is_archived = 1, updated_at = ? WHERE id = ?`,
      [nowIsoUtc(), id]
    );
  }
}

function mapCustom(row: CustomFactorRow): CustomFactor {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
