/**
 * Application database opener — Expo production path and test helper.
 * Idempotent: open → enable FK → run migrations; safe to call again on same file.
 */

import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { createExpoSqliteAdapter } from './expoSqliteAdapter';
import { runMigrations } from './migrate';
import type { SqlDatabase } from './types';

/** On-device SQLite filename (lives in the app's document directory). */
export const APP_DATABASE_NAME = 'pain_diary.db';

/**
 * Opens the app database, enables foreign keys, and applies pending migrations.
 * Safe to call multiple times — migrations no-op when user_version is current.
 */
export function openAppDatabase(): SqlDatabase {
  const client = openDatabaseSync(APP_DATABASE_NAME);
  return createDatabaseFromClient(createExpoSqliteAdapter(client), client);
}

/**
 * Builds a ready SqlDatabase from an already-constructed adapter.
 * Used by tests (sql.js) and by openAppDatabase after wrapping expo-sqlite.
 *
 * @param db - SqlDatabase adapter (expo or sql.js)
 * @param _rawClient - Optional raw client kept for callers that need it; unused here
 */
export function createDatabaseFromClient(
  db: SqlDatabase,
  _rawClient?: SQLiteDatabase | unknown
): SqlDatabase {
  // Foreign keys are off by default in SQLite — must enable per connection.
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  return db;
}
