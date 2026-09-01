/**
 * Migration 006 — expand daily_check_ins for Phase 5 day-context fields.
 * Rebuilds the table: drops legacy headache_today + integer scales, adds enum TEXT columns.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration006DailyCheckInPhase5: Migration = {
  version: 6,
  name: '006_daily_checkin_phase5',

  up(db: SqlDatabase): void {
    db.exec(`
      CREATE TABLE daily_check_ins_new (
        id TEXT PRIMARY KEY NOT NULL,
        local_date TEXT NOT NULL UNIQUE,
        sleep_quality TEXT CHECK (
          sleep_quality IS NULL OR sleep_quality IN ('bad', 'medium', 'good')
        ),
        sleep_duration_minutes INTEGER,
        stress_level TEXT CHECK (
          stress_level IS NULL OR stress_level IN ('low', 'medium', 'high')
        ),
        hydration_level TEXT CHECK (
          hydration_level IS NULL OR hydration_level IN ('low', 'normal', 'high')
        ),
        caffeine_level TEXT CHECK (
          caffeine_level IS NULL OR caffeine_level IN ('none', 'normal', 'more_than_usual')
        ),
        meal_pattern TEXT CHECK (
          meal_pattern IS NULL OR meal_pattern IN ('normal', 'skipped_meals')
        ),
        physical_activity TEXT CHECK (
          physical_activity IS NULL OR physical_activity IN ('light', 'normal', 'high')
        ),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO daily_check_ins_new (
        id, local_date, sleep_quality, sleep_duration_minutes, stress_level,
        hydration_level, caffeine_level, meal_pattern, physical_activity,
        notes, created_at, updated_at
      )
      SELECT
        id,
        local_date,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        notes,
        created_at,
        updated_at
      FROM daily_check_ins;

      DROP TABLE daily_check_ins;
      ALTER TABLE daily_check_ins_new RENAME TO daily_check_ins;

      CREATE INDEX idx_daily_check_ins_local_date
        ON daily_check_ins(local_date);
    `);
  },
};
