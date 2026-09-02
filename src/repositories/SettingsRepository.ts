/**
 * Key-value settings repository backed by the app_settings table.
 * Missing keys fall back to DEFAULT_APP_SETTINGS.
 */

import { StorageError } from '@/src/domain/errors';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
} from '@/src/domain/types';
import type { SqlDatabase } from '@/src/db/types';
import { nowIsoUtc } from '@/src/utils/timestamps';

type SettingsRow = {
  key: string;
  value: string;
  updated_at: string;
};

/** Persistence keys — keep stable across app versions. */
const KEYS = {
  settingsVersion: 'settingsVersion',
  themePreference: 'themePreference',
  onboardingCompleted: 'onboardingCompleted',
  remindersEnabled: 'remindersEnabled',
} as const;

export class SettingsRepository {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Loads AppSettings, merging stored key-value pairs over defaults.
   * Malformed individual values fall back to the default for that key.
   */
  getSettings(): AppSettings {
    try {
      const rows = this.db.getAll<SettingsRow>('SELECT key, value, updated_at FROM app_settings');
      const map = new Map(rows.map((r) => [r.key, r.value]));

      return {
        settingsVersion: readNumber(
          map.get(KEYS.settingsVersion),
          DEFAULT_APP_SETTINGS.settingsVersion
        ),
        themePreference: readTheme(
          map.get(KEYS.themePreference),
          DEFAULT_APP_SETTINGS.themePreference
        ),
        onboardingCompleted: readBoolean(
          map.get(KEYS.onboardingCompleted),
          DEFAULT_APP_SETTINGS.onboardingCompleted
        ),
        remindersEnabled: readBoolean(
          map.get(KEYS.remindersEnabled),
          DEFAULT_APP_SETTINGS.remindersEnabled
        ),
      };
    } catch (err) {
      throw new StorageError('Failed to load app settings', err);
    }
  }

  /**
   * Persists all AppSettings fields as individual key-value rows (upsert).
   */
  saveSettings(settings: AppSettings): void {
    try {
      this.db.withTransaction(() => {
        this.writeSettings(settings);
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to save app settings', err);
    }
  }

  /**
   * Writes settings rows without opening a transaction.
   * Use when already inside db.withTransaction (e.g. delete-all).
   */
  writeSettings(settings: AppSettings): void {
    const now = nowIsoUtc();

    this.upsert(KEYS.settingsVersion, String(settings.settingsVersion), now);
    this.upsert(KEYS.themePreference, settings.themePreference, now);
    this.upsert(
      KEYS.onboardingCompleted,
      settings.onboardingCompleted ? '1' : '0',
      now
    );
    this.upsert(
      KEYS.remindersEnabled,
      settings.remindersEnabled ? '1' : '0',
      now
    );
  }

  /** Resets stored settings to defaults inside an existing transaction. */
  writeDefaults(): void {
    this.writeSettings(DEFAULT_APP_SETTINGS);
  }

  private upsert(key: string, value: string, updatedAt: string): void {
    // SQLite UPSERT keeps a single row per key.
    this.db.run(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [key, value, updatedAt]
    );
  }
}

function readNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function readBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

function readTheme(
  raw: string | undefined,
  fallback: AppSettings['themePreference']
): AppSettings['themePreference'] {
  if (raw === 'system' || raw === 'light' || raw === 'dark') {
    return raw;
  }
  return fallback;
}
