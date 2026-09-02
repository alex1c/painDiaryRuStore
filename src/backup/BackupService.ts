/**
 * High-level backup create / share / restore orchestration.
 */

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { SqlDatabase } from '@/src/db/types';
import { StorageError } from '@/src/domain/errors';
import { nowIsoUtc } from '@/src/utils/timestamps';

import { BackupRepository } from './BackupRepository';
import {
  BACKUP_FORMAT,
  BACKUP_MIME_TYPE,
  SUPPORTED_BACKUP_VERSION,
} from './constants';
import type { BackupFile, ValidatedBackup } from './types';
import {
  BackupValidationError,
  parseAndValidateBackup,
} from './validateBackup';

export const BACKUP_SHARE_UNAVAILABLE =
  'Не удалось открыть меню «Поделиться».';

export const BACKUP_WRITE_ERROR =
  'Не удалось сохранить файл резервной копии.';

export const BACKUP_RESTORE_ERROR =
  'Не удалось восстановить данные из резервной копии.';

export class BackupService {
  private readonly repository: BackupRepository;

  constructor(private readonly db: SqlDatabase) {
    this.repository = new BackupRepository(db);
  }

  /** Builds the in-memory backup envelope (no file I/O). */
  createBackupPayload(): BackupFile {
    return {
      format: BACKUP_FORMAT,
      version: SUPPORTED_BACKUP_VERSION,
      exportedAt: nowIsoUtc(),
      appVersion: readAppVersion(),
      data: this.repository.exportAllTables(),
    };
  }

  /** Serializes backup to pretty JSON for export. */
  serializeBackup(file: BackupFile): string {
    return JSON.stringify(file, null, 2);
  }

  /** Writes JSON to documentDirectory and opens the native share sheet. */
  async createAndShareBackup(): Promise<{ fileName: string; fileUri: string }> {
    const payload = this.createBackupPayload();
    const json = this.serializeBackup(payload);
    const fileName = buildBackupFileName(payload.exportedAt);
    const fileUri = await writeTextToDocuments(fileName, json);
    await this.shareBackupFile(fileUri);
    return { fileName, fileUri };
  }

  /** Parses and validates backup text without touching the database. */
  validateBackupText(rawText: string): ValidatedBackup {
    return parseAndValidateBackup(rawText);
  }

  /**
   * REPLACE restore — validated backup overwrites all local user data.
   * Rolls back automatically when the repository transaction fails.
   */
  restoreValidatedBackup(validated: ValidatedBackup): void {
    try {
      this.repository.replaceAllData(validated.file.data);
    } catch (err) {
      if (err instanceof BackupValidationError) {
        throw err;
      }
      if (err instanceof StorageError) {
        throw new Error(BACKUP_RESTORE_ERROR);
      }
      throw new Error(BACKUP_RESTORE_ERROR);
    }
  }

  /** Opens native share for an existing backup JSON file. */
  async shareBackupFile(fileUri: string): Promise<void> {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw new Error(BACKUP_SHARE_UNAVAILABLE);
    }

    try {
      await Sharing.shareAsync(fileUri, {
        mimeType: BACKUP_MIME_TYPE,
        UTI: 'public.json',
        dialogTitle: 'Поделиться резервной копией',
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[BackupService] shareAsync failed', error);
      }
      throw new Error(BACKUP_SHARE_UNAVAILABLE);
    }
  }
}

/** Builds `pain-diary-backup-YYYY-MM-DD.json` from an ISO export timestamp. */
export function buildBackupFileName(exportedAtIso: string): string {
  const date = exportedAtIso.slice(0, 10);
  return `pain-diary-backup-${date}.json`;
}

function readAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

async function writeTextToDocuments(
  fileName: string,
  contents: string
): Promise<string> {
  const documentDir = FileSystem.documentDirectory;
  if (!documentDir) {
    throw new Error(BACKUP_WRITE_ERROR);
  }

  const destUri = `${documentDir}${fileName}`;
  try {
    const existing = await FileSystem.getInfoAsync(destUri);
    if (existing.exists) {
      await FileSystem.deleteAsync(destUri, { idempotent: true });
    }
    await FileSystem.writeAsStringAsync(destUri, contents, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return destUri;
  } catch (error) {
    if (__DEV__) {
      console.error('[BackupService] write failed', error);
    }
    throw new Error(BACKUP_WRITE_ERROR);
  }
}
