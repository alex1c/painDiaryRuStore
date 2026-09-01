/**
 * Ordered list of schema migrations and the current target schema version.
 */

import { migration001Initial } from './001_initial';
import { migration002IntensityRecordedIndex } from './002_intensity_recorded_index';
import { migration003CustomFactors } from './003_custom_factors';
import { migration004MedicationIntakeSnapshots } from './004_medication_intake_snapshots';
import { migration005MedicationIntakeEpisodeCascade } from './005_medication_intake_episode_cascade';
import { migration006DailyCheckInPhase5 } from './006_daily_checkin_phase5';
import type { Migration } from '../types';

/** All forward migrations in ascending version order. */
export const MIGRATIONS: readonly Migration[] = [
  migration001Initial,
  migration002IntensityRecordedIndex,
  migration003CustomFactors,
  migration004MedicationIntakeSnapshots,
  migration005MedicationIntakeEpisodeCascade,
  migration006DailyCheckInPhase5,
];

/** Highest schema version this app build knows how to apply. */
export const CURRENT_SCHEMA_VERSION = 6;
