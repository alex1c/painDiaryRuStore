/**
 * Pure analytics calculations — independently testable, no React/SQL.
 *
 * Intensity semantics:
 * - Per episode: arithmetic mean of all recorded intensity entries.
 * - Period average/max: mean/max of those per-episode representative values.
 *   Episodes without intensity rows are excluded from intensity aggregates.
 *
 * Duration semantics:
 * - Only completed episodes (endedAt != null) contribute.
 * - Active episodes are excluded from average/longest duration.
 *
 * Headache day semantics:
 * - Distinct local calendar dates of episode START (startedAt), including active.
 */

import {
  FACTOR_DISCLAIMER,
  INSUFFICIENT_CHECKIN_DATA_MESSAGE,
  LOW_DATA_EPISODE_THRESHOLD,
  MIN_CHECKIN_DAYS_FOR_COMPARISON,
  MIN_CHECKIN_DAYS_PER_STATE,
  MIN_PATTERN_RATE_DIFF_PP,
  TIME_OF_DAY_BUCKETS,
  TOP_RANKED_LIMIT,
} from '@/src/analytics/constants';
import { chooseFrequencyBucketUnit } from '@/src/analytics/period';
import type {
  AnalyticsInput,
  AnalyticsReport,
  CheckInBucketStats,
  DailyObservation,
  EpisodeAnalyticsRow,
  FrequencyBucket,
  MedicationAnalyticsRow,
  MedicationIntakeAnalyticsRow,
  RankedCount,
  TimeOfDayBucket,
} from '@/src/analytics/types';
import type { MedicationEffect } from '@/src/domain/codes';
import {
  CAFFEINE_LEVEL_LABELS,
  HYDRATION_LEVEL_LABELS,
  MEAL_PATTERN_LABELS,
  PHYSICAL_ACTIVITY_LABELS,
  SLEEP_QUALITY_LABELS,
  STRESS_LEVEL_LABELS,
  factorDisplayLabel,
} from '@/src/domain/labels';
import { addDaysToLocalDate, parseLocalDate, toLocalDateString } from '@/src/utils/localDate';

/** Builds the full analytics report from pre-loaded raw rows. */
export function buildAnalyticsReport(input: AnalyticsInput): AnalyticsReport {
  const episodes = input.episodes;
  const episodeCount = episodes.length;
  const headacheDays = collectHeadacheDays(episodes);
  const headacheDayCount = headacheDays.size;
  const isEmpty = episodeCount === 0;
  const isLowData = episodeCount > 0 && episodeCount <= LOW_DATA_EPISODE_THRESHOLD;

  const intensityValues = episodes
    .map((e) => e.avgIntensity)
    .filter((v): v is number => v != null);
  const maxIntensityValues = episodes
    .map((e) => e.maxIntensity)
    .filter((v): v is number => v != null);

  const averageIntensity =
    intensityValues.length > 0
      ? roundOneDecimal(
          intensityValues.reduce((a, b) => a + b, 0) / intensityValues.length
        )
      : null;
  const maxIntensity =
    maxIntensityValues.length > 0 ? Math.max(...maxIntensityValues) : null;

  const completedDurations = episodes
    .filter((e) => e.endedAt != null)
    .map((e) => Math.max(0, Date.parse(e.endedAt!) - Date.parse(e.startedAt)))
    .filter((ms) => Number.isFinite(ms));

  const averageDurationMs =
    completedDurations.length > 0
      ? Math.round(
          completedDurations.reduce((a, b) => a + b, 0) /
            completedDurations.length
        )
      : null;
  const longestDurationMs =
    completedDurations.length > 0 ? Math.max(...completedDurations) : null;

  const unit = chooseFrequencyBucketUnit(input.period, input.bounds);
  const frequencyBuckets = buildFrequencyBuckets(
    headacheDays,
    input.bounds,
    unit
  );

  const dailyObservations = buildDailyObservations(
    input.checkIns,
    headacheDays,
    isLowData
  );

  return {
    period: input.period,
    bounds: input.bounds,
    isEmpty,
    isLowData,
    overview: {
      episodeCount,
      headacheDayCount,
      averageIntensity,
      maxIntensity,
      averageDurationMs,
      longestDurationMs,
    },
    frequency: {
      unit,
      metricLabel: 'Дней с головной болью',
      buckets: frequencyBuckets,
    },
    intensity: {
      average: averageIntensity,
      maximum: maxIntensity,
    },
    duration: {
      averageMs: averageDurationMs,
      longestMs: longestDurationMs,
      hasCompletedEpisodes: completedDurations.length > 0,
    },
    timeOfDay: buildTimeOfDay(episodes),
    symptoms: topRanked(input.symptoms),
    painCharacters: topRanked(input.painCharacters),
    sides: topRanked(input.sides),
    locations: topRanked(input.locations),
    factors: topRanked(input.factors),
    dailyObservations,
    medications: buildMedicationAnalytics(input.medicationIntakes),
  };
}

