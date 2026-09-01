/**
 * Domain entity types for the pain diary.
 * IDs are UUID strings; timestamps are ISO-8601 UTC strings;
 * calendar days use local YYYY-MM-DD (never UTC date substrings).
 */

import type {
  CaffeineLevel,
  FactorCode,
  HeadacheSide,
  HydrationLevel,
  LocationCode,
  MealPattern,
  MedicationEffect,
  PainCharacterCode,
  PhysicalActivityLevel,
  SleepQuality,
  StressLevel,
  SymptomCode,
} from './codes';

/** A continuous headache episode (may still be active when ended_at is null). */
export interface HeadacheEpisode {
  id: string;
  /** ISO-8601 UTC when the episode started. */
  startedAt: string;
  /** ISO-8601 UTC when the episode ended; null while still active. */
  endedAt: string | null;
  side: HeadacheSide | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single intensity reading (0–10) attached to an episode. */
export interface PainIntensityEntry {
  id: string;
  episodeId: string;
  /** ISO-8601 UTC when intensity was recorded. */
  recordedAt: string;
  /** Integer intensity in range 0–10 inclusive. */
  intensity: number;
  createdAt: string;
}

/** Location tag linked to an episode. */
export interface EpisodeLocation {
  id: string;
  episodeId: string;
  code: LocationCode;
  /** Free-text label when code is "other"; otherwise usually null. */
  customLabel: string | null;
}

/** Pain character tag linked to an episode. */
export interface EpisodePainCharacter {
  id: string;
  episodeId: string;
  code: PainCharacterCode;
  customLabel: string | null;
}

/** Symptom tag linked to an episode. */
export interface EpisodeSymptom {
  id: string;
  episodeId: string;
  code: SymptomCode;
  customLabel: string | null;
}

/**
 * Possible trigger / factor tag linked to an episode.
 * These are user-reported associations, not diagnosed causes.
 */
export interface EpisodeFactor {
  id: string;
  episodeId: string;
  code: FactorCode;
  customLabel: string | null;
  /** Set when code is `custom` and points at custom_factors.id. */
  customFactorId: string | null;
}

/** Reusable user-defined possible factor (archive instead of hard delete). */
export interface CustomFactor {
  id: string;
  name: string;
  /** Case-insensitive / trimmed key used to prevent obvious duplicates. */
  normalizedName: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Input for replacing episode detail tag sets. */
export type EpisodeDetailsInput = {
  side?: HeadacheSide | null;
  locations?: CodeLabelInput<LocationCode>[];
  painCharacters?: CodeLabelInput<PainCharacterCode>[];
  symptoms?: CodeLabelInput<SymptomCode>[];
  /**
   * Built-in: { code: 'stress' }
   * Custom: { code: 'custom', customFactorId, customLabel? }
   */
  factors?: {
    code: FactorCode;
    customLabel?: string | null;
    customFactorId?: string | null;
  }[];
};

/**
 * Aggregate read model for episode details screens.
 * Assembled by HeadacheRepository.getEpisodeDetails — UI must not run raw SQL.
 */
export type EpisodeDetails = {
  episode: HeadacheEpisode;
  intensities: PainIntensityEntry[];
  latestIntensity: PainIntensityEntry | null;
  maxIntensity: number | null;
  locations: EpisodeLocation[];
  painCharacters: EpisodePainCharacter[];
  symptoms: EpisodeSymptom[];
  factors: EpisodeFactor[];
};

/** User-defined medication catalog entry. */
export interface Medication {
  id: string;
  name: string;
  defaultDose: string | null;
  unit: string | null;
  notes: string | null;
  /** Soft-delete / hide from pickers without removing history. */
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A recorded medication intake, optionally linked to an episode. */
export interface MedicationIntake {
  id: string;
  /** Null when taken outside a tracked episode. */
  episodeId: string | null;
  medicationId: string;
  /** Snapshot of catalog name at intake time for stable history display. */
  medicationNameSnapshot: string;
  /** ISO-8601 UTC when the medication was taken. */
  takenAt: string;
  dose: string | null;
  unit: string | null;
  effect: MedicationEffect | null;
  /** ISO-8601 UTC when the user rated the effect. */
  effectRatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One daily wellness check-in for a local calendar day (between-episode context). */
export interface DailyCheckIn {
  id: string;
  /** Local calendar day as YYYY-MM-DD. */
  localDate: string;
  sleepQuality: SleepQuality | null;
  /** Optional sleep duration stored as whole minutes. */
  sleepDurationMinutes: number | null;
  stressLevel: StressLevel | null;
  hydrationLevel: HydrationLevel | null;
  caffeineLevel: CaffeineLevel | null;
  mealPattern: MealPattern | null;
  physicalActivity: PhysicalActivityLevel | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** App-level preferences persisted as key-value rows in app_settings. */
export interface AppSettings {
  /** Schema/settings payload version for future migrations of settings shape. */
  settingsVersion: number;
  themePreference: 'system' | 'light' | 'dark';
  onboardingCompleted: boolean;
  /** Foundation flag only — reminder delivery not implemented in Phase 1. */
  remindersEnabled: boolean;
}

/** Default AppSettings used when keys are missing from storage. */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  settingsVersion: 1,
  themePreference: 'system',
  onboardingCompleted: false,
  remindersEnabled: false,
};

/** Input payload for creating / updating an episode (subset of fields). */
export type HeadacheEpisodeInput = {
  startedAt: string;
  endedAt?: string | null;
  side?: HeadacheSide | null;
  notes?: string | null;
};

/** Input for a code+optional custom label row. */
export type CodeLabelInput<TCode extends string> = {
  code: TCode;
  customLabel?: string | null;
};
