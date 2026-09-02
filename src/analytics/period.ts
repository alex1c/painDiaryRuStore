/**
 * Local-calendar period boundaries for analytics.
 *
 * "30 дней" means today plus the previous 29 local dates (30 calendar days).
 * We never use raw millisecond offsets that could mis-handle DST boundaries.
 */

import type { AnalyticsPeriod, PeriodBounds } from '@/src/analytics/types';
import {
  addDaysToLocalDate,
  compareLocalDates,
  isValidLocalDateString,
  parseLocalDate,
} from '@/src/utils/localDate';

/** Number of inclusive local calendar days covered by fixed windows. */
const PERIOD_DAY_COUNTS: Record<
  Exclude<AnalyticsPeriod, 'all' | 'custom'>,
  number
> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

/**
 * Returns inclusive local-date bounds for the selected period.
 * `from` is null when period is "all" (no lower bound).
 */
export function getPeriodBounds(
  period: AnalyticsPeriod,
  todayLocal: string
): PeriodBounds {
  if (period === 'all') {
    return { from: null, to: todayLocal };
  }

  if (period === 'custom') {
    throw new Error('getPeriodBounds does not support custom period');
  }

  const dayCount = PERIOD_DAY_COUNTS[period];
  const from = addDaysToLocalDate(todayLocal, -(dayCount - 1));
  return { from, to: todayLocal };
}

/**
 * Inclusive custom local-date range for doctor reports.
 * Both endpoints must be valid YYYY-MM-DD strings with start <= end.
 */
export function getCustomPeriodBounds(
  fromLocal: string,
  toLocal: string
): PeriodBounds {
  if (!isValidLocalDateString(fromLocal) || !isValidLocalDateString(toLocal)) {
    throw new Error('Invalid custom period dates');
  }
  if (compareLocalDates(fromLocal, toLocal) > 0) {
    throw new Error('Custom period start must be on or before end');
  }

  return { from: fromLocal, to: toLocal };
}

/**
 * Converts inclusive local-date bounds to half-open UTC ISO range
 * [rangeStartIso, rangeEndIso) for filtering episode `started_at`.
 */
export function periodToUtcHalfOpenRange(bounds: PeriodBounds): {
  rangeStartIso: string | null;
  rangeEndIso: string;
} {
  return periodToUtcHalfOpenRangeWithConverter(bounds, (localDate) =>
    parseLocalDate(localDate).toISOString()
  );
}

/** Testable boundary conversion core; production supplies local-midnight parsing. */
export function periodToUtcHalfOpenRangeWithConverter(
  bounds: PeriodBounds,
  localMidnightToUtcIso: (localDate: string) => string
): { rangeStartIso: string | null; rangeEndIso: string } {
  const rangeEndIso = localMidnightToUtcIso(addDaysToLocalDate(bounds.to, 1));

  if (bounds.from == null) {
    return { rangeStartIso: null, rangeEndIso };
  }

  const rangeStartIso = localMidnightToUtcIso(bounds.from);
  return { rangeStartIso, rangeEndIso };
}

/** Picks frequency bucket unit based on period and span length. */
export function chooseFrequencyBucketUnit(
  period: AnalyticsPeriod,
  bounds: PeriodBounds
): import('@/src/analytics/types').FrequencyBucketUnit {
  if (period === '7d' || period === '14d' || period === '30d') {
    return 'day';
  }
  if (period === '90d') {
    return 'week';
  }

  // "All" — monthly when enough history, otherwise weekly. Callers provide
  // the effective first data date because an all-time PeriodBounds has no
  // configured lower bound.
  if (bounds.from == null) {
    return 'week';
  }

  const start = parseLocalDate(bounds.from).getTime();
  const end = parseLocalDate(bounds.to).getTime();
  const spanDays = Math.max(1, Math.round((end - start) / 86_400_000) + 1);
  return spanDays >= 120 ? 'month' : 'week';
}
