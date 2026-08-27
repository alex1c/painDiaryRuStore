/**
 * More / settings tab — Phase 1 placeholder.
 */

import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function MoreScreen() {
  return (
    <Screen scroll>
      <Text style={styles.title}>Ещё</Text>
      <Text style={styles.subtitle}>Настройки и сведения</Text>
      <Card style={styles.card}>
        <Text style={styles.body}>
          Тема, напоминания и экспорт данных будут здесь. Данные хранятся только
          на устройстве (локальный SQLite).
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
