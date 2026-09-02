/**
 * Create and share a local JSON backup of all diary data.
 */

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function BackupScreen() {
  const { ready, db } = useDatabase();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!ready || !db) {
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const { BackupService } = await import('@/src/backup/BackupService');
      const service = new BackupService(db);
      const result = await service.createAndShareBackup();
      setSuccess(`Файл ${result.fileName} готов к отправке.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать копию.');
    } finally {
      setBusy(false);
    }
  }, [ready, db]);

  return (
    <Screen scroll>
      <Text style={styles.title}>Резервная копия</Text>
      <Card style={styles.card}>
        <Text style={styles.body}>
          Копия содержит записи о приступах, лекарствах и дневных отметках.
          Файл сохраняется только на устройстве, пока вы сами не поделитесь им.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.actions}>
        <Button
          title={busy ? 'Создание…' : 'Создать и поделиться'}
          onPress={handleCreate}
          disabled={!ready || busy}
        />
        {busy ? <ActivityIndicator style={styles.spinner} /> : null}
        <Button
          title="Назад"
          variant="ghost"
          onPress={() => router.back()}
          disabled={busy}
        />
      </View>
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
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  spinner: {
    marginTop: spacing.sm,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  success: {
    ...typography.body,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
});
