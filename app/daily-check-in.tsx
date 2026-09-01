/**
 * Daily check-in editor — optional day-context fields for one local calendar day.
 */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChipSelect } from '@/components/episode/ChipSelect';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import {
  CAFFEINE_LEVELS,
  HYDRATION_LEVELS,
  MEAL_PATTERNS,
  PHYSICAL_ACTIVITY_LEVELS,
  SLEEP_QUALITIES,
  STRESS_LEVELS,
  type CaffeineLevel,
  type HydrationLevel,
  type MealPattern,
  type PhysicalActivityLevel,
  type SleepQuality,
  type StressLevel,
} from '@/src/domain/codes';
import {
  CAFFEINE_LEVEL_LABELS,
  HYDRATION_LEVEL_LABELS,
  MEAL_PATTERN_LABELS,
  PHYSICAL_ACTIVITY_LABELS,
  SLEEP_QUALITY_LABELS,
  STRESS_LEVEL_LABELS,
} from '@/src/domain/labels';
import { DomainValidationError } from '@/src/domain/validation';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { toLocalDateString } from '@/src/utils/localDate';

type FormState = {
  sleepQuality: SleepQuality | null;
  sleepHours: string;
  stressLevel: StressLevel | null;
  hydrationLevel: HydrationLevel | null;
  caffeineLevel: CaffeineLevel | null;
  mealPattern: MealPattern | null;
  physicalActivity: PhysicalActivityLevel | null;
  notes: string;
};

const EMPTY_FORM: FormState = {
  sleepQuality: null,
  sleepHours: '',
  stressLevel: null,
  hydrationLevel: null,
  caffeineLevel: null,
  mealPattern: null,
  physicalActivity: null,
  notes: '',
};

function chipOptions<T extends string>(
  values: readonly T[],
  labels: Record<T, string>
) {
  return values.map((value) => ({ value, label: labels[value] }));
}

export default function DailyCheckInScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { dailyCheckInRepository } = useDatabase();
  const localDate = date ?? toLocalDateString(new Date());

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!dailyCheckInRepository) return;
      const existing = dailyCheckInRepository.getDailyCheckIn(localDate);
      if (!existing) {
        setForm(EMPTY_FORM);
        return;
      }
      setForm({
        sleepQuality: existing.sleepQuality,
        sleepHours:
          existing.sleepDurationMinutes != null
            ? String(Math.round(existing.sleepDurationMinutes / 60))
            : '',
        stressLevel: existing.stressLevel,
        hydrationLevel: existing.hydrationLevel,
        caffeineLevel: existing.caffeineLevel,
        mealPattern: existing.mealPattern,
        physicalActivity: existing.physicalActivity,
        notes: existing.notes ?? '',
      });
    }, [dailyCheckInRepository, localDate])
  );

  const handleSave = () => {
    if (!dailyCheckInRepository || saving) return;
    setSaving(true);
    try {
      const hoursTrimmed = form.sleepHours.trim();
      let sleepDurationMinutes: number | null = null;
      if (hoursTrimmed.length > 0) {
        const hours = Number(hoursTrimmed);
        if (!Number.isInteger(hours) || hours < 0 || hours > 24) {
          Alert.alert('Ошибка', 'Укажите часы сна от 0 до 24');
          return;
        }
        sleepDurationMinutes = hours * 60;
      }

      dailyCheckInRepository.upsertDailyCheckIn({
        localDate,
        sleepQuality: form.sleepQuality,
        sleepDurationMinutes,
        stressLevel: form.stressLevel,
        hydrationLevel: form.hydrationLevel,
        caffeineLevel: form.caffeineLevel,
        mealPattern: form.mealPattern,
        physicalActivity: form.physicalActivity,
        notes: form.notes,
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
      <Text style={styles.subtitle}>
        Все поля необязательны. Можно изменить или снять выбор в любой момент.
      </Text>

      <Field label="Как спали?">
        <ChipSelect
          single
          allowDeselect
          options={chipOptions(SLEEP_QUALITIES, SLEEP_QUALITY_LABELS)}
          selected={form.sleepQuality ? [form.sleepQuality] : []}
          onChange={(next) =>
            setForm((prev) => ({
              ...prev,
              sleepQuality: next[0] ?? null,
            }))
          }
        />
      </Field>

      <Field label="Часов сна (необязательно)">
        <TextInput
          accessibilityLabel="Часов сна"
          keyboardType="number-pad"
          placeholder="Например: 7"
          placeholderTextColor={colors.textMuted}
          value={form.sleepHours}
          onChangeText={(sleepHours) =>
            setForm((prev) => ({ ...prev, sleepHours }))
          }
          style={styles.input}
        />
      </Field>

      <Field label="Уровень стресса">
        <ChipSelect
          single
          allowDeselect
          options={chipOptions(STRESS_LEVELS, STRESS_LEVEL_LABELS)}
          selected={form.stressLevel ? [form.stressLevel] : []}
          onChange={(next) =>
            setForm((prev) => ({
              ...prev,
              stressLevel: next[0] ?? null,
            }))
          }
        />
      </Field>

      <Field label="Воды сегодня">
        <ChipSelect
          single
          allowDeselect
          options={chipOptions(HYDRATION_LEVELS, HYDRATION_LEVEL_LABELS)}
          selected={form.hydrationLevel ? [form.hydrationLevel] : []}
          onChange={(next) =>
            setForm((prev) => ({
              ...prev,
              hydrationLevel: next[0] ?? null,
            }))
          }
        />
      </Field>

      <Field label="Кофеин">
        <ChipSelect
          single
          allowDeselect
          options={chipOptions(CAFFEINE_LEVELS, CAFFEINE_LEVEL_LABELS)}
          selected={form.caffeineLevel ? [form.caffeineLevel] : []}
          onChange={(next) =>
            setForm((prev) => ({
              ...prev,
              caffeineLevel: next[0] ?? null,
            }))
          }
        />
      </Field>

      <Field label="Питание">
        <ChipSelect
          single
          allowDeselect
          options={chipOptions(MEAL_PATTERNS, MEAL_PATTERN_LABELS)}
          selected={form.mealPattern ? [form.mealPattern] : []}
          onChange={(next) =>
            setForm((prev) => ({
              ...prev,
              mealPattern: next[0] ?? null,
            }))
          }
        />
      </Field>

      <Field label="Физическая нагрузка">
        <ChipSelect
          single
          allowDeselect
          options={chipOptions(
            PHYSICAL_ACTIVITY_LEVELS,
            PHYSICAL_ACTIVITY_LABELS
          )}
          selected={form.physicalActivity ? [form.physicalActivity] : []}
          onChange={(next) =>
            setForm((prev) => ({
              ...prev,
              physicalActivity: next[0] ?? null,
            }))
          }
        />
      </Field>

      <Field label="Заметка о дне">
        <TextInput
          accessibilityLabel="Заметка о дне"
          multiline
          placeholder="Например: перелёт, долгая дорога"
          placeholderTextColor={colors.textMuted}
          value={form.notes}
          onChangeText={(notes) => setForm((prev) => ({ ...prev, notes }))}
          style={[styles.input, styles.noteInput]}
        />
      </Field>

      <Button
        title="Сохранить"
        onPress={handleSave}
        disabled={saving}
        style={styles.cta}
      />
    </Screen>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
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
  },
  noteInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  cta: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
