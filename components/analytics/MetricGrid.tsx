/**
 * Compact metric tile for overview rows.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme/tokens';

type MetricTileProps = {
  label: string;
  value: string;
};

export function MetricTile({ label, value }: MetricTileProps) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

type MetricGridProps = {
  items: MetricTileProps[];
};

export function MetricGrid({ items }: MetricGridProps) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <MetricTile key={item.label} {...item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '47%',
    minWidth: 140,
    flexGrow: 1,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.subtitle,
    color: colors.text,
  },
});
