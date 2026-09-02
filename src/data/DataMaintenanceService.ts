/**
 * Atomic deletion of all local user data (schema/migrations remain intact).
 */

import type { SqlDatabase } from '@/src/db/types';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';

import { BACKUP_DELETE_ORDER } from '@/src/backup/tableOrder';

export const DELETE_ALL_ERROR =
  'Не удалось удалить все данные. Попробуйте ещё раз.';

export class DataMaintenanceService {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Clears every user-data table and resets app_settings to defaults.
   * Runs in a single transaction — partial deletion is rolled back.
   */
  deleteAllUserData(): void {
    const settings = new SettingsRepository(this.db);

    try {
      this.db.withTransaction(() => {
        for (const table of BACKUP_DELETE_ORDER) {
          this.db.run(`DELETE FROM ${table}`);
        }
        settings.writeDefaults();
      });
    } catch (err) {
      if (__DEV__) {
        console.error('[DataMaintenanceService] deleteAll failed', err);
      }
      throw new Error(DELETE_ALL_ERROR);
    }
  }
}
