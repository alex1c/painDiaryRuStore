/**
 * Period selector chips for analytics (7 / 30 / 90 / all).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipSelect } from '@/components/episode/ChipSelect';
import { PERIOD_LABELS } from '@/src/analytics/constants';
import type { AnalyticsPeriod } from '@/src/analytics/types';
import { spacing } from '@/src/theme/tokens';

const PERIOD_OPTIONS: AnalyticsPeriod[] = ['7d', '30d', '90d', 'all'];

type PeriodSelectorProps = {
  value: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
};

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <View style={styles.wrap}>
      <ChipSelect
        single
        allowDeselect={false}
        options={PERIOD_OPTIONS.map((p) => ({
          value: p,
          label: PERIOD_LABELS[p],
        }))}
        selected={[value]}
        onChange={(next) => {
          if (next[0]) onChange(next[0]);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
});
