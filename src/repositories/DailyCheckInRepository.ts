/**
 * Repository for daily check-ins keyed by local calendar date (YYYY-MM-DD).
 */

import { StorageError } from '@/src/domain/errors';
import type {
  CaffeineLevel,
  HydrationLevel,
  MealPattern,
  PhysicalActivityLevel,
  SleepQuality,
  StressLevel,
} from '@/src/domain/codes';
import type { DailyCheckIn } from '@/src/domain/types';
import {
  validateCaffeineLevel,
  validateHydrationLevel,
  validateLocalDate,
  validateMealPattern,
  validatePhysicalActivityLevel,
  validateSleepDurationMinutes,
  validateSleepQuality,
  validateStressLevel,
} from '@/src/domain/validation';
import type { SqlDatabase } from '@/src/db/types';
import { dailyCheckInHasContent } from '@/src/utils/checkInSummary';
import { createId } from '@/src/utils/id';
import { compareLocalDates } from '@/src/utils/localDate';
import { nowIsoUtc } from '@/src/utils/timestamps';

type CheckInRow = {
  id: string;
  local_date: string;
  sleep_quality: string | null;
  sleep_duration_minutes: number | null;
  stress_level: string | null;
  hydration_level: string | null;
  caffeine_level: string | null;
  meal_pattern: string | null;
  physical_activity: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Writable fields for upsert; null clears a structured field. */
export type DailyCheckInUpsert = {
  localDate: string;
  sleepQuality?: SleepQuality | null;
  sleepDurationMinutes?: number | null;
  stressLevel?: StressLevel | null;
  hydrationLevel?: HydrationLevel | null;
  caffeineLevel?: CaffeineLevel | null;
  mealPattern?: MealPattern | null;
  physicalActivity?: PhysicalActivityLevel | null;
  notes?: string | null;
};

export class DailyCheckInRepository {
  constructor(private readonly db: SqlDatabase) {}

  /** Alias for getByLocalDate — one check-in per local calendar day. */
  getDailyCheckIn(localDate: string): DailyCheckIn | null {
    return this.getByLocalDate(localDate);
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
   * Inserts or updates the check-in for a local date inside a transaction.
   * When every field is empty after merge, deletes the row instead.
   */
  upsertDailyCheckIn(input: DailyCheckInUpsert): DailyCheckIn | null {
    validateLocalDate(input.localDate);
    validateUpsertFields(input);

    const existing = this.getByLocalDate(input.localDate);
    const merged = mergeCheckIn(existing, input);

    if (!dailyCheckInHasContent(merged)) {
      if (existing) {
        this.deleteDailyCheckIn(input.localDate);
      }
      return null;
    }

    const now = nowIsoUtc();

    if (existing) {
      try {
        this.db.run(
          `UPDATE daily_check_ins
           SET sleep_quality = ?, sleep_duration_minutes = ?, stress_level = ?,
               hydration_level = ?, caffeine_level = ?, meal_pattern = ?,
               physical_activity = ?, notes = ?, updated_at = ?
           WHERE local_date = ?`,
          [
            merged.sleepQuality,
            merged.sleepDurationMinutes,
            merged.stressLevel,
            merged.hydrationLevel,
            merged.caffeineLevel,
            merged.mealPattern,
            merged.physicalActivity,
            merged.notes,
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

      return { ...merged, updatedAt: now };
    }

    const id = createId();
    try {
      this.db.run(
        `INSERT INTO daily_check_ins
          (id, local_date, sleep_quality, sleep_duration_minutes, stress_level,
           hydration_level, caffeine_level, meal_pattern, physical_activity,
           notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.localDate,
          merged.sleepQuality,
          merged.sleepDurationMinutes,
          merged.stressLevel,
          merged.hydrationLevel,
          merged.caffeineLevel,
          merged.mealPattern,
          merged.physicalActivity,
          merged.notes,
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
      ...merged,
      id,
      localDate: input.localDate,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Backwards-compatible alias. */
  upsert(input: DailyCheckInUpsert): DailyCheckIn | null {
    return this.upsertDailyCheckIn(input);
  }

  deleteDailyCheckIn(localDate: string): void {
    validateLocalDate(localDate);
    this.db.run('DELETE FROM daily_check_ins WHERE local_date = ?', [localDate]);
  }

  /**
   * Lists check-ins whose local_date is within [fromLocalDate, toLocalDate] inclusive.
   * Newest first for diary-style history.
   */
  listDailyCheckIns(fromLocalDate: string, toLocalDate: string): DailyCheckIn[] {
    return this.listRange(fromLocalDate, toLocalDate);
  }

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
       ORDER BY local_date DESC`,
      [fromLocalDate, toLocalDate]
    );
    return rows.map(mapCheckIn);
  }
}

function mergeCheckIn(
  existing: DailyCheckIn | null,
  input: DailyCheckInUpsert
): DailyCheckIn {
  const notes =
    input.notes !== undefined
      ? normalizeNote(input.notes)
      : existing?.notes ?? null;

  return {
    id: existing?.id ?? '',
    localDate: input.localDate,
    sleepQuality:
      input.sleepQuality !== undefined
        ? input.sleepQuality
        : existing?.sleepQuality ?? null,
    sleepDurationMinutes:
      input.sleepDurationMinutes !== undefined
        ? input.sleepDurationMinutes
        : existing?.sleepDurationMinutes ?? null,
    stressLevel:
      input.stressLevel !== undefined
        ? input.stressLevel
        : existing?.stressLevel ?? null,
    hydrationLevel:
      input.hydrationLevel !== undefined
        ? input.hydrationLevel
        : existing?.hydrationLevel ?? null,
    caffeineLevel:
      input.caffeineLevel !== undefined
        ? input.caffeineLevel
        : existing?.caffeineLevel ?? null,
    mealPattern:
      input.mealPattern !== undefined
        ? input.mealPattern
        : existing?.mealPattern ?? null,
    physicalActivity:
      input.physicalActivity !== undefined
        ? input.physicalActivity
        : existing?.physicalActivity ?? null,
    notes,
    createdAt: existing?.createdAt ?? '',
    updatedAt: existing?.updatedAt ?? '',
  };
}

function normalizeNote(notes: string | null | undefined): string | null {
  if (notes == null) return null;
  const trimmed = notes.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateUpsertFields(input: DailyCheckInUpsert): void {
  if (input.sleepQuality != null) validateSleepQuality(input.sleepQuality);
  if (input.stressLevel != null) validateStressLevel(input.stressLevel);
  if (input.hydrationLevel != null) validateHydrationLevel(input.hydrationLevel);
  if (input.caffeineLevel != null) validateCaffeineLevel(input.caffeineLevel);
  if (input.mealPattern != null) validateMealPattern(input.mealPattern);
  if (input.physicalActivity != null) {
    validatePhysicalActivityLevel(input.physicalActivity);
  }
  if (input.sleepDurationMinutes != null) {
    validateSleepDurationMinutes(input.sleepDurationMinutes);
  }
}

function mapCheckIn(row: CheckInRow): DailyCheckIn {
  return {
    id: row.id,
    localDate: row.local_date,
    sleepQuality: row.sleep_quality as SleepQuality | null,
    sleepDurationMinutes: row.sleep_duration_minutes,
    stressLevel: row.stress_level as StressLevel | null,
    hydrationLevel: row.hydration_level as HydrationLevel | null,
    caffeineLevel: row.caffeine_level as CaffeineLevel | null,
    mealPattern: row.meal_pattern as MealPattern | null,
    physicalActivity: row.physical_activity as PhysicalActivityLevel | null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
