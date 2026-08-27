/**
 * Ordered list of schema migrations and the current target schema version.
 */

import { migration001Initial } from './001_initial';
import { migration002IntensityRecordedIndex } from './002_intensity_recorded_index';
import { migration003CustomFactors } from './003_custom_factors';
import type { Migration } from '../types';

/** All forward migrations in ascending version order. */
export const MIGRATIONS: readonly Migration[] = [
  migration001Initial,
  migration002IntensityRecordedIndex,
  migration003CustomFactors,
];

/** Highest schema version this app build knows how to apply. */
export const CURRENT_SCHEMA_VERSION = 3;
