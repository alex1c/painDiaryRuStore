/**
 * Doctor report domain models — local PDF/share export (Phase 7).
 */

import type { AnalyticsReport, PeriodBounds } from '@/src/analytics/types';

/** Preset windows available on the doctor-report screen. */
export type ReportPeriodPreset =
  | '7d'
  | '14d'
  | '30d'
  | '90d'
  | 'custom';

/** Resolved period selection for building a report. */
export type ReportPeriodSelection = {
  preset: ReportPeriodPreset;
  bounds: PeriodBounds;
};

/** One medication intake line inside an episode block. */
export type DoctorReportEpisodeMedication = {
  name: string;
  doseLabel: string | null;
  effectLabel: string;
};

/** Chronological episode row for the doctor-facing section. */
export type DoctorReportEpisode = {
  id: string;
  localDate: string;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
  maxIntensity: number | null;
  avgIntensity: number | null;
  sideLabel: string | null;
  locationLabels: string[];
  painCharacterLabels: string[];
  symptomLabels: string[];
  factorLabels: string[];
  medications: DoctorReportEpisodeMedication[];
  notes: string | null;
};

/** Lightweight preview counts shown before PDF generation. */
export type DoctorReportPreview = {
  periodLabel: string;
  episodeCount: number;
  headacheDayCount: number;
  hasEpisodes: boolean;
};

/** Full report model passed to the HTML renderer. */
export type DoctorReport = {
  title: string;
  periodLabel: string;
  bounds: PeriodBounds;
  generatedAtIso: string;
  analytics: AnalyticsReport;
  episodes: DoctorReportEpisode[];
  preview: DoctorReportPreview;
};

/** Result of PDF generation on device. */
export type DoctorReportPdfResult = {
  fileUri: string;
  fileName: string;
};