/** Distinct local dates when at least one episode started. */
export function collectHeadacheDays(
  episodes: EpisodeAnalyticsRow[]
): Set<string> {
  return new Set(episodes.map((e) => e.localStartDate));
}

/** Maps local hour (0–23) to a stable time-of-day bucket. */
export function localHourToTimeOfDayBucket(hour: number): TimeOfDayBucket {
  const normalized = ((hour % 24) + 24) % 24;
  for (const def of TIME_OF_DAY_BUCKETS) {
    if (normalized >= def.startHour && normalized < def.endHour) {
      return def.bucket;
    }
  }
  return 'evening';
}

function buildTimeOfDay(episodes: EpisodeAnalyticsRow[]) {
  const counts: Record<TimeOfDayBucket, number> = {
    night: 0,
    morning: 0,
    day: 0,
    evening: 0,
  };

  for (const episode of episodes) {
    counts[localHourToTimeOfDayBucket(episode.localStartHour)] += 1;
  }

  const total = episodes.length;
  return {
    buckets: TIME_OF_DAY_BUCKETS.map((def) => ({
      bucket: def.bucket,
      label: def.label,
      count: counts[def.bucket],
      percent: total > 0 ? Math.round((counts[def.bucket] / total) * 100) : 0,
    })),
  };
}

function buildFrequencyBuckets(
  headacheDays: Set<string>,
  bounds: import('@/src/analytics/types').PeriodBounds,
  unit: import('@/src/analytics/types').FrequencyBucketUnit
): FrequencyBucket[] {
  const from =
    bounds.from ?? minLocalDate([...headacheDays], bounds.to) ?? bounds.to;
  const to = bounds.to;

  if (unit === 'day') {
    const buckets: FrequencyBucket[] = [];
    let cursor = from;
    while (cursor <= to) {
      buckets.push({
        key: cursor,
        label: formatShortDayLabel(cursor),
        headacheDays: headacheDays.has(cursor) ? 1 : 0,
      });
      cursor = addDaysToLocalDate(cursor, 1);
    }
    return buckets;
  }

  if (unit === 'week') {
    return aggregateByWeek(headacheDays, from, to);
  }

  return aggregateByMonth(headacheDays, from, to);
}

function aggregateByWeek(
  headacheDays: Set<string>,
  from: string,
  to: string
): FrequencyBucket[] {
  const buckets = new Map<string, { label: string; count: number }>();
  let cursor = from;
  while (cursor <= to) {
    const weekStart = startOfWeekLocal(cursor);
    const key = weekStart;
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: `нед. ${formatShortDayLabel(weekStart)}`,
        count: 0,
      });
    }
    if (headacheDays.has(cursor)) {
      buckets.get(key)!.count += 1;
    }
    cursor = addDaysToLocalDate(cursor, 1);
  }

  return [...buckets.entries()].map(([key, value]) => ({
    key,
    label: value.label,
    headacheDays: value.count,
  }));
}

function aggregateByMonth(
  headacheDays: Set<string>,
  from: string,
  to: string
): FrequencyBucket[] {
  const buckets = new Map<string, { label: string; count: number }>();

  let cursor = from;
  while (cursor <= to) {
    const monthKey = cursor.slice(0, 7);
    if (!buckets.has(monthKey)) {
      const [y, m] = monthKey.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('ru-RU', {
        month: 'short',
        year: 'numeric',
      });
      buckets.set(monthKey, { label, count: 0 });
    }
    if (headacheDays.has(cursor)) {
      buckets.get(monthKey)!.count += 1;
    }
    cursor = addDaysToLocalDate(cursor, 1);
  }

  return [...buckets.entries()].map(([key, value]) => ({
    key,
    label: value.label,
    headacheDays: value.count,
  }));
}

