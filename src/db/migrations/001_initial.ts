/**
 * Migration 001 — initial hybrid normalized schema (schema version 1).
 * Idempotent when applied once via user_version gating in migrate.ts.
 */

import type { Migration, SqlDatabase } from '../types';

/**
 * Creates all Phase 1 tables, foreign keys, and indexes.
 * Foreign keys must already be enabled by the opener (PRAGMA foreign_keys = ON).
 */
export const migration001Initial: Migration = {
  version: 1,
  name: '001_initial',

  up(db: SqlDatabase): void {
    // --- Core episode table ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS headache_episodes (
        id TEXT PRIMARY KEY NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        side TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // --- Intensity time series (CASCADE with episode) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS pain_intensity_entries (
        id TEXT PRIMARY KEY NOT NULL,
        episode_id TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        intensity INTEGER NOT NULL CHECK (intensity >= 0 AND intensity <= 10),
        created_at TEXT NOT NULL,
        FOREIGN KEY (episode_id) REFERENCES headache_episodes(id) ON DELETE CASCADE
      );
    `);

    // --- Episode tag tables (replace-set pattern in repositories) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS episode_locations (
        id TEXT PRIMARY KEY NOT NULL,
        episode_id TEXT NOT NULL,
        code TEXT NOT NULL,
        custom_label TEXT,
        FOREIGN KEY (episode_id) REFERENCES headache_episodes(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS episode_pain_characters (
        id TEXT PRIMARY KEY NOT NULL,
        episode_id TEXT NOT NULL,
        code TEXT NOT NULL,
        custom_label TEXT,
        FOREIGN KEY (episode_id) REFERENCES headache_episodes(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS episode_symptoms (
        id TEXT PRIMARY KEY NOT NULL,
        episode_id TEXT NOT NULL,
        code TEXT NOT NULL,
        custom_label TEXT,
        FOREIGN KEY (episode_id) REFERENCES headache_episodes(id) ON DELETE CASCADE
      );
    `);

    // Factors = possible triggers, NOT confirmed medical causes.
    db.exec(`
      CREATE TABLE IF NOT EXISTS episode_factors (
        id TEXT PRIMARY KEY NOT NULL,
        episode_id TEXT NOT NULL,
        code TEXT NOT NULL,
        custom_label TEXT,
        FOREIGN KEY (episode_id) REFERENCES headache_episodes(id) ON DELETE CASCADE
      );
    `);

    // --- Medication catalog ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS medications (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        default_dose TEXT,
        unit TEXT,
        notes TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // --- Medication intakes (episode optional; medication required / RESTRICT) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS medication_intakes (
        id TEXT PRIMARY KEY NOT NULL,
        episode_id TEXT,
        medication_id TEXT NOT NULL,
        taken_at TEXT NOT NULL,
        dose TEXT,
        unit TEXT,
        effect TEXT,
        effect_rated_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (episode_id) REFERENCES headache_episodes(id) ON DELETE SET NULL,
        FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE RESTRICT
      );
    `);

    // --- Daily check-ins keyed by local calendar date ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_check_ins (
        id TEXT PRIMARY KEY NOT NULL,
        local_date TEXT NOT NULL UNIQUE,
        headache_today INTEGER NOT NULL CHECK (headache_today IN (0, 1)),
        sleep_quality INTEGER,
        stress_level INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // --- Key-value app settings ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // --- Indexes for common query paths ---
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pain_intensity_episode_id
        ON pain_intensity_entries(episode_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_medication_intakes_episode_id
        ON medication_intakes(episode_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_medication_intakes_medication_id
        ON medication_intakes(medication_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_medication_intakes_taken_at
        ON medication_intakes(taken_at);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_daily_check_ins_local_date
        ON daily_check_ins(local_date);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_headache_episodes_started_at
        ON headache_episodes(started_at);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_headache_episodes_ended_at
        ON headache_episodes(ended_at);
    `);
  },
};
