/**
 * Lightweight bar chart using Views (no chart dependency).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FrequencyBucket } from '@/src/analytics/types';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type SimpleBarChartProps = {
  buckets: FrequencyBucket[];
  metricLabel: string;
  maxBars?: number;
};

const CHART_HEIGHT = 120;

export function SimpleBarChart({
  buckets,
  metricLabel,
  maxBars = 14,
}: SimpleBarChartProps) {
  const visible =
    buckets.length > maxBars ? buckets.slice(-maxBars) : buckets;
  const maxValue = Math.max(1, ...visible.map((b) => b.headacheDays));

  if (visible.length === 0) {
    return (
      <Text style={styles.empty}>Нет данных за выбранный период</Text>
    );
  }

  return (
    <View accessibilityLabel={`График: ${metricLabel}`}>
      <Text style={styles.metric}>{metricLabel}</Text>
      <View style={styles.chartRow}>
        {visible.map((bucket) => {
          const height = Math.max(
            4,
            Math.round((bucket.headacheDays / maxValue) * CHART_HEIGHT)
          );
          return (
            <View key={bucket.key} style={styles.barCol}>
              <Text style={styles.barValue}>
                {bucket.headacheDays > 0 ? String(bucket.headacheDays) : ''}
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height }]} />
              </View>
              <Text style={styles.barLabel} numberOfLines={2}>
                {bucket.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    minHeight: CHART_HEIGHT + 48,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  barValue: {
    ...typography.caption,
    color: colors.textSecondary,
    minHeight: 16,
    marginBottom: 2,
  },
  barTrack: {
    width: '100%',
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '80%',
    minWidth: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
  },
  barLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontSize: 10,
    lineHeight: 12,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
