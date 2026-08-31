/**
 * Add or edit a saved medication catalog entry.
 */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { DomainValidationError } from '@/src/domain/validation';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

export default function MedicationFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { medicationRepository } = useDatabase();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [defaultDose, setDefaultDose] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!medicationRepository || !id) return;
      const existing = medicationRepository.getMedicationById(id);
      if (!existing) {
        Alert.alert('Ошибка', 'Лекарство не найдено', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      setName(existing.name);
      setDefaultDose(existing.defaultDose ?? '');
    }, [medicationRepository, id, router])
  );

  const handleSave = () => {
    if (!medicationRepository || saving) return;
    setSaving(true);
    try {
      const dose =
        defaultDose.trim().length > 0 ? defaultDose.trim() : null;
      if (isEdit && id) {
        medicationRepository.updateMedication(id, {
          name,
          defaultDose: dose,
        });
      } else {
        medicationRepository.createMedication({
          name,
          defaultDose: dose,
        });
      }
      router.back();
    } catch (err) {
      const message =
        err instanceof DomainValidationError
          ? 'Введите короткое название лекарства'
          : 'Не удалось сохранить';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = () => {
    if (!medicationRepository || !id) return;
    Alert.alert(
      'Убрать в архив?',
      'Лекарство скроется из быстрого выбора, но останется в истории приёмов.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'В архив',
          onPress: () => {
            medicationRepository.archiveMedication(id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <Screen scroll>
      <Text style={styles.label}>Название</Text>
      <TextInput
        accessibilityLabel="Название лекарства"
        placeholder="Например: Ибупрофен"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <Text style={styles.label}>Количество / доза (необязательно)</Text>
      <TextInput
        accessibilityLabel="Доза по умолчанию"
        placeholder="Например: 400 мг"
        placeholderTextColor={colors.textMuted}
        value={defaultDose}
        onChangeText={setDefaultDose}
        style={styles.input}
      />

      <Button
        title="Сохранить"
        onPress={handleSave}
        disabled={saving || name.trim().length === 0}
        style={styles.cta}
      />

      {isEdit ? (
        <Button
          title="Убрать в архив"
          variant="ghost"
          onPress={handleArchive}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
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
    marginTop: spacing.sm,
  },
});
