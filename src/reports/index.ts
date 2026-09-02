export { buildDoctorReport } from '@/src/reports/buildDoctorReport';
export {
  DEFAULT_REPORT_PERIOD,
  REPORT_GENERATION_ERROR,
  REPORT_INVALID_RANGE_MESSAGE,
  REPORT_NO_EPISODES_MESSAGE,
  REPORT_PERIOD_LABELS,
  REPORT_SHARE_UNAVAILABLE,
  REPORT_TITLE,
} from '@/src/reports/constants';
export { DoctorReportRepository } from '@/src/reports/DoctorReportRepository';
export { DoctorReportService } from '@/src/reports/DoctorReportService';
export { escapeHtml } from '@/src/reports/escapeHtml';
export {
  buildReportFileName,
  formatReportLocalDate,
  formatReportPeriodLabel,
  reportPresetLabel,
  resolveReportPeriod,
  validateCustomReportRange,
} from '@/src/reports/period';
export { renderDoctorReportHtml } from '@/src/reports/renderDoctorReportHtml';
export type {
  DoctorReport,
  DoctorReportEpisode,
  DoctorReportPdfResult,
  DoctorReportPreview,
  ReportPeriodPreset,
} from '@/src/reports/types';
