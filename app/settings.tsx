/**
 * Minimal app settings — only preferences backed by existing storage.
 */

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function SettingsScreen() {
  const { ready, settingsRepository } = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const settings =
    ready && settingsRepository
      ? settingsRepository.getSettings()
      : null;

  const handleToggleReminders = useCallback(
    (value: boolean) => {
      if (!settingsRepository || !settings) {
        return;
      }

      try {
        settingsRepository.saveSettings({
          ...settings,
          remindersEnabled: value,
        });
        setRefreshKey((key) => key + 1);
        setError(null);
      } catch {
        setError('Не удалось сохранить настройку.');
      }
    },
    [settingsRepository, settings]
  );

  return (
    <Screen scroll>
      <Text style={styles.title}>Настройки</Text>

      <Card style={styles.card} key={refreshKey}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Напоминания</Text>
            <Text style={styles.rowHint}>
              Флаг для будущих напоминаний (доставка пока не включена)
            </Text>
          </View>
          <Switch
            accessibilityLabel="Напоминания"
            value={settings?.remindersEnabled ?? false}
            onValueChange={handleToggleReminders}
            disabled={!ready || !settings}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.body}>
          Период аналитики по умолчанию — 30 дней (задаётся на экране
          «Аналитика»).
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Назад" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  rowHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
});
