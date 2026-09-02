/**
 * Export diary tables as CSV files and share via the native sheet.
 */

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { CsvExportBundle } from '@/src/export/DataExportService';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function ExportCsvScreen() {
  const { ready, db } = useDatabase();
  const router = useRouter();
  const [bundle, setBundle] = useState<CsvExportBundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastShared, setLastShared] = useState<string | null>(null);

  const handleBuild = useCallback(async () => {
    if (!ready || !db) {
      return;
    }

    setBusy(true);
    setError(null);
    setLastShared(null);

    try {
      const { DataExportService } = await import('@/src/export/DataExportService');
      const service = new DataExportService(db);
      setBundle(service.buildCsvBundle());
    } catch {
      setError('Не удалось подготовить CSV-файлы.');
    } finally {
      setBusy(false);
    }
  }, [ready, db]);

  const handleShare = useCallback(
    async (kind: keyof CsvExportBundle) => {
      if (!ready || !db || !bundle) {
        return;
      }

      setBusy(true);
      setError(null);

      try {
        const { DataExportService } = await import('@/src/export/DataExportService');
        const service = new DataExportService(db);
        const file = bundle[kind];
        await service.shareCsvFile(file.fileName, file.content);
        setLastShared(file.fileName);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Не удалось поделиться файлом.'
        );
      } finally {
        setBusy(false);
      }
    },
    [ready, db, bundle]
  );

  return (
    <Screen scroll>
      <Text style={styles.title}>Экспорт CSV</Text>
      <Card style={styles.card}>
        <Text style={styles.body}>
          Экспорт создаёт три файла: приступы, приёмы лекарств и дневные
          отметки. Разделитель — точка с запятой, кодировка UTF-8 с BOM для
          Excel.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {lastShared ? (
        <Text style={styles.success}>Открыто меню «Поделиться»: {lastShared}</Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={bundle ? 'Обновить файлы' : 'Создать файлы CSV'}
          onPress={handleBuild}
          disabled={!ready || busy}
        />

        {bundle ? (
          <>
            <Button
              title="Поделиться episodes.csv"
              variant="secondary"
              onPress={() => handleShare('episodes')}
              disabled={busy}
            />
            <Button
              title="Поделиться medication-intakes.csv"
              variant="secondary"
              onPress={() => handleShare('medicationIntakes')}
              disabled={busy}
            />
            <Button
              title="Поделиться daily-checkins.csv"
              variant="secondary"
              onPress={() => handleShare('dailyCheckIns')}
              disabled={busy}
            />
          </>
        ) : null}

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