function startOfWeekLocal(localDate: string): string {
  const date = parseLocalDate(localDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return toLocalDateString(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff)
  );
}

function formatShortDayLabel(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

function minLocalDate(dates: string[], fallback: string): string | null {
  if (dates.length === 0) return null;
  return dates.reduce((min, d) => (d < min ? d : min), dates[0] ?? fallback);
}

function topRanked(items: RankedCount[]): RankedCount[] {
  return [...items]
    .sort((a, b) => {
      if (b.episodeCount !== a.episodeCount) {
        return b.episodeCount - a.episodeCount;
      }
      return a.label.localeCompare(b.label, 'ru');
    })
    .slice(0, TOP_RANKED_LIMIT);
}

function buildMedicationAnalytics(
  intakes: MedicationIntakeAnalyticsRow[]
): MedicationAnalyticsRow[] {
  const map = new Map<string, MedicationAnalyticsRow>();

  for (const intake of intakes) {
    const name = intake.medicationNameSnapshot.trim() || 'Без названия';
    const row =
      map.get(name) ??
      {
        name,
        intakeCount: 0,
        helpedALot: 0,
        helpedSomewhat: 0,
        noEffect: 0,
        madeWorse: 0,
        tooEarlyToTell: 0,
        unrated: 0,
      };

    row.intakeCount += 1;
    if (intake.effect == null) {
      row.unrated += 1;
    } else {
      incrementEffect(row, intake.effect);
    }
    map.set(name, row);
  }

  return [...map.values()].sort((a, b) => {
    if (b.intakeCount !== a.intakeCount) {
      return b.intakeCount - a.intakeCount;
    }
    return a.name.localeCompare(b.name, 'ru');
  });
}

function incrementEffect(
  row: MedicationAnalyticsRow,
  effect: MedicationEffect
): void {
  switch (effect) {
    case 'helped_a_lot':
      row.helpedALot += 1;
      break;
    case 'helped_somewhat':
      row.helpedSomewhat += 1;
      break;
    case 'no_effect':
      row.noEffect += 1;
      break;
    case 'made_worse':
      row.madeWorse += 1;
      break;
    case 'too_early_to_tell':
      row.tooEarlyToTell += 1;
      break;
    default:
      row.unrated += 1;
  }
}

type CheckInDimension = {
  key: string;
  label: string;
  getValue: (
    row: AnalyticsInput['checkIns'][number]
  ) => string | null;
  valueLabel: (value: string) => string;
};

const CHECKIN_DIMENSIONS: CheckInDimension[] = [
  {
    key: 'sleep',
    label: 'Сон',
    getValue: (r) => r.sleepQuality,
    valueLabel: (v) => SLEEP_QUALITY_LABELS[v as keyof typeof SLEEP_QUALITY_LABELS],
  },
  {
    key: 'stress',
    label: 'Стресс',
    getValue: (r) => r.stressLevel,
    valueLabel: (v) => STRESS_LEVEL_LABELS[v as keyof typeof STRESS_LEVEL_LABELS],
  },
  {
    key: 'hydration',
    label: 'Вода',
    getValue: (r) => r.hydrationLevel,
    valueLabel: (v) =>
      HYDRATION_LEVEL_LABELS[v as keyof typeof HYDRATION_LEVEL_LABELS],
  },
  {
    key: 'caffeine',
    label: 'Кофеин',
    getValue: (r) => r.caffeineLevel,
    valueLabel: (v) =>
      CAFFEINE_LEVEL_LABELS[v as keyof typeof CAFFEINE_LEVEL_LABELS],
  },
  {
    key: 'meal',
    label: 'Питание',
    getValue: (r) => r.mealPattern,
    valueLabel: (v) => MEAL_PATTERN_LABELS[v as keyof typeof MEAL_PATTERN_LABELS],
  },
  {
    key: 'activity',
    label: 'Нагрузка',
    getValue: (r) => r.physicalActivity,
    valueLabel: (v) =>
      PHYSICAL_ACTIVITY_LABELS[v as keyof typeof PHYSICAL_ACTIVITY_LABELS],
  },
];

function buildDailyObservations(
  checkIns: AnalyticsInput['checkIns'],
  headacheDays: Set<string>,
  isLowData: boolean
) {
  const bucketDetails: {
    dimensionLabel: string;
    buckets: CheckInBucketStats[];
  }[] = [];
  const observations: DailyObservation[] = [];

  if (isLowData) {
    return {
      hasEnoughData: false,
      insufficientMessage: INSUFFICIENT_CHECKIN_DATA_MESSAGE,
      observations: [],
      bucketDetails: [],
    };
  }

  for (const dimension of CHECKIN_DIMENSIONS) {
    const buckets = buildCheckInBuckets(
      checkIns,
      headacheDays,
      dimension.getValue,
      dimension.valueLabel
    );
    if (buckets.length > 0) {
      bucketDetails.push({ dimensionLabel: dimension.label, buckets });
    }

    const observation = tryBuildObservation(dimension.label, buckets);
    if (observation) {
      observations.push(observation);
    }
  }

  const hasEnoughData = bucketDetails.some((d) =>
    d.buckets.reduce((sum, b) => sum + b.totalDays, 0) >=
    MIN_CHECKIN_DAYS_FOR_COMPARISON
  );

  return {
    hasEnoughData,
    insufficientMessage: INSUFFICIENT_CHECKIN_DATA_MESSAGE,
    observations,
    bucketDetails,
  };
}

export function buildCheckInBuckets(
  checkIns: AnalyticsInput['checkIns'],
  headacheDays: Set<string>,
  getValue: (row: AnalyticsInput['checkIns'][number]) => string | null,
  valueLabel: (value: string) => string
): CheckInBucketStats[] {
  const map = new Map<string, { total: number; headache: number }>();

  for (const row of checkIns) {
    const value = getValue(row);
    if (value == null) continue;
    const stats = map.get(value) ?? { total: 0, headache: 0 };
    stats.total += 1;
    if (headacheDays.has(row.localDate)) {
      stats.headache += 1;
    }
    map.set(value, stats);
  }

  return [...map.entries()]
    .map(([valueKey, stats]) => ({
      valueKey,
      valueLabel: valueLabel(valueKey),
      totalDays: stats.total,
      headacheDays: stats.headache,
      headacheRate:
        stats.total > 0 ? stats.headache / stats.total : 0,
    }))
    .sort((a, b) => a.valueLabel.localeCompare(b.valueLabel, 'ru'));
}

export function tryBuildObservation(
  dimensionLabel: string,
  buckets: CheckInBucketStats[]
): DailyObservation | null {
  const totalDays = buckets.reduce((sum, b) => sum + b.totalDays, 0);
  if (totalDays < MIN_CHECKIN_DAYS_FOR_COMPARISON) {
    return null;
  }

  const eligible = buckets.filter((b) => b.totalDays >= MIN_CHECKIN_DAYS_PER_STATE);
  if (eligible.length < 2) {
    return null;
  }

  const sorted = [...eligible].sort((a, b) => b.headacheRate - a.headacheRate);
  const higher = sorted[0];
  const lower = sorted[sorted.length - 1];
  const diffPp = (higher.headacheRate - lower.headacheRate) * 100;

  if (diffPp < MIN_PATTERN_RATE_DIFF_PP) {
    return null;
  }

  const text = `Среди отмеченных дней головная боль чаще встречалась при ${higher.valueLabel.toLowerCase()} (${higher.headacheDays} из ${higher.totalDays} против ${lower.headacheDays} из ${lower.totalDays}).`;

  return {
    dimensionLabel,
    higherLabel: higher.valueLabel,
    higherHeadacheDays: higher.headacheDays,
    higherTotalDays: higher.totalDays,
    lowerLabel: lower.valueLabel,
    lowerHeadacheDays: lower.headacheDays,
    lowerTotalDays: lower.totalDays,
    text,
  };
}

/** Formats factor row label from code + optional custom label. */
export function formatFactorRankLabel(
  code: string,
  customLabel: string | null
): string {
  if (code === 'custom') {
    return factorDisplayLabel('custom', customLabel);
  }
  return factorDisplayLabel(code as Parameters<typeof factorDisplayLabel>[0], null);
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export { FACTOR_DISCLAIMER, INSUFFICIENT_CHECKIN_DATA_MESSAGE };
