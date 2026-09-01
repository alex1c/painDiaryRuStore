/**
 * Russian UI labels for persisted domain codes.
 * Never store these strings in SQLite — only the English keys.
 */

import type {
  CaffeineLevel,
  FactorCode,
  HeadacheSide,
  HydrationLevel,
  LocationCode,
  MealPattern,
  MedicationEffect,
  PainCharacterCode,
  PhysicalActivityLevel,
  SleepQuality,
  StressLevel,
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

export const MEDICATION_EFFECT_LABELS: Record<MedicationEffect, string> = {
  helped_a_lot: 'Помогло',
  helped_somewhat: 'Немного помогло',
  no_effect: 'Не помогло',
  made_worse: 'Стало хуже',
  too_early_to_tell: 'Рано судить',
};

/** Label when the user has not rated effect yet. */
export const MEDICATION_EFFECT_UNRATED_LABEL = 'Не оценено';

/** Display dose string from intake or catalog fields (dose is free-text). */
export function medicationDoseLabel(
  dose: string | null | undefined,
  unit: string | null | undefined
): string | null {
  const trimmedDose = dose?.trim();
  const trimmedUnit = unit?.trim();
  if (trimmedDose && trimmedUnit) {
    return `${trimmedDose} ${trimmedUnit}`;
  }
  return trimmedDose || trimmedUnit || null;
}

/** Display label for effect rating (null → not rated). */
export function medicationEffectLabel(
  effect: MedicationEffect | null | undefined
): string {
  if (effect == null) {
    return MEDICATION_EFFECT_UNRATED_LABEL;
  }
  return MEDICATION_EFFECT_LABELS[effect];
}

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

export const SLEEP_QUALITY_LABELS: Record<SleepQuality, string> = {
  bad: 'Плохо',
  medium: 'Средне',
  good: 'Хорошо',
};

export const STRESS_LEVEL_LABELS: Record<StressLevel, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

export const HYDRATION_LEVEL_LABELS: Record<HydrationLevel, string> = {
  low: 'Мало',
  normal: 'Обычно',
  high: 'Много',
};

export const CAFFEINE_LEVEL_LABELS: Record<CaffeineLevel, string> = {
  none: 'Нет',
  normal: 'Обычно',
  more_than_usual: 'Больше обычного',
};

export const MEAL_PATTERN_LABELS: Record<MealPattern, string> = {
  normal: 'Обычно',
  skipped_meals: 'Пропускал(а) еду',
};

export const PHYSICAL_ACTIVITY_LABELS: Record<PhysicalActivityLevel, string> = {
  light: 'Нет / лёгкая',
  normal: 'Обычная',
  high: 'Высокая',
};
