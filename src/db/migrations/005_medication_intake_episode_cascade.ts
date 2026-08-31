/**
 * Migration 005 — make episode deletion remove its otherwise unreachable intakes.
 * SQLite requires rebuilding the table to change an existing FK action.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration005MedicationIntakeEpisodeCascade: Migration = {
  version: 5,
  name: '005_medication_intake_episode_cascade',

  up(db: SqlDatabase): void {
    db.exec(`
      CREATE TABLE medication_intakes_new (
        id TEXT PRIMARY KEY NOT NULL,
        episode_id TEXT,
        medication_id TEXT NOT NULL,
        taken_at TEXT NOT NULL,
        dose TEXT,
        unit TEXT,
        effect TEXT,
        effect_rated_at TEXT,
        created_at TEXT NOT NULL,
        medication_name_snapshot TEXT,
        updated_at TEXT,
        FOREIGN KEY (episode_id) REFERENCES headache_episodes(id) ON DELETE CASCADE,
        FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE RESTRICT
      );

      INSERT INTO medication_intakes_new (
        id, episode_id, medication_id, taken_at, dose, unit, effect,
        effect_rated_at, created_at, medication_name_snapshot, updated_at
      )
      SELECT
        id, episode_id, medication_id, taken_at, dose, unit, effect,
        CASE WHEN effect IS NULL THEN NULL ELSE effect_rated_at END,
        created_at, medication_name_snapshot, COALESCE(updated_at, created_at)
      FROM medication_intakes;

      DROP TABLE medication_intakes;
      ALTER TABLE medication_intakes_new RENAME TO medication_intakes;

      CREATE INDEX idx_medication_intakes_episode_id
        ON medication_intakes(episode_id);
      CREATE INDEX idx_medication_intakes_medication_id
        ON medication_intakes(medication_id);
      CREATE INDEX idx_medication_intakes_taken_at
        ON medication_intakes(taken_at);
    `);
  },
};
