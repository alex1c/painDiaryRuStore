/**
 * Episode details / edit: start, end, notes, intensity timeline, delete.
 * Existing intensity rows are not edited in Phase 2 (add-only via change screen).
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

import { DateTimeField } from '@/components/episode/DateTimeField';
import { MedicationIntakeSection } from '@/components/medication/MedicationIntakeSection';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { EpisodeDetails, HeadacheEpisode, MedicationIntake, PainIntensityEntry } from '@/src/domain/types';
import type { MedicationEffect } from '@/src/domain/codes';
import { DomainValidationError } from '@/src/domain/validation';
import {
  LOCATION_LABELS,
  PAIN_CHARACTER_LABELS,
  SIDE_LABELS,
  SYMPTOM_LABELS,
  factorDisplayLabel,
} from '@/src/domain/labels';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { formatDurationBetween } from '@/src/utils/formatDuration';
import { formatLocalTime } from '@/src/utils/formatTime';
import { formatIntensityScore } from '@/src/utils/intensityLabel';

export default function EpisodeDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { headacheRepository, medicationRepository } = useDatabase();

  const [episode, setEpisode] = useState<HeadacheEpisode | null>(null);
  const [details, setDetails] = useState<EpisodeDetails | null>(null);
  const [entries, setEntries] = useState<PainIntensityEntry[]>([]);
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);
  const [startedAt, setStartedAt] = useState('');
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  const reload = useCallback(() => {
    if (!headacheRepository || !id) return;
    const found = headacheRepository.getEpisodeDetails(id);
    if (!found) {
      setMissing(true);
      setEpisode(null);
      setDetails(null);
      return;
    }
    setMissing(false);
    setDetails(found);
    setEpisode(found.episode);
    setStartedAt(found.episode.startedAt);
    setEndedAt(found.episode.endedAt);
    setNotes(found.episode.notes ?? '');
    setEntries(found.intensities);
    setIntakes(
      medicationRepository
        ? medicationRepository.listIntakesForEpisode(id)
        : []
    );
  }, [headacheRepository, medicationRepository, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleSave = () => {
    if (!headacheRepository || !id || saving) return;
    setSaving(true);
    try {
      headacheRepository.updateEpisode(id, {
        startedAt,
        endedAt,
        notes: notes.trim().length === 0 ? null : notes.trim(),
      });
      Alert.alert('Сохранено', 'Изменения записаны');
      reload();
    } catch (err) {
      const message =
        err instanceof DomainValidationError
          ? err.field === 'endedAt'
            ? 'Время окончания не может быть раньше начала'
            : 'Проверьте введённые данные'
          : 'Не удалось сохранить';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!headacheRepository || !id) return;
    Alert.alert(
      'Удалить приступ?',
      'Будут удалены все записи интенсивности этого приступа.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            try {
              headacheRepository.deleteEpisode(id);
              router.replace('/');
            } catch {
              Alert.alert('Ошибка', 'Не удалось удалить приступ');
            }
          },
        },
      ]
    );
  };

  if (missing) {
    return (
      <Screen>
        <Text style={styles.title}>Приступ не найден</Text>
        <Button title="Назад" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!episode) {
    return (
      <Screen>
        <Text style={styles.muted}>Загрузка…</Text>
      </Screen>
    );
  }

  const isActive = episode.endedAt == null;

  return (
    <Screen scroll>
      <Text style={styles.title}>
        {isActive ? 'Активный приступ' : 'Приступ'}
      </Text>
      <Text style={styles.meta}>
        Длительность: {formatDurationBetween(startedAt, endedAt)}
        {details?.maxIntensity != null
          ? ` · Макс. ${formatIntensityScore(details.maxIntensity)}`
          : ''}
        {details?.latestIntensity != null
          ? ` · Сейчас ${formatIntensityScore(details.latestIntensity.intensity)}`
          : ''}
      </Text>

      <Button
        title="Изменить подробности"
        variant="secondary"
        onPress={() => router.push(`/episode-details/${id}`)}
        style={styles.gap}
      />

      {details && details.episode.side ? (
        <>
          <Text style={styles.section}>Где болит</Text>
          <Text style={styles.body}>
            {[
              SIDE_LABELS[details.episode.side],
              ...details.locations.map((l) =>
                l.code === 'other' && l.customLabel
                  ? l.customLabel
                  : LOCATION_LABELS[l.code]
              ),
            ].join(' • ')}
          </Text>
        </>
      ) : details && details.locations.length > 0 ? (
        <>
          <Text style={styles.section}>Где болит</Text>
          <Text style={styles.body}>
            {details.locations
              .map((l) =>
                l.code === 'other' && l.customLabel
                  ? l.customLabel
                  : LOCATION_LABELS[l.code]
              )
              .join(' • ')}
          </Text>
        </>
      ) : null}

      {details && details.painCharacters.length > 0 ? (
        <>
          <Text style={styles.section}>Как болит</Text>
          <Text style={styles.body}>
            {details.painCharacters
              .map((c) =>
                c.code === 'other' && c.customLabel
                  ? c.customLabel
                  : PAIN_CHARACTER_LABELS[c.code]
              )
              .join(' • ')}
          </Text>
        </>
      ) : null}

      {details && details.symptoms.length > 0 ? (
        <>
          <Text style={styles.section}>Симптомы</Text>
          <Text style={styles.body}>
            {details.symptoms
              .map((s) =>
                s.code === 'other' && s.customLabel
                  ? s.customLabel
                  : SYMPTOM_LABELS[s.code]
              )
              .join(' • ')}
          </Text>
        </>
      ) : null}

      {details && details.factors.length > 0 ? (
        <>
          <Text style={styles.section}>Что могло повлиять</Text>
          <Text style={styles.body}>
            {details.factors
              .map((f) => factorDisplayLabel(f.code, f.customLabel))
              .join(' • ')}
          </Text>
        </>
      ) : null}

      <MedicationIntakeSection
        intakes={intakes}
        onRateEffect={(intakeId, effect: MedicationEffect) => {
          medicationRepository?.setIntakeEffect(intakeId, effect);
          reload();
        }}
        onDeleteIntake={(intakeId) => {
          medicationRepository?.deleteIntake(intakeId);
          reload();
        }}
        onEditIntake={(intakeId) =>
          router.push({
            pathname: '/edit-medication-intake',
            params: { intakeId },
          })
        }
      />

      {isActive ? (
        <Button
          title="Принял лекарство"
          variant="secondary"
          style={styles.gap}
          onPress={() =>
            router.push({
              pathname: '/log-medication',
              params: { episodeId: id },
            })
          }
        />
      ) : null}

      <View style={styles.block}>
        <DateTimeField
          label="Начало"
          valueIso={startedAt}
          onChangeIso={setStartedAt}
          includeDate
        />
      </View>

      {endedAt != null ? (
        <View style={styles.block}>
          <DateTimeField
            label="Окончание"
            valueIso={endedAt}
            onChangeIso={setEndedAt}
            includeDate
          />
        </View>
      ) : (
        <Text style={styles.muted}>Приступ ещё не завершён</Text>
      )}

      <Text style={styles.section}>Заметка</Text>
      <TextInput
        accessibilityLabel="Заметка к приступу"
        value={notes}
        onChangeText={setNotes}
        placeholder="Необязательно"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.notes}
        textAlignVertical="top"
      />

      <Text style={styles.section}>Интенсивность</Text>
      {entries.length === 0 ? (
        <Text style={styles.muted}>Записей пока нет</Text>
      ) : (
        <Card>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.timelineRow}>
              <Text style={styles.timelineTime}>
                {formatLocalTime(entry.recordedAt)}
              </Text>
              <Text style={styles.timelineValue}>
                {formatIntensityScore(entry.intensity)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {isActive ? (
        <Button
          title="Добавить интенсивность"
          variant="secondary"
          style={styles.gap}
          onPress={() =>
            router.push({
              pathname: '/change-intensity',
              params: { episodeId: id },
            })
          }
        />
      ) : null}

      <Button
        title="Сохранить"
        onPress={handleSave}
        disabled={saving}
        style={styles.gap}
      />
      <Button
        title="Удалить приступ"
        variant="danger"
        onPress={handleDelete}
        style={styles.gap}
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
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  block: {
    marginBottom: spacing.md,
  },
  section: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  notes: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.text,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  timelineTime: {
    ...typography.body,
    color: colors.textSecondary,
  },
  timelineValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  muted: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  gap: {
    marginTop: spacing.md,
  },
});
