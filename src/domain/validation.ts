/**
 * Domain validation helpers used by repositories before writes.
 * All validators throw DomainValidationError on failure (never return false silently).
 */

import {
  CAFFEINE_LEVELS,
  HYDRATION_LEVELS,
  MEAL_PATTERNS,
  MEDICATION_EFFECTS,
  PHYSICAL_ACTIVITY_LEVELS,
  SLEEP_QUALITIES,
  STRESS_LEVELS,
  type CaffeineLevel,
  type HydrationLevel,
  type MealPattern,
  type MedicationEffect,
  type PhysicalActivityLevel,
  type SleepQuality,
  type StressLevel,
} from './codes';
import { isValidLocalDateString } from '@/src/utils/localDate';
import { assertIsoTimestamp } from '@/src/utils/timestamps';

/** Thrown when a domain invariant fails before persistence. */
export class DomainValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'DomainValidationError';
    this.field = field;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validates pain intensity is an integer in 0–10 inclusive.
 * Floats and out-of-range values are rejected.
 */
export function validateIntensity(intensity: number): void {
  if (!Number.isInteger(intensity)) {
    throw new DomainValidationError(
      `Intensity must be an integer, received ${intensity}`,
      'intensity'
    );
  }
  if (intensity < 0 || intensity > 10) {
    throw new DomainValidationError(
      `Intensity must be between 0 and 10 inclusive, received ${intensity}`,
      'intensity'
    );
  }
}

/**
 * Validates episode start/end timestamps.
 * - startedAt must be a valid ISO-8601 timestamp
 * - endedAt, when present, must be valid ISO-8601 and not before startedAt
 */
export function validateEpisodeTimes(
  startedAt: string,
  endedAt: string | null | undefined
): void {
  try {
    assertIsoTimestamp(startedAt);
  } catch {
    throw new DomainValidationError(
      `Invalid startedAt timestamp: ${startedAt}`,
      'startedAt'
    );
  }

  if (endedAt == null) {
    return;
  }

  try {
    assertIsoTimestamp(endedAt);
  } catch {
    throw new DomainValidationError(
      `Invalid endedAt timestamp: ${endedAt}`,
      'endedAt'
    );
  }

  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (endMs < startMs) {
    throw new DomainValidationError(
      'endedAt must not be earlier than startedAt',
      'endedAt'
    );
  }
}

/**
 * Validates medication display name is non-empty after trim.
 */
export function validateMedicationName(name: string): void {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new DomainValidationError(
      'Medication name must be a non-empty string',
      'name'
    );
  }
}

/**
 * Validates a local calendar date string (YYYY-MM-DD) using localDate utilities.
 * Does not accept UTC date substrings from ISO timestamps.
 */
export function validateLocalDate(localDate: string): void {
  if (!isValidLocalDateString(localDate)) {
    throw new DomainValidationError(
      `Invalid local date (expected YYYY-MM-DD): ${localDate}`,
      'localDate'
    );
  }
}

/**
 * Validates medication effect is one of the known MedicationEffect codes.
 */
export function validateMedicationEffect(effect: string): asserts effect is MedicationEffect {
  if (!(MEDICATION_EFFECTS as readonly string[]).includes(effect)) {
    throw new DomainValidationError(
      `Invalid medication effect: ${effect}`,
      'effect'
    );
  }
}

/**
 * Allowed clock skew when accepting "now" timestamps from the UI.
 * Prevents rejecting legitimate saves due to small device clock drift.
 */
export const FUTURE_TOLERANCE_MS = 2 * 60 * 1000;

/**
 * Rejects timestamps that are meaningfully in the future.
 * Used for episode start and intensity recordedAt.
 */
export function validateNotInFuture(
  iso: string,
  field = 'timestamp',
  nowMs: number = Date.now()
): void {
  try {
    assertIsoTimestamp(iso);
  } catch {
    throw new DomainValidationError(`Invalid ${field} timestamp: ${iso}`, field);
  }

  const ms = Date.parse(iso);
  if (ms > nowMs + FUTURE_TOLERANCE_MS) {
    throw new DomainValidationError(
      `${field} must not be in the future`,
      field
    );
  }
}

function assertEnumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  field: string
): asserts value is T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new DomainValidationError(`Invalid ${field}: ${value}`, field);
  }
}

export function validateSleepQuality(value: string): asserts value is SleepQuality {
  assertEnumValue(value, SLEEP_QUALITIES, 'sleepQuality');
}

export function validateStressLevel(value: string): asserts value is StressLevel {
  assertEnumValue(value, STRESS_LEVELS, 'stressLevel');
}

export function validateHydrationLevel(
  value: string
): asserts value is HydrationLevel {
  assertEnumValue(value, HYDRATION_LEVELS, 'hydrationLevel');
}

export function validateCaffeineLevel(value: string): asserts value is CaffeineLevel {
  assertEnumValue(value, CAFFEINE_LEVELS, 'caffeineLevel');
}

export function validateMealPattern(value: string): asserts value is MealPattern {
  assertEnumValue(value, MEAL_PATTERNS, 'mealPattern');
}

export function validatePhysicalActivityLevel(
  value: string
): asserts value is PhysicalActivityLevel {
  assertEnumValue(value, PHYSICAL_ACTIVITY_LEVELS, 'physicalActivity');
}

/** Optional sleep duration in whole minutes (0–24h). */
export function validateSleepDurationMinutes(minutes: number): void {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60) {
    throw new DomainValidationError(
      'Sleep duration must be 0–1440 minutes',
      'sleepDurationMinutes'
    );
  }
}
