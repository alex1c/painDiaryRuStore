/**
 * Migration 002 — composite index for latest-intensity queries.
 * Does not alter tables; only adds an index used by ORDER BY recorded_at.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration002IntensityRecordedIndex: Migration = {
  version: 2,
  name: '002_intensity_recorded_index',

  up(db: SqlDatabase): void {
    // Speeds up getLatestIntensityEntry and timeline queries per episode.
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pain_intensity_episode_recorded
        ON pain_intensity_entries(episode_id, recorded_at);
    `);
  },
};
