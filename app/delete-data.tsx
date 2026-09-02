/**
 * Destructive delete-all flow with explicit confirmation steps.
 */

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { DELETE_ALL_ERROR } from '@/src/data/DataMaintenanceService';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function DeleteDataScreen() {
  const { ready, db, notifyDataChanged } = useDatabase();
  const router = useRouter();
  const [confirmedOnce, setConfirmedOnce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDelete = useCallback(async () => {
    if (!ready || !db) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { DataMaintenanceService } = await import(
        '@/src/data/DataMaintenanceService'
      );
      const service = new DataMaintenanceService(db);
      service.deleteAllUserData();
      notifyDataChanged();
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : DELETE_ALL_ERROR);
    } finally {
      setBusy(false);
    }
  }, [ready, db, notifyDataChanged, router]);

  const handleFirstConfirm = useCallback(() => {
    Alert.alert(
      'Удалить все данные?',
      'Будут удалены все приступы, лекарства, приёмы и дневные отметки. Настройки вернутся к значениям по умолчанию.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Продолжить',
          style: 'destructive',
          onPress: () => setConfirmedOnce(true),
        },
      ]
    );
  }, []);

  const handleFinalConfirm = useCallback(() => {
    Alert.alert(
      'Подтвердите удаление',
      'Это действие нельзя отменить. Убедитесь, что у вас есть резервная копия.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить всё',
          style: 'destructive',
          onPress: () => {
            void runDelete();
          },
        },
      ]
    );
  }, [runDelete]);

  return (
    <Screen scroll>
      <Text style={styles.title}>Удалить все данные</Text>

      <Card style={styles.card}>
        <Text style={styles.body}>
          Будут безвозвратно удалены все записи дневника на этом устройстве.
          Схема базы данных сохранится — можно начать вести дневник заново или
          восстановить данные из резервной копии.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {!confirmedOnce ? (
          <Button
            title="Удалить все данные"
            variant="danger"
            onPress={handleFirstConfirm}
            disabled={!ready || busy}
          />
        ) : (
          <Button
            title="Подтвердить удаление"
            variant="danger"
            onPress={handleFinalConfirm}
            disabled={!ready || busy}
          />
        )}
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
    color: colors.danger,
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
  error: {
    ...typography.body,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
});
