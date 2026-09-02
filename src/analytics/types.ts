/**
 * Domain models for headache analytics (observational, not causal).
 */

import type { MedicationEffect } from '@/src/domain/codes';

/** User-selectable analytics window. */
export type AnalyticsPeriod =
  | '7d'
  | '14d'
  | '30d'
  | '90d'
  | 'all'
  | 'custom';

/** Local-date inclusive bounds for a period; `from` is null for "all time". */
export type PeriodBounds = {
  from: string | null;
  to: string;
};

/** Bucket granularity for the frequency chart. */
export type FrequencyBucketUnit = 'day' | 'week' | 'month';

/** Local time-of-day bucket for episode starts (local clock). */
export type TimeOfDayBucket = 'night' | 'morning' | 'day' | 'evening';

/** One bar/point on the frequency chart — headache DAYS per bucket. */
export type FrequencyBucket = {
  key: string;
  label: string;
  headacheDays: number;
};

/** Ranked label + episode count (deduped per episode). */
export type RankedCount = {
  key: string;
  label: string;
  episodeCount: number;
};

/** Medication aggregate keyed by historical name snapshot. */
export type MedicationAnalyticsRow = {
  name: string;
  intakeCount: number;
  helpedALot: number;
  helpedSomewhat: number;
  noEffect: number;
  madeWorse: number;
  tooEarlyToTell: number;
  unrated: number;
};

/** Per-value headache-day rate for a daily check-in dimension. */
export type CheckInBucketStats = {
  valueKey: string;
  valueLabel: string;
  totalDays: number;
  headacheDays: number;
  headacheRate: number;
};

/** Cautious observational statement derived from check-in comparisons. */
export type DailyObservation = {
  dimensionLabel: string;
  higherLabel: string;
  higherHeadacheDays: number;
  higherTotalDays: number;
  lowerLabel: string;
  lowerHeadacheDays: number;
  lowerTotalDays: number;
  text: string;
};

/** Raw episode row loaded from SQLite before aggregation. */
export type EpisodeAnalyticsRow = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  side: string | null;
  localStartDate: string;
  localStartHour: number;
  avgIntensity: number | null;
  maxIntensity: number | null;
};

/** Raw medication intake row for analytics. */
export type MedicationIntakeAnalyticsRow = {
  medicationNameSnapshot: string;
  effect: MedicationEffect | null;
  takenAt: string;
};

/** Input bundle for pure calculation functions (also used in tests). */
export type AnalyticsInput = {
  period: AnalyticsPeriod;
  bounds: PeriodBounds;
  episodes: EpisodeAnalyticsRow[];
  symptoms: RankedCount[];
  painCharacters: RankedCount[];
  sides: RankedCount[];
  locations: RankedCount[];
  factors: RankedCount[];
  medicationIntakes: MedicationIntakeAnalyticsRow[];
  checkIns: {
    localDate: string;
    sleepQuality: string | null;
    stressLevel: string | null;
    hydrationLevel: string | null;
    caffeineLevel: string | null;
    mealPattern: string | null;
    physicalActivity: string | null;
  }[];
};

/** Fully computed analytics report for the UI. */
export type AnalyticsReport = {
  period: AnalyticsPeriod;
  bounds: PeriodBounds;
  isEmpty: boolean;
  isLowData: boolean;
  overview: {
    episodeCount: number;
    headacheDayCount: number;
    averageIntensity: number | null;
    maxIntensity: number | null;
    averageDurationMs: number | null;
    longestDurationMs: number | null;
  };
  frequency: {
    unit: FrequencyBucketUnit;
    metricLabel: string;
    buckets: FrequencyBucket[];
  };
  intensity: {
    average: number | null;
    maximum: number | null;
  };
  duration: {
    averageMs: number | null;
    longestMs: number | null;
    hasCompletedEpisodes: boolean;
  };
  timeOfDay: {
    buckets: { bucket: TimeOfDayBucket; label: string; count: number; percent: number }[];
  };
  symptoms: RankedCount[];
  painCharacters: RankedCount[];
  sides: RankedCount[];
  locations: RankedCount[];
  factors: RankedCount[];
  dailyObservations: {
    hasEnoughData: boolean;
    insufficientMessage: string;
    observations: DailyObservation[];
    bucketDetails: { dimensionLabel: string; buckets: CheckInBucketStats[] }[];
  };
  medications: MedicationAnalyticsRow[];
};
