/**
 * Doctor report UI labels and copy.
 */

import type { ReportPeriodPreset } from '@/src/reports/types';

/** Russian labels for report period chips. */
export const REPORT_PERIOD_LABELS: Record<ReportPeriodPreset, string> = {
  '7d': '7 дней',
  '14d': '14 дней',
  '30d': '30 дней',
  '90d': '90 дней',
  custom: 'Свой период',
};

/** Default preset when opening the doctor report screen. */
export const DEFAULT_REPORT_PERIOD: ReportPeriodPreset = '30d';

export const REPORT_TITLE = 'Дневник головной боли';

export const REPORT_FACTOR_DISCLAIMER =
  'Это совпадения в записях, а не доказанные причины.';

export const REPORT_OBSERVATIONS_TITLE = 'Наблюдения по дневным отметкам';

export const REPORT_INSUFFICIENT_OBSERVATIONS =
  'Недостаточно данных для сравнения.';

export const REPORT_NO_EPISODES_MESSAGE =
  'За выбранный период приступов не отмечено.';

export const REPORT_GENERATION_ERROR =
  'Не удалось создать отчёт. Попробуйте ещё раз.';

export const REPORT_SHARE_UNAVAILABLE =
  'На этом устройстве нельзя поделиться файлом.';

export const REPORT_INVALID_RANGE_MESSAGE =
  'Дата начала не может быть позже даты окончания.';
