/**
 * Secondary Today card for optional daily check-in (between-episode context).
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui/Card';
import type { DailyCheckIn } from '@/src/domain/types';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { buildDailyCheckInSummaryLine } from '@/src/utils/checkInSummary';

type DailyCheckInCardProps = {
  checkIn: DailyCheckIn | null;
  onPress: () => void;
};

/**
 * Calm secondary block — never visually dominates active episode controls.
 */
export function DailyCheckInCard({ checkIn, onPress }: DailyCheckInCardProps) {
  const hasCheckIn = checkIn != null;
  const summary = checkIn ? buildDailyCheckInSummaryLine(checkIn) : null;
  const noteOnly =
    checkIn != null && !summary && checkIn.notes != null && checkIn.notes.length > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        hasCheckIn
          ? 'Изменить самочувствие за сегодня'
          : 'Отметить самочувствие за сегодня'
      }
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      <Card style={styles.card}>
        <Text style={styles.title}>Как прошёл день?</Text>
        {hasCheckIn && summary ? (
          <>
            <Text style={styles.summary}>{summary}</Text>
            <Text style={styles.action}>Изменить</Text>
          </>
        ) : hasCheckIn && noteOnly ? (
          <>
            <Text style={styles.summary} numberOfLines={2}>
              {checkIn!.notes}
            </Text>
            <Text style={styles.action}>Изменить</Text>
          </>
        ) : (
          <Text style={styles.cta}>Отметить самочувствие</Text>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  summary: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  cta: {
    ...typography.body,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  action: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
