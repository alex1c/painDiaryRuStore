/**
 * Settings repository smoke test — persist and reload AppSettings.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import { DEFAULT_APP_SETTINGS } from '@/src/domain/types';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';

describe('settings', () => {
  test('getSettings returns defaults when empty', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const settings = new SettingsRepository(db);

    expect(settings.getSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  test('saveSettings persists and reloads', async () => {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const settings = new SettingsRepository(db);

    settings.saveSettings({
      settingsVersion: 1,
      themePreference: 'dark',
      onboardingCompleted: true,
      remindersEnabled: true,
    });

    expect(settings.getSettings()).toEqual({
      settingsVersion: 1,
      themePreference: 'dark',
      onboardingCompleted: true,
      remindersEnabled: true,
    });
  });
});
