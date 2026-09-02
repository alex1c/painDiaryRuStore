/**
 * Today tab — quick start CTA or active episode card + completed history.
 * SQLite is the source of truth; state reloads on focus / app resume.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DailyCheckInCard } from '@/components/checkin/DailyCheckInCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MedicationIntakeSection } from '@/components/medication/MedicationIntakeSection';
import { Screen } from '@/components/ui/Screen';
import type { DailyCheckIn, HeadacheEpisode, MedicationIntake } from '@/src/domain/types';
import type { MedicationEffect } from '@/src/domain/codes';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { formatDurationBetween } from '@/src/utils/formatDuration';
import {
  formatLocalDateHeading,
  formatLocalTime,
  formatLocalTimeRange,
} from '@/src/utils/formatTime';
import { formatIntensityScore } from '@/src/utils/intensityLabel';
import { toLocalDateString } from '@/src/utils/localDate';
import { buildCompactCardSummary, buildDetailsSummaryLines } from '@/src/utils/detailsSummary';
import { getTodayHistorySectionMode } from '@/src/utils/todayHistorySection';

type TodayRow = {
  episode: HeadacheEpisode;
  maxIntensity: number | null;
  detailSummary: string | null;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      active: HeadacheEpisode | null;
      latestIntensity: number | null;
      hasDetails: boolean;
      summaryLines: string[];
      intakes: MedicationIntake[];
      completed: TodayRow[];
      todayCheckIn: DailyCheckIn | null;
      tick: number;
    };

export default function TodayScreen() {
  const router = useRouter();
  const { ready, error: dbError, headacheRepository, medicationRepository, dailyCheckInRepository, dataRevision } =
    useDatabase();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    if (!ready || !headacheRepository) {
      return;
    }

    try {
      const active = headacheRepository.getActiveEpisode();
      const latest =
        active != null
          ? headacheRepository.getLatestIntensityEntry(active.id)
          : null;
      const details =
        active != null
          ? headacheRepository.getEpisodeDetails(active.id)
          : null;
      const intakes =
        active != null && medicationRepository
          ? medicationRepository.listIntakesForEpisode(active.id)
          : [];
      const localDate = toLocalDateString(new Date());
      const todayCheckIn =
        dailyCheckInRepository?.getDailyCheckIn(localDate) ?? null;
      const completedEpisodes =
        headacheRepository.getCompletedEpisodesForLocalDate(localDate);
      const completed: TodayRow[] = completedEpisodes.map((episode) => {
        const details = headacheRepository.getEpisodeDetails(episode.id);
        return {
          episode,
          maxIntensity: headacheRepository.getMaxIntensity(episode.id),
          detailSummary: details
            ? buildCompactCardSummary(details)
            : null,
        };
      });

      setState({
        status: 'ready',
        active,
        latestIntensity: latest?.intensity ?? null,
        hasDetails:
          active != null && headacheRepository.hasPainDetails(active.id),
        summaryLines: details ? buildDetailsSummaryLines(details) : [],
        intakes,
        completed,
        todayCheckIn,
        tick: Date.now(),
      });
    } catch {
      setState({
        status: 'error',
        message: 'Не удалось загрузить данные',
      });
    }
  }, [ready, headacheRepository, medicationRepository, dailyCheckInRepository]);

  // dataRevision retriggers reload after backup restore or delete-all.
  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional refresh token
    }, [load, dataRevision])
  );

  // Revalidate when returning from background; refresh duration ~ once per minute.
  useEffect(() => {
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        load();
      }
    });
    const interval = setInterval(() => {
      setState((prev) =>
        prev.status === 'ready' ? { ...prev, tick: Date.now() } : prev
      );
    }, 60_000);

    return () => {
      appSub.remove();
      clearInterval(interval);
    };
  }, [load]);

  if (!ready && !dbError) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (dbError || state.status === 'error') {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Не удалось загрузить данные</Text>
          <Button title="Повторить" onPress={load} style={styles.retry} />
        </View>
      </Screen>
    );
  }

  if (state.status === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  const { active, latestIntensity, hasDetails, summaryLines, intakes, completed, todayCheckIn, tick } =
    state;
  const historySectionMode = getTodayHistorySectionMode(
    active != null,
    completed.length
  );

  return (
    <Screen scroll>
      <Text style={styles.title}>Сегодня</Text>
      <Text style={styles.date}>{formatLocalDateHeading(new Date())}</Text>

      {active == null ? (
        <Button
          title="+ Началась головная боль"
          onPress={() => router.push('/start-episode')}
          style={styles.cta}
          accessibilityLabel="Началась головная боль"
        />
      ) : (
        <Card style={styles.activeCard}>
          <Text style={styles.activeTitle}>Головная боль сейчас</Text>
          <Text style={styles.activeLine}>
            Началась в {formatLocalTime(active.startedAt)}
          </Text>
          <Text style={styles.activeLine}>
            Длится {formatDurationBetween(active.startedAt, null, tick)}
          </Text>
          <Text
            style={styles.activeIntensity}
            accessibilityLabel={`Сейчас ${formatIntensityScore(latestIntensity ?? 0)}`}
          >
            Сейчас:{' '}
            {latestIntensity == null
              ? '—'
              : formatIntensityScore(latestIntensity)}
          </Text>

          {summaryLines.map((line) => (
            <Text key={line} style={styles.summaryLine}>
              {line}
            </Text>
          ))}

          <MedicationIntakeSection
            intakes={intakes}
            compact
            onRateEffect={(intakeId, effect: MedicationEffect) => {
              medicationRepository?.setIntakeEffect(intakeId, effect);
              load();
            }}
            onDeleteIntake={(intakeId) => {
              medicationRepository?.deleteIntake(intakeId);
              load();
            }}
          />

          <View style={styles.actions}>
            <Button
              title="Изменить интенсивность"
              onPress={() =>
                router.push({
                  pathname: '/change-intensity',
                  params: { episodeId: active.id },
                })
              }
            />
            <Button
              title="Принял лекарство"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/log-medication',
                  params: { episodeId: active.id },
                })
              }
            />
            <Button
              title="Завершить приступ"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/finish-episode',
                  params: { episodeId: active.id },
                })
              }
            />
            <Button
              title={
                hasDetails ? 'Изменить подробности' : 'Добавить подробности'
              }
              variant="ghost"
              onPress={() => router.push(`/episode-details/${active.id}`)}
            />
            <Button
              title="Подробнее / Изменить"
              variant="ghost"
              onPress={() => router.push(`/episode/${active.id}`)}
            />
          </View>
        </Card>
      )}

      {historySectionMode !== 'hidden' ? (
        <>
          <Text style={styles.sectionTitle}>Сегодня</Text>
          {historySectionMode === 'empty' ? (
            <Text style={styles.empty}>Сегодня приступов не отмечено</Text>
          ) : (
            completed.map(({ episode, maxIntensity, detailSummary }) => (
              <Pressable
                key={episode.id}
                accessibilityRole="button"
                accessibilityLabel={`Приступ ${formatLocalTimeRange(episode.startedAt, episode.endedAt)}`}
                onPress={() => router.push(`/episode/${episode.id}`)}
                style={({ pressed }) => [
                  styles.historyCard,
                  pressed ? styles.historyPressed : null,
                ]}
              >
                <Text style={styles.historyRange}>
                  {formatLocalTimeRange(episode.startedAt, episode.endedAt)}
                </Text>
                {detailSummary ? (
                  <Text style={styles.historySummary}>{detailSummary}</Text>
                ) : null}
                <Text style={styles.historyMeta}>
                  {maxIntensity == null
                    ? 'Интенсивность —'
                    : `Макс. ${formatIntensityScore(maxIntensity)}`}
                  {' · '}
                  {formatDurationBetween(episode.startedAt, episode.endedAt)}
                </Text>
              </Pressable>
            ))
          )}
        </>
      ) : null}

      <DailyCheckInCard
        checkIn={todayCheckIn}
        onPress={() =>
          router.push({
            pathname: '/daily-check-in',
            params: { date: toLocalDateString(new Date()) },
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  date: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textTransform: 'capitalize',
  },
  cta: {
    marginBottom: spacing.xl,
  },
  activeCard: {
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  activeTitle: {
    ...typography.subtitle,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  activeLine: {
    ...typography.body,
    color: colors.text,
  },
  activeIntensity: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryLine: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyPressed: {
    opacity: 0.85,
  },
  historyRange: {
    ...typography.subtitle,
    color: colors.text,
  },
  historySummary: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  historyMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  errorTitle: {
    ...typography.subtitle,
    color: colors.danger,
    textAlign: 'center',
  },
  retry: {
    minWidth: 160,
  },
});
