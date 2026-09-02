/**
 * Versioned backup payload types — snake_case keys mirror SQLite columns.
 */

import type { BACKUP_FORMAT } from './constants';

/** Raw row maps exported from / imported into SQLite tables. */
export type BackupTableRows = Record<string, unknown>;

/** User-data tables included in every backup. */
export type BackupDataPayload = {
  headache_episodes: BackupTableRows[];
  pain_intensity_entries: BackupTableRows[];
  episode_locations: BackupTableRows[];
  episode_pain_characters: BackupTableRows[];
  episode_symptoms: BackupTableRows[];
  episode_factors: BackupTableRows[];
  custom_factors: BackupTableRows[];
  medications: BackupTableRows[];
  medication_intakes: BackupTableRows[];
  daily_check_ins: BackupTableRows[];
  app_settings: BackupTableRows[];
};

/** Top-level on-disk backup envelope. */
export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
  data: BackupDataPayload;
};

/** Summary counts shown on the restore preview screen. */
export type BackupPreview = {
  episodeCount: number;
  medicationCount: number;
  checkInCount: number;
  exportedAt: string;
  appVersion: string;
  backupVersion: number;
};

/** Result of parsing + validating a backup before destructive restore. */
export type ValidatedBackup = {
  file: BackupFile;
  preview: BackupPreview;
};
