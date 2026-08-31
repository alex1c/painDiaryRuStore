/**
 * Episode medication intake list with optional effect rating actions.
 */

import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { EffectRatingRow } from '@/components/medication/EffectRatingRow';
import type { MedicationEffect } from '@/src/domain/codes';
import {
  medicationDoseLabel,
  medicationEffectLabel,
} from '@/src/domain/labels';
import type { MedicationIntake } from '@/src/domain/types';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { formatLocalTime } from '@/src/utils/formatTime';

type MedicationIntakeSectionProps = {
  intakes: MedicationIntake[];
  onRateEffect?: (intakeId: string, effect: MedicationEffect) => void;
  onDeleteIntake?: (intakeId: string) => void;
  onEditIntake?: (intakeId: string) => void;
  compact?: boolean;
  showRating?: boolean;
};

/**
 * Renders medication intakes for an episode with dose/time and effect chips.
 */
export function MedicationIntakeSection({
  intakes,
  onRateEffect,
  onDeleteIntake,
  onEditIntake,
  compact = false,
  showRating = true,
}: MedicationIntakeSectionProps) {
  if (intakes.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Лекарства</Text>
      {intakes.map((intake) => {
        const dose = medicationDoseLabel(intake.dose, intake.unit);
        const line = dose
          ? `${intake.medicationNameSnapshot} · ${dose}`
          : intake.medicationNameSnapshot;

        return (
          <View
            key={intake.id}
            style={[styles.card, compact ? styles.cardCompact : null]}
          >
            <View style={styles.headerRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Изменить приём ${intake.medicationNameSnapshot}`}
                disabled={!onEditIntake}
                onPress={
                  onEditIntake ? () => onEditIntake(intake.id) : undefined
                }
                style={styles.main}
              >
                <Text style={styles.line}>{line}</Text>
                <Text style={styles.time}>{formatLocalTime(intake.takenAt)}</Text>
              </Pressable>
              {onDeleteIntake ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Удалить приём"
                  onPress={() => {
                    Alert.alert(
                      'Удалить приём?',
                      'Запись о приёме лекарства будет удалена.',
                      [
                        { text: 'Отмена', style: 'cancel' },
                        {
                          text: 'Удалить',
                          style: 'destructive',
                          onPress: () => onDeleteIntake(intake.id),
                        },
                      ]
                    );
                  }}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.deleteLabel}>Удалить</Text>
                </Pressable>
              ) : null}
            </View>

            {showRating && onRateEffect ? (
              <EffectRatingRow
                effect={intake.effect}
                onSelect={(effect) => onRateEffect(intake.id, effect)}
                compact={compact}
              />
            ) : (
              <Text style={styles.effectReadonly}>
                {medicationEffectLabel(intake.effect)}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardCompact: {
    padding: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  main: {
    flex: 1,
    gap: spacing.xs,
  },
  line: {
    ...typography.body,
    color: colors.text,
  },
  time: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  effectReadonly: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  deleteBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  deleteLabel: {
    ...typography.caption,
    color: colors.danger,
  },
  pressed: {
    opacity: 0.85,
  },
});
