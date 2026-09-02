/**
 * Pick a backup JSON file, preview counts, and confirm REPLACE restore.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { BackupPreview, ValidatedBackup } from '@/src/backup/types';
import { MAX_BACKUP_JSON_BYTES } from '@/src/backup/constants';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Step = 'pick' | 'preview' | 'restoring' | 'done';

export default function RestoreScreen() {
  const { ready, db, notifyDataChanged } = useDatabase();
  const router = useRouter();
  const [step, setStep] = useState<Step>('pick');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [validated, setValidated] = useState<ValidatedBackup | null>(null);

  const handlePickFile = useCallback(async () => {
    if (!ready || !db) {
      return;
    }

    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const info = await FileSystem.getInfoAsync(asset.uri);
      const fileSize = asset.size ?? (info.exists ? info.size : undefined);
      if (fileSize != null && fileSize > MAX_BACKUP_JSON_BYTES) {
        throw new Error('Файл резервной копии слишком большой.');
      }
      const text = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const { BackupService } = await import('@/src/backup/BackupService');
      const service = new BackupService(db);
      const validatedBackup = service.validateBackupText(text);

      setValidated(validatedBackup);
      setPreview(validatedBackup.preview);
      setStep('preview');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не удалось прочитать резервную копию.';
      setError(message);
      setStep('pick');
    }
  }, [ready, db]);

  const handleRestore = useCallback(async () => {
    if (!ready || !db || !validated) {
      return;
    }

    setStep('restoring');
    setError(null);

    try {
      const { BackupService } = await import('@/src/backup/BackupService');
      const service = new BackupService(db);
      service.restoreValidatedBackup(validated);
      notifyDataChanged();
      setStep('done');
      router.replace('/(tabs)');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось восстановить данные.'
      );
      setStep('preview');
    }
  }, [ready, db, validated, notifyDataChanged, router]);

  return (
    <Screen scroll>
      <Text style={styles.title}>Восстановить из копии</Text>

      {step === 'pick' ? (
        <Card style={styles.card}>
          <Text style={styles.body}>
            Выберите файл резервной копии в формате JSON. Текущие данные не
            будут изменены, пока вы не подтвердите восстановление.
          </Text>
        </Card>
      ) : null}

      {step === 'preview' && preview ? (
        <Card style={styles.card}>
          <Text style={styles.previewTitle}>Предпросмотр копии</Text>
          <Text style={styles.previewLine}>Приступов: {preview.episodeCount}</Text>
          <Text style={styles.previewLine}>
            Лекарств: {preview.medicationCount}
          </Text>
          <Text style={styles.previewLine}>
            Дневных отметок: {preview.checkInCount}
          </Text>
          <Text style={styles.previewLine}>
            Дата копии: {formatPreviewDate(preview.exportedAt)}
          </Text>
          <Text style={styles.warning}>
            Текущие данные будут заменены данными из резервной копии.
          </Text>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {step === 'pick' ? (
          <Button
            title="Выбрать файл"
            onPress={handlePickFile}
            disabled={!ready}
          />
        ) : null}

        {step === 'preview' ? (
          <>
            <Button
              title="Восстановить"
              variant="danger"
              onPress={handleRestore}
              disabled={!ready}
            />
            <Button
              title="Выбрать другой файл"
              variant="secondary"
              onPress={() => {
                setStep('pick');
                setPreview(null);
                setValidated(null);
              }}
            />
          </>
        ) : null}

        {step === 'restoring' ? (
          <ActivityIndicator style={styles.spinner} />
        ) : null}

        <Button
          title="Назад"
          variant="ghost"
          onPress={() => router.back()}
          disabled={step === 'restoring'}
        />
      </View>
    </Screen>
  );
}

function formatPreviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
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
  previewTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  previewLine: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  warning: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  spinner: {
    marginVertical: spacing.md,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
});
