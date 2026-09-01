/**
 * Domain code enums / union types for controlled vocabularies.
 * Persisted keys are stable English snake_case; UI labels live in labels.ts.
 * custom_label / custom factors hold free-text when needed.
 */

/** Side of the head (single-select on an episode). */
export type HeadacheSide = 'left' | 'right' | 'bilateral' | 'whole_head';

/** Anatomical region location codes (multi-select). */
export type LocationCode =
  | 'forehead'
  | 'temple'
  | 'eye'
  | 'back_of_head'
  | 'top_of_head'
  | 'neck'
  | 'other';

/** Qualitative character of the pain sensation (multi-select). */
export type PainCharacterCode =
  | 'throbbing'
  | 'pressure'
  | 'bursting'
  | 'pounding'
  | 'stabbing'
  | 'burning'
  | 'shooting'
  | 'other';

/** Accompanying symptom codes (multi-select; observation only, not diagnosis). */
export type SymptomCode =
  | 'nausea'
  | 'vomiting'
  | 'photophobia'
  | 'phonophobia'
  | 'smell_sensitivity'
  | 'dizziness'
  | 'visual_disturbance'
  | 'weakness'
  | 'numbness'
  | 'aura'
  | 'other';

/**
 * Built-in possible trigger / factor codes.
 * Named "factor" intentionally — NOT confirmed medical causes.
 * `custom` marks a reusable user-defined factor (see custom_factors table).
 */
export type FactorCode =
  | 'stress'
  | 'poor_sleep'
  | 'oversleep'
  | 'skipped_meal'
  | 'dehydration'
  | 'alcohol'
  | 'caffeine'
  | 'caffeine_withdrawal'
  | 'screen_time'
  | 'bright_light'
  | 'noise'
  | 'smell'
  | 'heat'
  | 'physical_activity'
  | 'weather_change'
  | 'menstrual_cycle'
  | 'custom';

/** User-rated effect of a medication intake (Phase 1 foundation; UI later). */
export type MedicationEffect =
  | 'helped_a_lot'
  | 'helped_somewhat'
  | 'no_effect'
  | 'made_worse'
  | 'too_early_to_tell';

export const HEADACHE_SIDES: readonly HeadacheSide[] = [
  'left',
  'right',
  'bilateral',
  'whole_head',
] as const;

export const LOCATION_CODES: readonly LocationCode[] = [
  'forehead',
  'temple',
  'eye',
  'back_of_head',
  'top_of_head',
  'neck',
  'other',
] as const;

export const PAIN_CHARACTER_CODES: readonly PainCharacterCode[] = [
  'throbbing',
  'pressure',
  'bursting',
  'pounding',
  'stabbing',
  'burning',
  'shooting',
  'other',
] as const;

export const SYMPTOM_CODES: readonly SymptomCode[] = [
  'nausea',
  'vomiting',
  'photophobia',
  'phonophobia',
  'smell_sensitivity',
  'dizziness',
  'visual_disturbance',
  'weakness',
  'numbness',
  'aura',
  'other',
] as const;

/** Built-in factors shown in UI (excludes `custom`, which is user-defined). */
export const BUILT_IN_FACTOR_CODES: readonly Exclude<FactorCode, 'custom'>[] = [
  'stress',
  'poor_sleep',
  'oversleep',
  'skipped_meal',
  'dehydration',
  'alcohol',
  'caffeine',
  'caffeine_withdrawal',
  'screen_time',
  'bright_light',
  'noise',
  'smell',
  'heat',
  'physical_activity',
  'weather_change',
  'menstrual_cycle',
] as const;

export const FACTOR_CODES: readonly FactorCode[] = [
  ...BUILT_IN_FACTOR_CODES,
  'custom',
] as const;

export const MEDICATION_EFFECTS: readonly MedicationEffect[] = [
  'helped_a_lot',
  'helped_somewhat',
  'no_effect',
  'made_worse',
  'too_early_to_tell',
] as const;

/** Phase 4 UI — subjective effect rating chips (excludes legacy / clinical codes). */
export const UI_MEDICATION_EFFECTS: readonly MedicationEffect[] = [
  'no_effect',
  'helped_somewhat',
  'helped_a_lot',
] as const;

/** UI-only grouping for factor chips (not persisted). */
export const FACTOR_UI_GROUPS: readonly {
  title: string;
  codes: readonly Exclude<FactorCode, 'custom'>[];
}[] = [
  {
    title: 'Режим',
    codes: ['poor_sleep', 'oversleep', 'skipped_meal', 'dehydration'],
  },
  {
    title: 'Нагрузка',
    codes: ['stress', 'screen_time', 'physical_activity'],
  },
  {
    title: 'Окружение',
    codes: ['bright_light', 'noise', 'smell', 'heat', 'weather_change'],
  },
  {
    title: 'Еда и напитки',
    codes: ['alcohol', 'caffeine', 'caffeine_withdrawal'],
  },
  {
    title: 'Другое',
    codes: ['menstrual_cycle'],
  },
] as const;

/** Subjective sleep quality for daily check-in (optional). */
export type SleepQuality = 'bad' | 'medium' | 'good';

/** Stress level for daily check-in (optional). */
export type StressLevel = 'low' | 'medium' | 'high';

/** Subjective hydration for daily check-in (optional). */
export type HydrationLevel = 'low' | 'normal' | 'high';

/** Caffeine intake relative to personal baseline (optional). */
export type CaffeineLevel = 'none' | 'normal' | 'more_than_usual';

/** Meal pattern for daily check-in (optional). */
export type MealPattern = 'normal' | 'skipped_meals';

/** Physical activity level for daily check-in (optional). */
export type PhysicalActivityLevel = 'light' | 'normal' | 'high';

export const SLEEP_QUALITIES: readonly SleepQuality[] = [
  'bad',
  'medium',
  'good',
] as const;

export const STRESS_LEVELS: readonly StressLevel[] = [
  'low',
  'medium',
  'high',
] as const;

export const HYDRATION_LEVELS: readonly HydrationLevel[] = [
  'low',
  'normal',
  'high',
] as const;

export const CAFFEINE_LEVELS: readonly CaffeineLevel[] = [
  'none',
  'normal',
  'more_than_usual',
] as const;

export const MEAL_PATTERNS: readonly MealPattern[] = [
  'normal',
  'skipped_meals',
] as const;

export const PHYSICAL_ACTIVITY_LEVELS: readonly PhysicalActivityLevel[] = [
  'light',
  'normal',
  'high',
] as const;
