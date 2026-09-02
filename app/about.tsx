/**
 * About screen — app name, version, purpose, and medical disclaimer.
 */

import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function AboutScreen() {
  const router = useRouter();
  const appName =
    Constants.expoConfig?.name ?? 'Дневник головной боли';
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen scroll>
      <Text style={styles.title}>О приложении</Text>

      <Card style={styles.card}>
        <Text style={styles.appName}>{appName}</Text>
        <Text style={styles.version}>Версия {version}</Text>
        <Text style={styles.body}>
          Личный дневник головной боли: отслеживание приступов, лекарств,
          самочувствия и отчёт для врача — без облака и без аккаунта.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.disclaimer}>
          Приложение предназначено для ведения личных записей и не заменяет
          консультацию врача.
        </Text>
      </Card>

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
  appName: {
    ...typography.subtitle,
    color: colors.text,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  disclaimer: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
