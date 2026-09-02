/**
 * Analytics tab — Phase 6 headache statistics and cautious observations.
 */

import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AnalyticsSection } from '@/components/analytics/AnalyticsSection';
import { MetricGrid } from '@/components/analytics/MetricGrid';
import { PeriodSelector } from '@/components/analytics/PeriodSelector';
import { RankedList } from '@/components/analytics/RankedList';
import { SimpleBarChart } from '@/components/analytics/SimpleBarChart';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import {
  DEFAULT_ANALYTICS_PERIOD,
  FACTOR_SECTION_DISCLAIMER,
  OBSERVATIONAL_DISCLAIMER,
} from '@/src/analytics';
import type { AnalyticsPeriod, AnalyticsReport } from '@/src/analytics/types';
import { MEDICATION_EFFECT_LABELS } from '@/src/domain/labels';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { formatDurationMs } from '@/src/utils/formatDuration';
import { toLocalDateString } from '@/src/utils/localDate';

export default function AnalyticsScreen() {
  const { ready, analyticsRepository, dataRevision } = useDatabase();
  const [period, setPeriod] = useState<AnalyticsPeriod>(DEFAULT_ANALYTICS_PERIOD);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!ready || !analyticsRepository) {
      return;
    }
    setLoading(true);
    const next = analyticsRepository.buildReport(
      period,
      toLocalDateString(new Date())
    );
    setReport(next);
    setLoading(false);
  }, [ready, analyticsRepository, period]);

  // dataRevision retriggers reload after backup restore or delete-all.
  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional refresh token
    }, [load, dataRevision])
  );

  return (
    <Screen scroll>
      <Text style={styles.title}>Аналитика</Text>
      <Text style={styles.subtitle}>Наблюдения по вашим записям</Text>

      <PeriodSelector value={period} onChange={setPeriod} />

      {loading || !report ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : report.isEmpty ? (
        <Card style={styles.card}>
          <Text style={styles.body}>
            Здесь появится статистика после первых записей о головной боли.
          </Text>
        </Card>
      ) : (
        <>
          <AnalyticsSection title="Обзор">
            <MetricGrid
              items={[
                { label: 'Приступов', value: String(report.overview.episodeCount) },
                {
                  label: 'Дней с головной болью',
                  value: String(report.overview.headacheDayCount),
                },
                {
                  label: 'Средняя интенсивность',
                  value:
                    report.overview.averageIntensity != null
                      ? `${report.overview.averageIntensity} / 10`
                      : '—',
                },
                {
                  label: 'Максимальная интенсивность',
                  value:
                    report.overview.maxIntensity != null
                      ? `${report.overview.maxIntensity} / 10`
                      : '—',
                },
                {
                  label: 'Средняя длительность',
                  value:
                    report.overview.averageDurationMs != null
                      ? formatDurationMs(report.overview.averageDurationMs)
                      : '—',
                },
              ]}
            />
          </AnalyticsSection>

          <AnalyticsSection title="Частота">
            <SimpleBarChart
              buckets={report.frequency.buckets}
              metricLabel={report.frequency.metricLabel}
            />
          </AnalyticsSection>

          <AnalyticsSection title="Интенсивность">
            <MetricGrid
              items={[
                {
                  label: 'Средняя',
                  value:
                    report.intensity.average != null
                      ? `${report.intensity.average} / 10`
                      : '—',
                },
                {
                  label: 'Максимальная',
                  value:
                    report.intensity.maximum != null
                      ? `${report.intensity.maximum} / 10`
                      : '—',
                },
              ]}
            />
          </AnalyticsSection>

          <AnalyticsSection title="Длительность">
            {report.duration.hasCompletedEpisodes ? (
              <MetricGrid
                items={[
                  {
                    label: 'Средняя длительность приступа',
                    value:
                      report.duration.averageMs != null
                        ? formatDurationMs(report.duration.averageMs)
                        : '—',
                  },
                  {
                    label: 'Самый долгий',
                    value:
                      report.duration.longestMs != null
                        ? formatDurationMs(report.duration.longestMs)
                        : '—',
                  },
                ]}
              />
            ) : (
              <Text style={styles.body}>
                Пока нет завершённых приступов для расчёта длительности.
              </Text>
            )}
          </AnalyticsSection>

          <AnalyticsSection title="Когда начинаются приступы">
            <View style={styles.listGap}>
              {report.timeOfDay.buckets.map((bucket) => (
                <View key={bucket.bucket} style={styles.timeRow}>
                  <Text style={styles.timeLabel}>{bucket.label}</Text>
                  <Text style={styles.timeValue}>
                    {bucket.count} ({bucket.percent}%)
                  </Text>
                </View>
              ))}
            </View>
          </AnalyticsSection>

          <AnalyticsSection title="Часто отмечаемые симптомы">
            <RankedList
              items={report.symptoms}
              emptyText="Симптомы ещё не отмечались в этом периоде."
            />
          </AnalyticsSection>

          <AnalyticsSection title="Характер боли">
            <RankedList
              items={report.painCharacters}
              emptyText="Характер боли ещё не отмечался."
            />
          </AnalyticsSection>

          {(report.sides.length > 0 || report.locations.length > 0) && (
            <AnalyticsSection title="Где чаще болит">
              {report.sides.length > 0 ? (
                <>
                  <Text style={styles.subheading}>Сторона</Text>
                  <RankedList
                    items={report.sides}
                    emptyText=""
                  />
                </>
              ) : null}
              {report.locations.length > 0 ? (
                <>
                  <Text style={styles.subheading}>Локация</Text>
                  <RankedList
                    items={report.locations}
                    emptyText=""
                  />
                </>
              ) : null}
            </AnalyticsSection>
          )}

          <AnalyticsSection
            title="Часто отмечаемые факторы"
            hint={FACTOR_SECTION_DISCLAIMER}
          >
            <RankedList
              items={report.factors}
              emptyText="Факторы ещё не отмечались рядом с приступами."
            />
          </AnalyticsSection>

          {!report.isLowData && (
            <AnalyticsSection
              title="Наблюдения"
              hint={OBSERVATIONAL_DISCLAIMER}
            >
              {report.dailyObservations.observations.length > 0 ? (
                <View style={styles.listGap}>
                  {report.dailyObservations.observations.map((obs) => (
                    <Text key={`${obs.dimensionLabel}-${obs.higherLabel}`} style={styles.observation}>
                      {obs.text}
                    </Text>
                  ))}
                  {report.dailyObservations.bucketDetails.map((detail) => (
                    <View key={detail.dimensionLabel} style={styles.bucketBlock}>
                      <Text style={styles.subheading}>{detail.dimensionLabel}</Text>
                      {detail.buckets.map((bucket) => (
                        <Text key={bucket.valueKey} style={styles.bucketLine}>
                          {bucket.valueLabel}: {bucket.headacheDays} из {bucket.totalDays} дней с головной болью
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.body}>
                  {report.dailyObservations.insufficientMessage}
                </Text>
              )}
            </AnalyticsSection>
          )}

          {report.medications.length > 0 && (
            <AnalyticsSection title="Лекарства">
              <View style={styles.listGap}>
                {report.medications.map((med) => (
                  <View key={med.name} style={styles.medBlock}>
                    <Text style={styles.medName}>{med.name}</Text>
                    <Text style={styles.medLine}>Приёмов: {med.intakeCount}</Text>
                    {med.helpedALot > 0 ? (
                      <Text style={styles.medLine}>
                        {MEDICATION_EFFECT_LABELS.helped_a_lot}: {med.helpedALot}
                      </Text>
                    ) : null}
                    {med.helpedSomewhat > 0 ? (
                      <Text style={styles.medLine}>
                        {MEDICATION_EFFECT_LABELS.helped_somewhat}: {med.helpedSomewhat}
                      </Text>
                    ) : null}
                    {med.noEffect > 0 ? (
                      <Text style={styles.medLine}>
                        {MEDICATION_EFFECT_LABELS.no_effect}: {med.noEffect}
                      </Text>
                    ) : null}
                    {med.madeWorse > 0 ? (
                      <Text style={styles.medLine}>
                        {MEDICATION_EFFECT_LABELS.made_worse}: {med.madeWorse}
                      </Text>
                    ) : null}
                    {med.tooEarlyToTell > 0 ? (
                      <Text style={styles.medLine}>
                        {MEDICATION_EFFECT_LABELS.too_early_to_tell}: {med.tooEarlyToTell}
                      </Text>
                    ) : null}
                    {med.unrated > 0 ? (
                      <Text style={styles.medLine}>Не оценено: {med.unrated}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </AnalyticsSection>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  center: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  listGap: {
    gap: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  timeLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  timeValue: {
    ...typography.body,
    color: colors.textSecondary,
  },
  subheading: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  observation: {
    ...typography.body,
    color: colors.text,
  },
  bucketBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  bucketLine: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  medBlock: {
    gap: 2,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  medName: {
    ...typography.subtitle,
    color: colors.text,
  },
  medLine: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
