/**
 * Finish active episode — default end time is now; optional time edit.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { DateTimeField } from '@/components/episode/DateTimeField';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { DomainValidationError } from '@/src/domain/validation';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { nowIsoUtc } from '@/src/utils/timestamps';

export default function FinishEpisodeScreen() {
  const router = useRouter();
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const { headacheRepository } = useDatabase();
  const [endedAt, setEndedAt] = useState(nowIsoUtc());
  const [showTime, setShowTime] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFinish = () => {
    if (!headacheRepository || !episodeId || saving) return;
    setSaving(true);
    try {
      headacheRepository.finishEpisode(episodeId, endedAt);
      router.back();
    } catch (err) {
      let message = 'Не удалось завершить приступ';
      if (err instanceof DomainValidationError) {
        if (err.field === 'endedAt') {
          message =
            err.message.includes('earlier') ||
            err.message.includes('not be earlier')
              ? 'Время окончания не может быть раньше начала'
              : err.message.includes('future')
                ? 'Время окончания не может быть в будущем'
                : 'Проверьте время окончания';
        }
      }
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>Завершить приступ</Text>
      <Text style={styles.subtitle}>
        По умолчанию время окончания — сейчас.
      </Text>

      <View style={styles.timeBlock}>
        {!showTime ? (
          <>
            <Text style={styles.defaultTime}>Время окончания: сейчас</Text>
            <Button
              title="Изменить время"
              variant="ghost"
              onPress={() => setShowTime(true)}
            />
          </>
        ) : (
          <DateTimeField
            label="Время окончания"
            valueIso={endedAt}
            onChangeIso={setEndedAt}
            includeDate
          />
        )}
      </View>

      <Button
        title="Завершить"
        onPress={handleFinish}
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
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  defaultTime: {
    ...typography.body,
    color: colors.text,
  },
  cta: {
    marginTop: spacing.md,
  },
});
