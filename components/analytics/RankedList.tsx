/**
 * Ranked label + count list for symptoms, factors, etc.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RankedCount } from '@/src/analytics/types';
import { colors, spacing, typography } from '@/src/theme/tokens';

type RankedListProps = {
  items: RankedCount[];
  emptyText: string;
};

export function RankedList({ items, emptyText }: RankedListProps) {
  if (items.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.key} style={styles.row}>
          <Text style={styles.label} numberOfLines={2}>
            {item.label}
          </Text>
          <Text style={styles.count}>{item.episodeCount}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  count: {
    ...typography.body,
    color: colors.textSecondary,
    minWidth: 24,
    textAlign: 'right',
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
