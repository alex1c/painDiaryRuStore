/**
 * Migration 003 — reusable custom factors + link column on episode_factors.
 * Does not alter v1/v2 migrations; additive only.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration003CustomFactors: Migration = {
  version: 3,
  name: '003_custom_factors',

  up(db: SqlDatabase): void {
    // Reusable user-defined possible triggers (archived, never hard-deleted from history).
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_factors (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_custom_factors_normalized
        ON custom_factors(normalized_name);
    `);

    // Link episode factor rows to a reusable custom factor when code = 'custom'.
    // FK is enforced at the repository layer; SQLite ADD COLUMN keeps it simple.
    db.exec(`
      ALTER TABLE episode_factors ADD COLUMN custom_factor_id TEXT;
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_episode_factors_custom_factor_id
        ON episode_factors(custom_factor_id);
    `);
  },
};
