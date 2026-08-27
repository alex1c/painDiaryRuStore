/**
 * Diary tab — Phase 1 placeholder (episode list UI comes later).
 */

import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function DiaryScreen() {
  return (
    <Screen scroll>
      <Text style={styles.title}>Дневник</Text>
      <Text style={styles.subtitle}>История эпизодов головной боли</Text>
      <Card style={styles.card}>
        <Text style={styles.body}>
          Список записей и детали эпизодов будут добавлены в следующих фазах.
          Локальная база уже готова к сохранению данных.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
