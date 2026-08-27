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

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { HeadacheEpisode } from '@/src/domain/types';
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
import { buildDetailsSummaryLines } from '@/src/utils/detailsSummary';

type TodayRow = {
  episode: HeadacheEpisode;
  maxIntensity: number | null;
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
      completed: TodayRow[];
      tick: number;
    };

export default function TodayScreen() {
  const router = useRouter();
  const { ready, error: dbError, headacheRepository } = useDatabase();
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
      const localDate = toLocalDateString(new Date());
      const completedEpisodes =
        headacheRepository.getCompletedEpisodesForLocalDate(localDate);
      const completed: TodayRow[] = completedEpisodes.map((episode) => ({
        episode,
        maxIntensity: headacheRepository.getMaxIntensity(episode.id),
      }));

      setState({
        status: 'ready',
        active,
        latestIntensity: latest?.intensity ?? null,
        hasDetails:
          active != null && headacheRepository.hasPainDetails(active.id),
        summaryLines: details ? buildDetailsSummaryLines(details) : [],
        completed,
        tick: Date.now(),
      });
    } catch {
      setState({
        status: 'error',
        message: 'Не удалось загрузить данные',
      });
    }
  }, [ready, headacheRepository]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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

  const { active, latestIntensity, hasDetails, summaryLines, completed, tick } =
    state;

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

      <Text style={styles.sectionTitle}>Сегодня</Text>
      {completed.length === 0 ? (
        <Text style={styles.empty}>Сегодня приступов не отмечено</Text>
      ) : (
        completed.map(({ episode, maxIntensity }) => (
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
