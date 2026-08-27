/**
 * Russian UI labels for persisted domain codes.
 * Never store these strings in SQLite — only the English keys.
 */

import type {
  FactorCode,
  HeadacheSide,
  LocationCode,
  PainCharacterCode,
  SymptomCode,
} from './codes';

export const SIDE_LABELS: Record<HeadacheSide, string> = {
  left: 'Слева',
  right: 'Справа',
  bilateral: 'С обеих сторон',
  whole_head: 'Вся голова',
};

export const LOCATION_LABELS: Record<LocationCode, string> = {
  forehead: 'Лоб',
  temple: 'Висок',
  eye: 'Область глаза',
  back_of_head: 'Затылок',
  top_of_head: 'Темя',
  neck: 'Шея',
  other: 'Другое',
};

export const PAIN_CHARACTER_LABELS: Record<PainCharacterCode, string> = {
  throbbing: 'Пульсирует',
  pressure: 'Давит',
  bursting: 'Распирает',
  pounding: 'Стучит',
  stabbing: 'Колет',
  burning: 'Жжёт',
  shooting: 'Простреливает',
  other: 'Другое',
};

export const SYMPTOM_LABELS: Record<SymptomCode, string> = {
  nausea: 'Тошнота',
  vomiting: 'Рвота',
  photophobia: 'Свет мешает',
  phonophobia: 'Звуки мешают',
  smell_sensitivity: 'Запахи мешают',
  dizziness: 'Головокружение',
  visual_disturbance: 'Нарушение зрения',
  weakness: 'Слабость',
  numbness: 'Онемение',
  aura: 'Аура',
  other: 'Другое',
};

export const FACTOR_LABELS: Record<Exclude<FactorCode, 'custom'>, string> = {
  stress: 'Стресс',
  poor_sleep: 'Недосып',
  oversleep: 'Пересып',
  skipped_meal: 'Пропуск еды',
  dehydration: 'Мало воды',
  alcohol: 'Алкоголь',
  caffeine: 'Кофе / кофеин',
  caffeine_withdrawal: 'Без привычного кофе',
  screen_time: 'Много экрана',
  bright_light: 'Яркий свет',
  noise: 'Шум',
  smell: 'Сильный запах',
  heat: 'Жара',
  physical_activity: 'Физическая нагрузка',
  weather_change: 'Изменение погоды',
  menstrual_cycle: 'Цикл',
};

/** Display label for a factor row (built-in or custom). */
export function factorDisplayLabel(
  code: FactorCode,
  customLabel: string | null | undefined
): string {
  if (code === 'custom') {
    return customLabel?.trim() || 'Свой фактор';
  }
  return FACTOR_LABELS[code];
}
