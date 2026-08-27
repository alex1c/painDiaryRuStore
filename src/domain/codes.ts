/**
 * Domain code enums / union types for controlled vocabularies.
 * Codes are stored as TEXT in SQLite; custom_label holds free-text when code is "other".
 */

/** Which side of the head is primarily affected during an episode. */
export type HeadacheSide = 'left' | 'right' | 'both' | 'unspecified';

/** Anatomical / region location codes for headache. */
export type LocationCode =
  | 'forehead'
  | 'temple'
  | 'eye'
  | 'crown'
  | 'occiput'
  | 'neck'
  | 'face'
  | 'whole_head'
  | 'other';

/** Qualitative character of the pain sensation. */
export type PainCharacterCode =
  | 'throbbing'
  | 'pressing'
  | 'stabbing'
  | 'burning'
  | 'dull'
  | 'pulsating'
  | 'other';

/** Accompanying symptom codes (not the pain itself). */
export type SymptomCode =
  | 'nausea'
  | 'vomiting'
  | 'photophobia'
  | 'phonophobia'
  | 'aura'
  | 'dizziness'
  | 'fatigue'
  | 'blurred_vision'
  | 'neck_stiffness'
  | 'other';

/**
 * Possible trigger / contributing factor codes.
 * Named "factor" intentionally — these are NOT confirmed medical causes.
 */
export type FactorCode =
  | 'stress'
  | 'lack_of_sleep'
  | 'weather'
  | 'alcohol'
  | 'caffeine'
  | 'skipped_meal'
  | 'screen_time'
  | 'menstruation'
  | 'physical_activity'
  | 'odor'
  | 'other';

/** User-rated effect of a medication intake on the headache. */
export type MedicationEffect =
  | 'helped_a_lot'
  | 'helped_somewhat'
  | 'no_effect'
  | 'made_worse'
  | 'too_early_to_tell';

/** All valid headache side values (runtime guard lists). */
export const HEADACHE_SIDES: readonly HeadacheSide[] = [
  'left',
  'right',
  'both',
  'unspecified',
] as const;

export const LOCATION_CODES: readonly LocationCode[] = [
  'forehead',
  'temple',
  'eye',
  'crown',
  'occiput',
  'neck',
  'face',
  'whole_head',
  'other',
] as const;

export const PAIN_CHARACTER_CODES: readonly PainCharacterCode[] = [
  'throbbing',
  'pressing',
  'stabbing',
  'burning',
  'dull',
  'pulsating',
  'other',
] as const;

export const SYMPTOM_CODES: readonly SymptomCode[] = [
  'nausea',
  'vomiting',
  'photophobia',
  'phonophobia',
  'aura',
  'dizziness',
  'fatigue',
  'blurred_vision',
  'neck_stiffness',
  'other',
] as const;

export const FACTOR_CODES: readonly FactorCode[] = [
  'stress',
  'lack_of_sleep',
  'weather',
  'alcohol',
  'caffeine',
  'skipped_meal',
  'screen_time',
  'menstruation',
  'physical_activity',
  'odor',
  'other',
] as const;

export const MEDICATION_EFFECTS: readonly MedicationEffect[] = [
  'helped_a_lot',
  'helped_somewhat',
  'no_effect',
  'made_worse',
  'too_early_to_tell',
] as const;
