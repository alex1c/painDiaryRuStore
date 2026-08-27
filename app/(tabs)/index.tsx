/**
 * Today tab — Phase 1 placeholder showing the app name.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function TodayScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.brand}>Дневник головной боли</Text>
        <Text style={styles.subtitle}>Сегодня</Text>
        <Card style={styles.card}>
          <Text style={styles.placeholder}>
            Здесь появится быстрый обзор дня и активный эпизод. Phase 1 —
            фундамент данных.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.md,
  },
  brand: {
    ...typography.title,
    color: colors.primary,
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.textSecondary,
  },
  card: {
    marginTop: spacing.sm,
  },
  placeholder: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
