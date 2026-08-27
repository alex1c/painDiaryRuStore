/**
 * Analytics tab — Phase 1 placeholder.
 */

import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function AnalyticsScreen() {
  return (
    <Screen scroll>
      <Text style={styles.title}>Аналитика</Text>
      <Text style={styles.subtitle}>Тренды и сводки</Text>
      <Card style={styles.card}>
        <Text style={styles.body}>
          Графики интенсивности, частоты и факторов появятся позже. Сейчас
          закладывается только локальное хранилище и доменные модели.
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
