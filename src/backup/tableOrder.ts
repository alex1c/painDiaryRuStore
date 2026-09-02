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
