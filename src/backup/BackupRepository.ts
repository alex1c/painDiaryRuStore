/**
 * Reads and atomically replaces all user-data tables for backup/restore.
 */

import { StorageError } from '@/src/domain/errors';
import type { SqlDatabase } from '@/src/db/types';

import {
  BACKUP_DELETE_ORDER,
  BACKUP_INSERT_ORDER,
  BACKUP_TABLE_NAMES,
} from './tableOrder';
import type { BackupDataPayload } from './types';

export class BackupRepository {
  constructor(private readonly db: SqlDatabase) {}

  /** Exports every user-data table as raw SQLite rows (snake_case keys). */
  exportAllTables(): BackupDataPayload {
    try {
      const data = {} as BackupDataPayload;
      for (const table of BACKUP_TABLE_NAMES) {
        data[table] = this.db.getAll(`SELECT * FROM ${table}`);
      }
      return data;
    } catch (err) {
      throw new StorageError('Failed to export database tables', err);
    }
  }

  /**
   * REPLACE restore: clears user data then inserts validated backup rows.
   * Runs inside a single transaction — rolls back on any failure.
   */
  replaceAllData(payload: BackupDataPayload): void {
    try {
      this.db.withTransaction(() => {
        for (const table of BACKUP_DELETE_ORDER) {
          this.db.run(`DELETE FROM ${table}`);
        }

        for (const table of BACKUP_INSERT_ORDER) {
          const rows = payload[table];
          for (const row of rows) {
            this.insertRow(table, row);
          }
        }
      });
    } catch (err) {
      if (err instanceof StorageError) {
        throw err;
      }
      throw new StorageError('Failed to restore backup data', err);
    }
  }

  /** Inserts one row using column names from the backup object. */
  private insertRow(table: keyof BackupDataPayload, row: Record<string, unknown>): void {
    const columns = Object.keys(row);
    if (columns.length === 0) {
      return;
    }

    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const values = columns.map((col) => normalizeSqlValue(row[col]));
    this.db.run(sql, values);
  }
}

/** Coerce JSON values into SQLite-compatible primitives. */
function normalizeSqlValue(value: unknown): string | number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return String(value);
}
