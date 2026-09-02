/**
 * Assembles the doctor report model from analytics + episode details.
 */

import type { AnalyticsRepository } from '@/src/analytics/AnalyticsRepository';
import {
  formatReportPeriodLabel,
  reportPresetToAnalyticsPeriod,
  resolveReportPeriod,
} from '@/src/reports/period';
import { REPORT_TITLE } from '@/src/reports/constants';
import type { DoctorReportRepository } from '@/src/reports/DoctorReportRepository';
import type {
  DoctorReport,
  DoctorReportPreview,
  ReportPeriodPreset,
} from '@/src/reports/types';

type BuildDoctorReportParams = {
  preset: ReportPeriodPreset;
  todayLocal: string;
  customFrom?: string;
  customTo?: string;
  generatedAtIso?: string;
};

/**
 * Builds the full doctor report for PDF rendering and on-screen preview.
 * Summary metrics reuse Phase 6 analytics semantics for consistency.
 */
export function buildDoctorReport(
  analyticsRepository: AnalyticsRepository,
  doctorReportRepository: DoctorReportRepository,
  params: BuildDoctorReportParams
): DoctorReport {
  const selection = resolveReportPeriod(
    params.preset,
    params.todayLocal,
    params.customFrom,
    params.customTo
  );

  const analyticsPeriod =
    params.preset === 'custom'
      ? 'custom'
      : reportPresetToAnalyticsPeriod(params.preset);

  const analytics = analyticsRepository.buildReportForBounds(
    selection.bounds,
    analyticsPeriod
  );
  const episodes = doctorReportRepository.loadEpisodes(selection.bounds);
  const periodLabel = formatReportPeriodLabel(selection.bounds);

  const preview: DoctorReportPreview = {
    periodLabel,
    episodeCount: analytics.overview.episodeCount,
    headacheDayCount: analytics.overview.headacheDayCount,
    hasEpisodes: analytics.overview.episodeCount > 0,
  };

  return {
    title: REPORT_TITLE,
    periodLabel,
    bounds: selection.bounds,
    generatedAtIso: params.generatedAtIso ?? new Date().toISOString(),
    analytics,
    episodes,
    preview,
  };
}
