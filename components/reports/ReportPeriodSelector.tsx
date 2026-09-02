/**
 * Period chips for doctor report (7 / 14 / 30 / 90 / custom).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipSelect } from '@/components/episode/ChipSelect';
import { REPORT_PERIOD_LABELS } from '@/src/reports/constants';
import type { ReportPeriodPreset } from '@/src/reports/types';
import { spacing } from '@/src/theme/tokens';

const PRESET_OPTIONS: ReportPeriodPreset[] = [
  '7d',
  '14d',
  '30d',
  '90d',
  'custom',
];

type ReportPeriodSelectorProps = {
  value: ReportPeriodPreset;
  onChange: (preset: ReportPeriodPreset) => void;
};

export function ReportPeriodSelector({
  value,
  onChange,
}: ReportPeriodSelectorProps) {
  return (
    <View style={styles.wrap}>
      <ChipSelect
        single
        allowDeselect={false}
        options={PRESET_OPTIONS.map((preset) => ({
          value: preset,
          label: REPORT_PERIOD_LABELS[preset],
        }))}
        selected={[value]}
        onChange={(next) => {
          if (next[0]) {
            onChange(next[0]);
          }
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
