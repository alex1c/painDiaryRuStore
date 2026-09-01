/**
 * Compact subjective effect rating chips for a medication intake.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MedicationEffect } from '@/src/domain/codes';
import { UI_MEDICATION_EFFECTS } from '@/src/domain/codes';
import {
  MEDICATION_EFFECT_LABELS,
  MEDICATION_EFFECT_UNRATED_LABEL,
  medicationEffectLabel,
} from '@/src/domain/labels';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type EffectRatingRowProps = {
  effect: MedicationEffect | null;
  onSelect: (effect: MedicationEffect) => void;
  /** When set, shows a chip to clear the rating back to unrated. */
  onClear?: () => void;
  compact?: boolean;
};

/**
 * Shows current effect state and tappable chips for rating.
 */
export function EffectRatingRow({
  effect,
  onSelect,
  onClear,
  compact = false,
}: EffectRatingRowProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>
        Помогло?{' '}
        <Text style={styles.current}>{medicationEffectLabel(effect)}</Text>
      </Text>
      <View style={styles.row}>
        {UI_MEDICATION_EFFECTS.map((code) => {
          const selected = effect === code;
          return (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityLabel={MEDICATION_EFFECT_LABELS[code]}
              accessibilityState={{ selected }}
              onPress={() => onSelect(code)}
              style={({ pressed }) => [
                styles.chip,
                compact ? styles.chipCompact : null,
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
                {MEDICATION_EFFECT_LABELS[code]}
              </Text>
            </Pressable>
          );
        })}
        {onClear && effect != null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={MEDICATION_EFFECT_UNRATED_LABEL}
            onPress={onClear}
            style={({ pressed }) => [
              styles.chip,
              compact ? styles.chipCompact : null,
              pressed ? styles.chipPressed : null,
            ]}
          >
            <Text style={styles.chipLabel}>
              {MEDICATION_EFFECT_UNRATED_LABEL}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {effect == null && onClear == null ? (
        <Text style={styles.hint}>{MEDICATION_EFFECT_UNRATED_LABEL}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  prompt: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  current: {
    color: colors.text,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipCompact: {
    minHeight: 40,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.text,
  },
  chipLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
