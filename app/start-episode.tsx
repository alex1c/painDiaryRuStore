/**
 * Quick-start modal: pick intensity (required) and optional start time → save.
 * Designed for ~5–10 seconds from open to persist.
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { DateTimeField } from '@/components/episode/DateTimeField';
import { IntensityScale } from '@/components/episode/IntensityScale';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { DomainValidationError } from '@/src/domain/validation';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { nowIsoUtc } from '@/src/utils/timestamps';

export default function StartEpisodeScreen() {
  const router = useRouter();
  const { headacheRepository } = useDatabase();
  const [intensity, setIntensity] = useState(5);
  const [startedAt, setStartedAt] = useState(nowIsoUtc());
  const [showTime, setShowTime] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleStart = () => {
    if (!headacheRepository || saving) return;
    setSaving(true);
    try {
      headacheRepository.startEpisode({ intensity, startedAt });
      router.back();
    } catch (err) {
      const message =
        err instanceof DomainValidationError
          ? err.message === 'An active headache episode already exists'
            ? 'Уже есть активный приступ'
            : err.field === 'startedAt'
              ? 'Время начала не может быть в будущем'
              : 'Не удалось начать приступ'
          : 'Не удалось начать приступ';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>Новый приступ</Text>
      <Text style={styles.subtitle}>
        Выберите интенсивность — этого достаточно, чтобы начать.
      </Text>

      <IntensityScale value={intensity} onChange={setIntensity} />

      <View style={styles.timeBlock}>
        {!showTime ? (
          <Button
            title="Изменить время начала"
            variant="ghost"
            onPress={() => setShowTime(true)}
          />
        ) : (
          <DateTimeField
            label="Время начала"
            valueIso={startedAt}
            onChangeIso={setStartedAt}
            includeDate
          />
        )}
      </View>

      <Button
        title="Начать приступ"
        onPress={handleStart}
        disabled={saving}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  timeBlock: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  cta: {
    marginTop: spacing.md,
  },
});
