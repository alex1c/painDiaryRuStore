/**
 * Abstract SQL database interface used by migrations and repositories.
 * Implementations: expoSqliteAdapter (device), sqlJsAdapter (tests).
 */

/** Result of a mutating statement (INSERT / UPDATE / DELETE). */
export type SqlRunResult = {
  changes: number;
  lastInsertRowId: number;
};

/**
 * Thin, sync-friendly SQLite façade.
 * All methods are synchronous to match expo-sqlite openDatabaseSync and sql.js.
 */
export interface SqlDatabase {
  /** Execute one or more SQL statements that do not return rows (DDL, PRAGMA, etc.). */
  exec(sql: string): void;

  /** Run a parameterized statement; returns change count and last insert rowid. */
  run(sql: string, params?: unknown[]): SqlRunResult;

  /** Fetch all matching rows mapped to objects. */
  getAll<T>(sql: string, params?: unknown[]): T[];

  /** Fetch the first matching row, or null if none. */
  getFirst<T>(sql: string, params?: unknown[]): T | null;

  /**
   * Run fn inside a transaction.
   * Commits on success; rolls back and rethrows on error.
   */
  withTransaction<T>(fn: () => T): T;

  /** Read PRAGMA user_version (schema migration watermark). */
  getUserVersion(): number;

  /** Write PRAGMA user_version after applying migrations. */
  setUserVersion(version: number): void;
}

/** A numbered forward-only migration. */
export interface Migration {
  version: number;
  name: string;
  up: (db: SqlDatabase) => void;
}
