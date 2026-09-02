/**
 * Diary tab — recent daily check-ins with compact day-context summaries.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { DailyCheckIn } from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { buildDailyCheckInSummaryLine } from '@/src/utils/checkInSummary';
import { addDaysToLocalDate, toLocalDateString } from '@/src/utils/localDate';

function formatDiaryDayHeading(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

export default function DiaryScreen() {
  const router = useRouter();
  const { ready, dailyCheckInRepository, dataRevision } = useDatabase();
  const [checkIns, setCheckIns] = useState<DailyCheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!ready || !dailyCheckInRepository) {
      return;
    }
    const today = toLocalDateString(new Date());
    const from = addDaysToLocalDate(today, -90);
    const rows = dailyCheckInRepository.listDailyCheckIns(from, today);
    setCheckIns(rows);
    setLoading(false);
  }, [ready, dailyCheckInRepository]);

  // dataRevision retriggers reload after backup restore or delete-all.
  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional refresh token
    }, [load, dataRevision])
  );

  return (
    <Screen scroll>
      <Text style={styles.title}>Дневник</Text>
      <Text style={styles.subtitle}>История эпизодов и контекст дней</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : checkIns.length === 0 ? (
        <Card style={styles.card}>
          <Text style={styles.body}>
            Здесь появятся отметки о самочувствии за день. Их можно добавить на
            вкладке «Сегодня».
          </Text>
        </Card>
      ) : (
        checkIns.map((checkIn) => {
          const summary = buildDailyCheckInSummaryLine(checkIn);
          const contextLine =
            summary.length > 0
              ? summary
              : checkIn.notes ?? '';

          return (
            <Pressable
              key={checkIn.localDate}
              accessibilityRole="button"
              accessibilityLabel={`Самочувствие за ${checkIn.localDate}`}
              onPress={() =>
                router.push({
                  pathname: '/daily-check-in',
                  params: { date: checkIn.localDate },
                })
              }
              style={({ pressed }) => [
                styles.row,
                pressed ? styles.rowPressed : null,
              ]}
            >
              <Text style={styles.rowDate}>
                {formatDiaryDayHeading(checkIn.localDate)}
              </Text>
              {contextLine.length > 0 ? (
                <Text style={styles.rowContext} numberOfLines={2}>
                  {contextLine}
                </Text>
              ) : null}
            </Pressable>
          );
        })
      )}
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
  center: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowDate: {
    ...typography.subtitle,
    color: colors.text,
    textTransform: 'capitalize',
  },
  rowContext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
