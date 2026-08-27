/**
 * Repository for daily check-ins keyed by local calendar date (YYYY-MM-DD).
 */

import { StorageError } from '@/src/domain/errors';
import type { DailyCheckIn } from '@/src/domain/types';
import { validateLocalDate } from '@/src/domain/validation';
import type { SqlDatabase } from '@/src/db/types';
import { createId } from '@/src/utils/id';
import { compareLocalDates } from '@/src/utils/localDate';
import { nowIsoUtc } from '@/src/utils/timestamps';

type CheckInRow = {
  id: string;
  local_date: string;
  headache_today: number;
  sleep_quality: number | null;
  stress_level: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyCheckInInput = {
  localDate: string;
  headacheToday: boolean;
  sleepQuality?: number | null;
  stressLevel?: number | null;
  notes?: string | null;
};

export class DailyCheckInRepository {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Inserts or updates the check-in for a given localDate (UNIQUE).
   * Preserves created_at on update; refreshes updated_at.
   */
  upsert(input: DailyCheckInInput): DailyCheckIn {
    validateLocalDate(input.localDate);

    const existing = this.getByLocalDate(input.localDate);
    const now = nowIsoUtc();

    if (existing) {
      try {
        this.db.run(
          `UPDATE daily_check_ins
           SET headache_today = ?, sleep_quality = ?, stress_level = ?, notes = ?, updated_at = ?
           WHERE local_date = ?`,
          [
            input.headacheToday ? 1 : 0,
            input.sleepQuality ?? null,
            input.stressLevel ?? null,
            input.notes ?? null,
            now,
            input.localDate,
          ]
        );
      } catch (err) {
        throw new StorageError(
          `Failed to update check-in for ${input.localDate}`,
          err
        );
      }

      return {
        ...existing,
        headacheToday: input.headacheToday,
        sleepQuality: input.sleepQuality ?? null,
        stressLevel: input.stressLevel ?? null,
        notes: input.notes ?? null,
        updatedAt: now,
      };
    }

    const id = createId();
    try {
      this.db.run(
        `INSERT INTO daily_check_ins
          (id, local_date, headache_today, sleep_quality, stress_level, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.localDate,
          input.headacheToday ? 1 : 0,
          input.sleepQuality ?? null,
          input.stressLevel ?? null,
          input.notes ?? null,
          now,
          now,
        ]
      );
    } catch (err) {
      throw new StorageError(
        `Failed to insert check-in for ${input.localDate}`,
        err
      );
    }

    return {
      id,
      localDate: input.localDate,
      headacheToday: input.headacheToday,
      sleepQuality: input.sleepQuality ?? null,
      stressLevel: input.stressLevel ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  getByLocalDate(localDate: string): DailyCheckIn | null {
    validateLocalDate(localDate);
    const row = this.db.getFirst<CheckInRow>(
      'SELECT * FROM daily_check_ins WHERE local_date = ?',
      [localDate]
    );
    return row ? mapCheckIn(row) : null;
  }

  /**
   * Lists check-ins whose local_date is within [fromLocalDate, toLocalDate] inclusive.
   */
  listRange(fromLocalDate: string, toLocalDate: string): DailyCheckIn[] {
    validateLocalDate(fromLocalDate);
    validateLocalDate(toLocalDate);

    if (compareLocalDates(fromLocalDate, toLocalDate) > 0) {
      throw new StorageError(
        `listRange: from (${fromLocalDate}) is after to (${toLocalDate})`
      );
    }

    const rows = this.db.getAll<CheckInRow>(
      `SELECT * FROM daily_check_ins
       WHERE local_date >= ? AND local_date <= ?
       ORDER BY local_date ASC`,
      [fromLocalDate, toLocalDate]
    );
    return rows.map(mapCheckIn);
  }
}

function mapCheckIn(row: CheckInRow): DailyCheckIn {
  return {
    id: row.id,
    localDate: row.local_date,
    headacheToday: row.headache_today === 1,
    sleepQuality: row.sleep_quality,
    stressLevel: row.stress_level,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
