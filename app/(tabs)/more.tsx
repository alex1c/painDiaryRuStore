/**
 * More / settings tab — medications catalog and static safety disclaimer.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

export default function MoreScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <Text style={styles.title}>Ещё</Text>
      <Text style={styles.subtitle}>Настройки и сведения</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Отчёт врачу"
        onPress={() => router.push('/doctor-report')}
        style={({ pressed }) => [
          styles.linkRow,
          pressed ? styles.pressed : null,
        ]}
      >
        <View>
          <Text style={styles.linkTitle}>Отчёт врачу</Text>
          <Text style={styles.linkHint}>
            PDF-сводка приступов для консультации
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Мои лекарства"
        onPress={() => router.push('/medications')}
        style={({ pressed }) => [
          styles.linkRow,
          pressed ? styles.pressed : null,
        ]}
      >
        <View>
          <Text style={styles.linkTitle}>Мои лекарства</Text>
          <Text style={styles.linkHint}>
            Сохранённые лекарства для быстрого приёма
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Card style={styles.card}>
        <Text style={styles.body}>
          Тема и напоминания появятся здесь позже. Данные хранятся только
          на устройстве (локальный SQLite).
        </Text>
      </Card>
      <Card style={styles.card}>
        <Text style={styles.body}>
          Приложение не ставит диагноз и не заменяет консультацию врача.
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
  linkRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  linkTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  linkHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  chevron: {
    ...typography.title,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.85,
  },
});
