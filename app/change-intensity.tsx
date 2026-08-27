/**
 * Add a new intensity reading for an active (or any) episode.
 * Same value as latest → no new row (unless user changed time).
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { DateTimeField } from '@/components/episode/DateTimeField';
import { IntensityScale } from '@/components/episode/IntensityScale';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { DomainValidationError } from '@/src/domain/validation';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { formatIntensityScore } from '@/src/utils/intensityLabel';
import { nowIsoUtc } from '@/src/utils/timestamps';

export default function ChangeIntensityScreen() {
  const router = useRouter();
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const { headacheRepository } = useDatabase();

  const latest = useMemo(() => {
    if (!headacheRepository || !episodeId) return null;
    return headacheRepository.getLatestIntensityEntry(episodeId);
  }, [headacheRepository, episodeId]);

  const [intensity, setIntensity] = useState(latest?.intensity ?? 5);
  const [recordedAt, setRecordedAt] = useState(nowIsoUtc());
  const [showTime, setShowTime] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!headacheRepository || !episodeId || saving) return;
    setSaving(true);
    try {
      const timeChanged =
        showTime && latest != null && recordedAt !== latest.recordedAt;
      const result = headacheRepository.addIntensityEntry(
        episodeId,
        intensity,
        recordedAt,
        { force: timeChanged }
      );

      if (result == null) {
        Alert.alert('Без изменений', 'Интенсивность уже равна текущей');
      }
      router.back();
    } catch (err) {
      const message =
        err instanceof DomainValidationError
          ? 'Проверьте значение и время'
          : 'Не удалось сохранить';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>Изменить интенсивность</Text>
      <Text style={styles.current}>
        Сейчас{' '}
        {latest == null ? '—' : formatIntensityScore(latest.intensity)}
      </Text>

      <IntensityScale value={intensity} onChange={setIntensity} />

      <View style={styles.timeBlock}>
        {!showTime ? (
          <Button
            title="Изменить время записи"
            variant="ghost"
            onPress={() => setShowTime(true)}
          />
        ) : (
          <DateTimeField
            label="Время записи"
            valueIso={recordedAt}
            onChangeIso={setRecordedAt}
            includeDate
          />
        )}
      </View>

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
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  current: {
    ...typography.subtitle,
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
