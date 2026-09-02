/**
 * Report period resolution — maps presets/custom dates to analytics bounds.
 */

import { getCustomPeriodBounds, getPeriodBounds } from '@/src/analytics/period';
import type { AnalyticsPeriod, PeriodBounds } from '@/src/analytics/types';
import { REPORT_PERIOD_LABELS } from '@/src/reports/constants';
import type { ReportPeriodPreset, ReportPeriodSelection } from '@/src/reports/types';
import {
  compareLocalDates,
  isValidLocalDateString,
  parseLocalDate,
} from '@/src/utils/localDate';

/** Maps a report preset to the analytics period key used for frequency bucketing. */
export function reportPresetToAnalyticsPeriod(
  preset: Exclude<ReportPeriodPreset, 'custom'>
): AnalyticsPeriod {
  return preset;
}

/**
 * Resolves inclusive local-date bounds for a report preset or custom range.
 * Throws when custom dates are invalid or inverted.
 */
export function resolveReportPeriod(
  preset: ReportPeriodPreset,
  todayLocal: string,
  customFrom?: string,
  customTo?: string
): ReportPeriodSelection {
  if (preset === 'custom') {
    if (!customFrom || !customTo) {
      throw new Error('Custom period requires from and to dates');
    }
    return {
      preset,
      bounds: getCustomPeriodBounds(customFrom, customTo),
    };
  }

  const analyticsPeriod = reportPresetToAnalyticsPeriod(preset);
  return {
    preset,
    bounds: getPeriodBounds(analyticsPeriod, todayLocal),
  };
}

/** Human-readable inclusive period label for UI and PDF header. */
export function formatReportPeriodLabel(bounds: PeriodBounds): string {
  const fromLabel = bounds.from
    ? formatReportLocalDate(bounds.from)
    : 'начало записей';
  const toLabel = formatReportLocalDate(bounds.to);
  return `${fromLabel} — ${toLabel}`;
}

/** Formats YYYY-MM-DD as DD.MM.YYYY for Russian reports. */
export function formatReportLocalDate(localDate: string): string {
  const [year, month, day] = localDate.split('-');
  return `${day}.${month}.${year}`;
}

/** Formats generation timestamp for the PDF footer. */
export function formatReportGeneratedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Validates custom range before resolving; returns Russian error or null. */
export function validateCustomReportRange(
  fromLocal: string,
  toLocal: string
): string | null {
  if (!isValidLocalDateString(fromLocal) || !isValidLocalDateString(toLocal)) {
    return 'Укажите корректные даты периода.';
  }
  if (compareLocalDates(fromLocal, toLocal) > 0) {
    return 'Дата начала не может быть позже даты окончания.';
  }
  return null;
}

/** Safe PDF/cache file name without invalid path characters. */
export function buildReportFileName(bounds: PeriodBounds): string {
  const from = bounds.from ?? 'all';
  const to = bounds.to;
  return `headache-report-${from}-${to}.pdf`;
}

/** Chip label for a preset (custom uses dynamic bounds in UI). */
export function reportPresetLabel(preset: ReportPeriodPreset): string {
  return REPORT_PERIOD_LABELS[preset];
}

/** Returns span in inclusive local calendar days. */
export function inclusiveLocalDaySpan(bounds: PeriodBounds): number {
  const from = bounds.from ?? bounds.to;
  const start = parseLocalDate(from).getTime();
  const end = parseLocalDate(bounds.to).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}
