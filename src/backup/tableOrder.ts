/**
 * Safe delete/insert ordering for backup restore (respects FK dependencies).
 */

import type { BackupDataPayload } from './types';

/** Child tables first — used before inserting fresh backup rows. */
export const BACKUP_DELETE_ORDER: (keyof BackupDataPayload)[] = [
  'medication_intakes',
  'pain_intensity_entries',
  'episode_locations',
  'episode_pain_characters',
  'episode_symptoms',
  'episode_factors',
  'headache_episodes',
  'medications',
  'custom_factors',
  'daily_check_ins',
  'app_settings',
];

/** Parent tables first — mirrors FK dependencies on insert. */
export const BACKUP_INSERT_ORDER: (keyof BackupDataPayload)[] = [
  'headache_episodes',
  'medications',
  'custom_factors',
  'pain_intensity_entries',
  'episode_locations',
  'episode_pain_characters',
  'episode_symptoms',
  'episode_factors',
  'medication_intakes',
  'daily_check_ins',
  'app_settings',
];

/** All user-data tables (export reads each in arbitrary order). */
export const BACKUP_TABLE_NAMES: (keyof BackupDataPayload)[] = [
  ...BACKUP_INSERT_ORDER,
];

/** Exact v1 columns, used for validation and identifier-safe inserts. */
export const BACKUP_TABLE_COLUMNS: Record<
  keyof BackupDataPayload,
  readonly string[]
> = {
  headache_episodes: ['id', 'started_at', 'ended_at', 'side', 'notes', 'created_at', 'updated_at'],
  pain_intensity_entries: ['id', 'episode_id', 'recorded_at', 'intensity', 'created_at'],
  episode_locations: ['id', 'episode_id', 'code', 'custom_label'],
  episode_pain_characters: ['id', 'episode_id', 'code', 'custom_label'],
  episode_symptoms: ['id', 'episode_id', 'code', 'custom_label'],
  episode_factors: ['id', 'episode_id', 'code', 'custom_label', 'custom_factor_id'],
  custom_factors: ['id', 'name', 'normalized_name', 'is_archived', 'created_at', 'updated_at'],
  medications: ['id', 'name', 'default_dose', 'unit', 'notes', 'is_archived', 'created_at', 'updated_at'],
  medication_intakes: ['id', 'episode_id', 'medication_id', 'taken_at', 'dose', 'unit', 'effect', 'effect_rated_at', 'created_at', 'medication_name_snapshot', 'updated_at'],
  daily_check_ins: ['id', 'local_date', 'sleep_quality', 'sleep_duration_minutes', 'stress_level', 'hydration_level', 'caffeine_level', 'meal_pattern', 'physical_activity', 'notes', 'created_at', 'updated_at'],
  app_settings: ['key', 'value', 'updated_at'],
};
