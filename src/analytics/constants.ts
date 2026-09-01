/**
 * Analytics thresholds and stable bucket definitions.
 */

import type { TimeOfDayBucket } from '@/src/analytics/types';

/** Minimum check-in days with a field set to attempt cross-state comparison. */
export const MIN_CHECKIN_DAYS_FOR_COMPARISON = 5;

/** Each compared state needs at least this many check-in days. */
export const MIN_CHECKIN_DAYS_PER_STATE = 2;

/** Minimum absolute rate gap (percentage points) to emit an observation. */
export const MIN_PATTERN_RATE_DIFF_PP = 15;

/** Episodes at or below this count suppress pattern-style observations. */
export const LOW_DATA_EPISODE_THRESHOLD = 2;

/** Top N ranked tags shown in UI. */
export const TOP_RANKED_LIMIT = 5;

/** Local hour ranges for time-of-day buckets (inclusive start, exclusive end). */
export const TIME_OF_DAY_BUCKETS: {
  bucket: TimeOfDayBucket;
  label: string;
  startHour: number;
  endHour: number;
}[] = [
  { bucket: 'night', label: 'Ночь', startHour: 0, endHour: 6 },
  { bucket: 'morning', label: 'Утро', startHour: 6, endHour: 12 },
  { bucket: 'day', label: 'День', startHour: 12, endHour: 18 },
  { bucket: 'evening', label: 'Вечер', startHour: 18, endHour: 24 },
];

/** Russian labels for analytics period chips. */
export const PERIOD_LABELS: Record<
  import('@/src/analytics/types').AnalyticsPeriod,
  string
> = {
  '7d': '7 дней',
  '30d': '30 дней',
  '90d': '90 дней',
  all: 'Всё',
};

/** Default period when opening Analytics. */
export const DEFAULT_ANALYTICS_PERIOD = '30d' as const;

/** Cautious disclaimer shown near factor / observation sections. */
export const OBSERVATIONAL_DISCLAIMER =
  'Это наблюдения по вашим записям, а не установленная причина.';

export const FACTOR_DISCLAIMER =
  'Это совпадения в записях, а не доказанные причины.';

export const INSUFFICIENT_CHECKIN_DATA_MESSAGE =
  'Пока мало данных для сравнения';
