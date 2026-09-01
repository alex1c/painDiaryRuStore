/**
 * Analytics module public API.
 */

export { AnalyticsRepository } from '@/src/analytics/AnalyticsRepository';
export {
  buildAnalyticsReport,
  buildCheckInBuckets,
  collectHeadacheDays,
  localHourToTimeOfDayBucket,
  tryBuildObservation,
  formatFactorRankLabel,
  FACTOR_DISCLAIMER,
  INSUFFICIENT_CHECKIN_DATA_MESSAGE,
} from '@/src/analytics/calculations';
export {
  DEFAULT_ANALYTICS_PERIOD,
  MIN_CHECKIN_DAYS_FOR_COMPARISON,
  MIN_CHECKIN_DAYS_PER_STATE,
  MIN_PATTERN_RATE_DIFF_PP,
  PERIOD_LABELS,
  OBSERVATIONAL_DISCLAIMER,
  FACTOR_DISCLAIMER as FACTOR_SECTION_DISCLAIMER,
} from '@/src/analytics/constants';
export { getPeriodBounds, periodToUtcHalfOpenRange, chooseFrequencyBucketUnit } from '@/src/analytics/period';
export type {
  AnalyticsInput,
  AnalyticsPeriod,
  AnalyticsReport,
  DailyObservation,
  FrequencyBucket,
  MedicationAnalyticsRow,
  PeriodBounds,
  RankedCount,
} from '@/src/analytics/types';
