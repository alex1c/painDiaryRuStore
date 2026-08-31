/**
 * Edit an existing medication intake (dose, time, effect).
 */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';

import { DateTimeField } from '@/components/episode/DateTimeField';
import { EffectRatingRow } from '@/components/medication/EffectRatingRow';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import type { MedicationEffect } from '@/src/domain/codes';
import { DomainValidationError } from '@/src/domain/validation';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

export default function EditMedicationIntakeScreen() {
  const router = useRouter();
  const { intakeId } = useLocalSearchParams<{ intakeId: string }>();
  const { medicationRepository } = useDatabase();

  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [takenAt, setTakenAt] = useState('');
  const [effect, setEffect] = useState<MedicationEffect | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!medicationRepository || !intakeId) return;
      const intake = medicationRepository.getIntakeById(intakeId);
      if (!intake) {
        Alert.alert('Ошибка', 'Запись не найдена', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      setName(intake.medicationNameSnapshot);
      setDose(intake.dose ?? '');
      setTakenAt(intake.takenAt);
      setEffect(intake.effect);
    }, [medicationRepository, intakeId, router])
  );

  const handleSave = () => {
    if (!medicationRepository || !intakeId || saving) return;
    setSaving(true);
    try {
      medicationRepository.updateIntake(intakeId, {
        dose: dose.trim().length > 0 ? dose.trim() : null,
        takenAt,
        effect,
      });
      router.back();
    } catch (err) {
      const message =
        err instanceof DomainValidationError
          ? 'Проверьте введённые данные'
          : 'Не удалось сохранить';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.label}>Лекарство</Text>
      <Text style={styles.readonly}>{name}</Text>

      <Text style={styles.label}>Доза</Text>
      <TextInput
        accessibilityLabel="Доза"
        placeholder="Например: 400 мг"
        placeholderTextColor={colors.textMuted}
        value={dose}
        onChangeText={setDose}
        style={styles.input}
      />

      <DateTimeField
        label="Время приёма"
        valueIso={takenAt}
        onChangeIso={setTakenAt}
        includeDate
      />

      <EffectRatingRow
        effect={effect}
        onSelect={(value) => setEffect(value)}
      />

      <Button
        title="Сохранить"
        onPress={handleSave}
        disabled={saving}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  readonly: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  cta: {
    marginTop: spacing.lg,
  },
});
