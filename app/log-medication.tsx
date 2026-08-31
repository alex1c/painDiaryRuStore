/**
 * Quick medication intake modal — pick saved drug or add a new one.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DateTimeField } from '@/components/episode/DateTimeField';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { medicationDoseLabel } from '@/src/domain/labels';
import type { Medication } from '@/src/domain/types';
import { DomainValidationError } from '@/src/domain/validation';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { nowIsoUtc } from '@/src/utils/timestamps';

type Step = 'pick' | 'confirm' | 'new';

export default function LogMedicationScreen() {
  const router = useRouter();
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const { medicationRepository } = useDatabase();

  const medications = useMemo(
    () => medicationRepository?.listMedications() ?? [],
    [medicationRepository]
  );

  const [step, setStep] = useState<Step>('pick');
  const [selected, setSelected] = useState<Medication | null>(null);
  const [dose, setDose] = useState('');
  const [takenAt, setTakenAt] = useState(nowIsoUtc());
  const [showTime, setShowTime] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState('');
  const [newDose, setNewDose] = useState('');

  const resetConfirm = (medication: Medication) => {
    setSelected(medication);
    setDose(medication.defaultDose ?? '');
    setTakenAt(nowIsoUtc());
    setShowTime(false);
    setStep('confirm');
  };

  const handleSaveExisting = () => {
    if (!medicationRepository || !episodeId || !selected || saving) return;
    setSaving(true);
    try {
      medicationRepository.recordEpisodeIntake({
        episodeId,
        medicationId: selected.id,
        dose: dose.trim().length > 0 ? dose.trim() : null,
        takenAt,
      });
      router.back();
    } catch (err) {
      const message =
        err instanceof DomainValidationError
          ? 'Проверьте введённые данные'
          : 'Не удалось сохранить приём';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNew = () => {
    if (!medicationRepository || !episodeId || saving) return;
    setSaving(true);
    try {
      medicationRepository.recordEpisodeIntake({
        episodeId,
        medicationName: newName,
        defaultDose: newDose.trim().length > 0 ? newDose.trim() : null,
        dose: newDose.trim().length > 0 ? newDose.trim() : null,
        takenAt,
      });
      router.back();
    } catch (err) {
      const message =
        err instanceof DomainValidationError
          ? err.message.includes('name')
            ? 'Введите название лекарства'
            : 'Проверьте введённые данные'
          : 'Не удалось сохранить приём';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'confirm' && selected) {
    const doseLabel = medicationDoseLabel(selected.defaultDose, selected.unit);
    return (
      <Screen scroll>
        <Text style={styles.subtitle}>
          Проверьте данные и сохраните приём.
        </Text>
        <View style={styles.card}>
          <Text style={styles.medName}>{selected.name}</Text>
          {doseLabel ? (
            <Text style={styles.medMeta}>Обычно: {doseLabel}</Text>
          ) : null}
        </View>

        <Text style={styles.label}>Доза для этого приёма</Text>
        <TextInput
          accessibilityLabel="Доза для этого приёма"
          placeholder="Например: 400 мг"
          placeholderTextColor={colors.textMuted}
          value={dose}
          onChangeText={setDose}
          style={styles.input}
        />

        <View style={styles.timeBlock}>
          {!showTime ? (
            <Button
              title="Изменить время приёма"
              variant="ghost"
              onPress={() => setShowTime(true)}
            />
          ) : (
            <DateTimeField
              label="Время приёма"
              valueIso={takenAt}
              onChangeIso={setTakenAt}
              includeDate
            />
          )}
        </View>

        <Button
          title="Сохранить"
          onPress={handleSaveExisting}
          disabled={saving}
          style={styles.cta}
        />
        <Button
          title="Назад к списку"
          variant="ghost"
          onPress={() => setStep('pick')}
        />
      </Screen>
    );
  }

  if (step === 'new') {
    return (
      <Screen scroll>
        <Text style={styles.subtitle}>
          Введите название. Лекарство сохранится для следующих приёмов.
        </Text>

        <Text style={styles.label}>Название</Text>
        <TextInput
          accessibilityLabel="Название лекарства"
          placeholder="Например: Ибупрофен"
          placeholderTextColor={colors.textMuted}
          value={newName}
          onChangeText={setNewName}
          style={styles.input}
          autoFocus
        />

        <Text style={styles.label}>Доза (необязательно)</Text>
        <TextInput
          accessibilityLabel="Доза"
          placeholder="Например: 400 мг"
          placeholderTextColor={colors.textMuted}
          value={newDose}
          onChangeText={setNewDose}
          style={styles.input}
        />

        <View style={styles.timeBlock}>
          {!showTime ? (
            <Button
              title="Изменить время приёма"
              variant="ghost"
              onPress={() => setShowTime(true)}
            />
          ) : (
            <DateTimeField
              label="Время приёма"
              valueIso={takenAt}
              onChangeIso={setTakenAt}
              includeDate
            />
          )}
        </View>

        <Button
          title="Сохранить"
          onPress={handleSaveNew}
          disabled={saving || newName.trim().length === 0}
          style={styles.cta}
        />
        <Button
          title="Назад к списку"
          variant="ghost"
          onPress={() => setStep('pick')}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.subtitle}>
        Выберите сохранённое лекарство или добавьте новое.
      </Text>

      {medications.length === 0 ? (
        <Text style={styles.empty}>Сохранённых лекарств пока нет.</Text>
      ) : (
        medications.map((medication) => {
          const doseLabel = medicationDoseLabel(
            medication.defaultDose,
            medication.unit
          );
          return (
            <Pressable
              key={medication.id}
              accessibilityRole="button"
              accessibilityLabel={`${medication.name}${doseLabel ? ` ${doseLabel}` : ''}`}
              onPress={() => resetConfirm(medication)}
              style={({ pressed }) => [
                styles.pickRow,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.pickName}>{medication.name}</Text>
              {doseLabel ? (
                <Text style={styles.pickDose}>{doseLabel}</Text>
              ) : null}
            </Pressable>
          );
        })
      )}

      <Button
        title="+ Новое лекарство"
        variant="secondary"
        onPress={() => {
          setNewName('');
          setNewDose('');
          setTakenAt(nowIsoUtc());
          setShowTime(false);
          setStep('new');
        }}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  pickRow: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    justifyContent: 'center',
  },
  pickName: {
    ...typography.subtitle,
    color: colors.text,
  },
  pickDose: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  medName: {
    ...typography.subtitle,
    color: colors.text,
  },
  medMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
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
  timeBlock: {
    marginBottom: spacing.lg,
  },
  cta: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
