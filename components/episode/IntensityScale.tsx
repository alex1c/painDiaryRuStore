/**
 * Large-touch intensity selector for 0–10 scale.
 * Uses selectable chips (not tiny radios) so values are easy to hit on 360dp.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import {
  formatIntensityScore,
  intensityBandLabel,
} from '@/src/utils/intensityLabel';

const VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type IntensityScaleProps = {
  value: number;
  onChange: (value: number) => void;
};

/**
 * Intensity control: big current score + wrap of large selectable values.
 * Selected value is conveyed by text + selected state (not color alone).
 */
export function IntensityScale({ value, onChange }: IntensityScaleProps) {
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={`Интенсивность ${formatIntensityScore(value)}, ${intensityBandLabel(value)}`}
      accessibilityValue={{ min: 0, max: 10, now: value }}
    >
      <Text style={styles.heading}>Интенсивность</Text>
      <Text
        style={styles.score}
        accessibilityRole="text"
        accessibilityLabel={`${formatIntensityScore(value)}, ${intensityBandLabel(value)}`}
      >
        {formatIntensityScore(value)}
      </Text>
      <Text style={styles.hint}>{intensityBandLabel(value)}</Text>

      <View style={styles.row}>
        {VALUES.map((n) => {
          const selected = n === value;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Интенсивность ${n} из 10${selected ? ', выбрано' : ''}`}
              onPress={() => onChange(n)}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipSelected : null,
                pressed ? styles.chipPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  selected ? styles.chipLabelSelected : null,
                ]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  score: {
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
    color: colors.primary,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipLabel: {
    ...typography.button,
    color: colors.text,
  },
  chipLabelSelected: {
    color: '#FFFFFF',
  },
});

export default IntensityScale;
