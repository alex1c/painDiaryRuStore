/**
 * Backup JSON parsing, structural validation, and FK integrity checks.
 * Rejects malformed or unsupported backups before any destructive restore.
 */

import {
  CAFFEINE_LEVELS,
  FACTOR_CODES,
  HEADACHE_SIDES,
  HYDRATION_LEVELS,
  LOCATION_CODES,
  MEAL_PATTERNS,
  PAIN_CHARACTER_CODES,
  PHYSICAL_ACTIVITY_LEVELS,
  SLEEP_QUALITIES,
  STRESS_LEVELS,
  SYMPTOM_CODES,
} from '@/src/domain/codes';

import {
  BACKUP_FORMAT,
  MAX_BACKUP_JSON_BYTES,
  MAX_ROWS_PER_TABLE,
  SUPPORTED_BACKUP_VERSION,
} from './constants';
import { BACKUP_TABLE_COLUMNS, BACKUP_TABLE_NAMES } from './tableOrder';
import type {
  BackupDataPayload,
  BackupFile,
  BackupPreview,
  ValidatedBackup,
} from './types';

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/** User-facing validation errors (Russian). */
export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

/** Parses raw JSON text and returns a validated backup ready for restore. */
export function parseAndValidateBackup(rawText: string): ValidatedBackup {
  if (rawText.length > MAX_BACKUP_JSON_BYTES) {
    throw new BackupValidationError(
      'Файл резервной копии слишком большой.'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new BackupValidationError('Файл не является корректным JSON.');
  }

  const file = validateBackupStructure(parsed);
  validateBackupData(file.data);
  const preview = buildPreview(file);

  return { file, preview };
}

/** Validates top-level backup envelope fields. */
export function validateBackupStructure(parsed: unknown): BackupFile {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BackupValidationError('Неверная структура резервной копии.');
  }

  const obj = parsed as Record<string, unknown>;

  assertExactKeys(obj, ['format', 'version', 'exportedAt', 'appVersion', 'data'], 'backup');

  if (obj.format !== BACKUP_FORMAT) {
    throw new BackupValidationError(
      'Это не резервная копия «Дневника головной боли».'
    );
  }

  const version = readRequiredNumber(obj.version, 'version');
  if (version > SUPPORTED_BACKUP_VERSION) {
    throw new BackupValidationError(
      'Эта резервная копия создана более новой версией приложения.'
    );
  }
  if (version < 1) {
    throw new BackupValidationError('Неподдерживаемая версия резервной копии.');
  }

  const exportedAt = readRequiredString(obj.exportedAt, 'exportedAt');
  if (!isIsoTimestamp(exportedAt)) {
    throw new BackupValidationError('Некорректная дата экспорта в копии.');
  }

  const appVersion = readRequiredString(obj.appVersion, 'appVersion');
  if (!obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) {
    throw new BackupValidationError('Отсутствуют данные резервной копии.');
  }

  assertExactKeys(
    obj.data as Record<string, unknown>,
    BACKUP_TABLE_NAMES,
    'data'
  );

  return {
    format: BACKUP_FORMAT,
    version,
    exportedAt,
    appVersion,
    data: obj.data as BackupDataPayload,
  };
}

/** Deep validation of table arrays, enums, IDs, and FK references. */
export function validateBackupData(data: BackupDataPayload): void {
  for (const table of BACKUP_TABLE_NAMES) {
    const rows = (data as Record<string, unknown>)[table];
    if (!Array.isArray(rows)) {
      throw new BackupValidationError(
        `Некорректные данные таблицы: ${table}.`
      );
    }
    if (rows.length > MAX_ROWS_PER_TABLE) {
      throw new BackupValidationError(
        `Слишком много записей в таблице ${table}.`
      );
    }
  }

  const episodeIds = validateEpisodes(data.headache_episodes);
  const medicationIds = validateMedications(data.medications);
  const customFactorIds = validateCustomFactors(data.custom_factors);

  validateIntensityEntries(data.pain_intensity_entries, episodeIds);
  validateEpisodeTags(
    data.episode_locations,
    episodeIds,
    validateLocationRow
  );
  validateEpisodeTags(
    data.episode_pain_characters,
    episodeIds,
    validatePainCharacterRow
  );
  validateEpisodeTags(data.episode_symptoms, episodeIds, validateSymptomRow);
  validateEpisodeFactors(data.episode_factors, episodeIds, customFactorIds);
  validateMedicationIntakes(data.medication_intakes, episodeIds, medicationIds);
  validateDailyCheckIns(data.daily_check_ins);
  validateAppSettings(data.app_settings);
}

/** Builds preview counts for the restore confirmation screen. */
export function buildPreview(file: BackupFile): BackupPreview {
  return {
    episodeCount: file.data.headache_episodes.length,
    medicationCount: file.data.medications.length,
    checkInCount: file.data.daily_check_ins.length,
    exportedAt: file.exportedAt,
    appVersion: file.appVersion,
    backupVersion: file.version,
  };
}

function validateEpisodes(rows: unknown[]): Set<string> {
  const ids = new Set<string>();
  let activeCount = 0;

  for (const row of rows) {
    const r = asRow(row, 'headache_episodes');
    assertRowColumns(r, 'headache_episodes');
    const id = readRequiredString(r.id, 'id');
    assertUniqueId(ids, id, 'headache_episodes');

    readRequiredString(r.started_at, 'started_at');
    assertIso(r.started_at, 'started_at');
    if (r.ended_at !== null && r.ended_at !== undefined) {
      assertIso(r.ended_at, 'ended_at');
    } else {
      activeCount += 1;
    }

    if (r.side !== null && r.side !== undefined) {
      assertEnum(r.side, HEADACHE_SIDES, 'side');
    }
    assertNullableString(r.notes, 'notes');

    readRequiredString(r.created_at, 'created_at');
    readRequiredString(r.updated_at, 'updated_at');
    assertIso(r.created_at, 'created_at');
    assertIso(r.updated_at, 'updated_at');
  }

  if (activeCount > 1) {
    throw new BackupValidationError(
      'В копии более одного активного приступа.'
    );
  }

  return ids;
}

function validateMedications(rows: unknown[]): Set<string> {
  const ids = new Set<string>();

  for (const row of rows) {
    const r = asRow(row, 'medications');
    assertRowColumns(r, 'medications');
    const id = readRequiredString(r.id, 'id');
    assertUniqueId(ids, id, 'medications');
    readRequiredString(r.name, 'name');
    assertNullableString(r.default_dose, 'default_dose');
    assertNullableString(r.unit, 'unit');
    assertNullableString(r.notes, 'notes');
    assertArchivedFlag(r.is_archived, 'is_archived');
    readRequiredString(r.created_at, 'created_at');
    readRequiredString(r.updated_at, 'updated_at');
    assertIso(r.created_at, 'created_at');
    assertIso(r.updated_at, 'updated_at');
  }

  return ids;
}

function validateCustomFactors(rows: unknown[]): Set<string> {
  const ids = new Set<string>();
  const normalized = new Set<string>();

  for (const row of rows) {
    const r = asRow(row, 'custom_factors');
    assertRowColumns(r, 'custom_factors');
    const id = readRequiredString(r.id, 'id');
    assertUniqueId(ids, id, 'custom_factors');
    readRequiredString(r.name, 'name');
    const norm = readRequiredString(r.normalized_name, 'normalized_name');
    if (normalized.has(norm)) {
      throw new BackupValidationError(
        'Дублирующийся пользовательский фактор в копии.'
      );
    }
    normalized.add(norm);
    assertArchivedFlag(r.is_archived, 'is_archived');
    readRequiredString(r.created_at, 'created_at');
    readRequiredString(r.updated_at, 'updated_at');
    assertIso(r.created_at, 'created_at');
    assertIso(r.updated_at, 'updated_at');
  }

  return ids;
}

function validateIntensityEntries(
  rows: unknown[],
  episodeIds: Set<string>
): void {
  const ids = new Set<string>();

  for (const row of rows) {
    const r = asRow(row, 'pain_intensity_entries');
    assertRowColumns(r, 'pain_intensity_entries');
    const id = readRequiredString(r.id, 'id');
    assertUniqueId(ids, id, 'pain_intensity_entries');
    const episodeId = readRequiredString(r.episode_id, 'episode_id');
    assertFk(episodeIds, episodeId, 'episode_id');
    assertIso(r.recorded_at, 'recorded_at');
    const intensity = readRequiredNumber(r.intensity, 'intensity');
    if (!Number.isInteger(intensity) || intensity < 0 || intensity > 10) {
      throw new BackupValidationError('Некорректная интенсивность боли.');
    }
    readRequiredString(r.created_at, 'created_at');
    assertIso(r.created_at, 'created_at');
  }
}

type TagRowValidator = (row: Record<string, unknown>) => void;

function validateEpisodeTags(
  rows: unknown[],
  episodeIds: Set<string>,
  validateFields: TagRowValidator
): void {
  const ids = new Set<string>();
  const logicalRows = new Set<string>();

  for (const row of rows) {
    const r = asRow(row, 'episode tag');
    const id = readRequiredString(r.id, 'id');
    assertUniqueId(ids, id, 'episode tag');
    const episodeId = readRequiredString(r.episode_id, 'episode_id');
    assertFk(episodeIds, episodeId, 'episode_id');
    validateFields(r);
    assertNullableString(r.custom_label, 'custom_label');
    const logicalKey = `${episodeId}\u0000${String(r.code)}\u0000${String(r.custom_label ?? '')}`;
    assertUniqueLogicalRow(logicalRows, logicalKey, 'episode tag');
  }
}

function validateLocationRow(row: Record<string, unknown>): void {
  assertRowColumns(row, 'episode_locations');
  readRequiredString(row.code, 'code');
  assertEnum(row.code, LOCATION_CODES, 'code');
}

function validatePainCharacterRow(row: Record<string, unknown>): void {
  assertRowColumns(row, 'episode_pain_characters');
  readRequiredString(row.code, 'code');
  assertEnum(row.code, PAIN_CHARACTER_CODES, 'code');
}

function validateSymptomRow(row: Record<string, unknown>): void {
  assertRowColumns(row, 'episode_symptoms');
  readRequiredString(row.code, 'code');
  assertEnum(row.code, SYMPTOM_CODES, 'code');
}

function validateEpisodeFactors(
  rows: unknown[],
  episodeIds: Set<string>,
  customFactorIds: Set<string>
): void {
  const ids = new Set<string>();
  const logicalRows = new Set<string>();

  for (const row of rows) {
    const r = asRow(row, 'episode_factors');
    assertRowColumns(r, 'episode_factors');
    const id = readRequiredString(r.id, 'id');
    assertUniqueId(ids, id, 'episode_factors');
    const episodeId = readRequiredString(r.episode_id, 'episode_id');
    assertFk(episodeIds, episodeId, 'episode_id');
    readRequiredString(r.code, 'code');
    assertEnum(r.code, FACTOR_CODES, 'code');
    assertNullableString(r.custom_label, 'custom_label');

    if (r.code === 'custom') {
      const customFactorId = readRequiredString(r.custom_factor_id, 'custom_factor_id');
      assertFk(customFactorIds, customFactorId, 'custom_factor_id');
      readRequiredString(r.custom_label, 'custom_label');
    } else if (r.custom_factor_id !== null) {
      throw new BackupValidationError('Некорректная связь: custom_factor_id.');
    }
    const logicalKey = r.code === 'custom'
      ? `${episodeId}\u0000custom\u0000${String(r.custom_factor_id)}`
      : `${episodeId}\u0000${String(r.code)}`;
    assertUniqueLogicalRow(logicalRows, logicalKey, 'episode_factors');
  }
}

function validateMedicationIntakes(
  rows: unknown[],
  episodeIds: Set<string>,
  medicationIds: Set<string>
): void {
  const ids = new Set<string>();

  for (const row of rows) {
    const r = asRow(row, 'medication_intakes');
    assertRowColumns(r, 'medication_intakes');
    const id = readRequiredString(r.id, 'id');
    assertUniqueId(ids, id, 'medication_intakes');
    const medicationId = readRequiredString(r.medication_id, 'medication_id');
    assertFk(medicationIds, medicationId, 'medication_id');

    if (r.episode_id !== null && r.episode_id !== undefined) {
      assertFk(episodeIds, String(r.episode_id), 'episode_id');
    }

    readRequiredString(r.medication_name_snapshot, 'medication_name_snapshot');
    assertNullableString(r.dose, 'dose');
    assertNullableString(r.unit, 'unit');
    assertIso(r.taken_at, 'taken_at');
    readRequiredString(r.created_at, 'created_at');
    readRequiredString(r.updated_at, 'updated_at');
    assertIso(r.created_at, 'created_at');
    assertIso(r.updated_at, 'updated_at');

    if (r.effect !== null && r.effect !== undefined) {
      readRequiredString(r.effect, 'effect');
      if (r.effect_rated_at === null) {
        throw new BackupValidationError('Отсутствует поле: effect_rated_at.');
      }
      assertIso(r.effect_rated_at, 'effect_rated_at');
    } else if (r.effect_rated_at !== null) {
      throw new BackupValidationError('Некорректная дата/время: effect_rated_at.');
    }
  }
}

function validateDailyCheckIns(rows: unknown[]): void {
  const ids = new Set<string>();
  const dates = new Set<string>();

  for (const row of rows) {
    const r = asRow(row, 'daily_check_ins');
    assertRowColumns(r, 'daily_check_ins');
    const id = readRequiredString(r.id, 'id');
    assertUniqueId(ids, id, 'daily_check_ins');
    const localDate = readRequiredString(r.local_date, 'local_date');
    if (!isLocalDate(localDate)) {
      throw new BackupValidationError('Некорректная дата дневной отметки.');
    }
    if (dates.has(localDate)) {
      throw new BackupValidationError('Дублирующаяся дневная отметка.');
    }
    dates.add(localDate);

    if (r.sleep_quality !== null && r.sleep_quality !== undefined) {
      assertEnum(r.sleep_quality, SLEEP_QUALITIES, 'sleep_quality');
    }
    if (r.stress_level !== null && r.stress_level !== undefined) {
      assertEnum(r.stress_level, STRESS_LEVELS, 'stress_level');
    }
    if (r.hydration_level !== null && r.hydration_level !== undefined) {
      assertEnum(r.hydration_level, HYDRATION_LEVELS, 'hydration_level');
    }
    if (r.caffeine_level !== null && r.caffeine_level !== undefined) {
      assertEnum(r.caffeine_level, CAFFEINE_LEVELS, 'caffeine_level');
    }
    if (r.meal_pattern !== null && r.meal_pattern !== undefined) {
      assertEnum(r.meal_pattern, MEAL_PATTERNS, 'meal_pattern');
    }
    if (
      r.physical_activity !== null &&
      r.physical_activity !== undefined
    ) {
      assertEnum(
        r.physical_activity,
        PHYSICAL_ACTIVITY_LEVELS,
        'physical_activity'
      );
    }

    if (r.sleep_duration_minutes !== null) {
      const duration = readRequiredNumber(r.sleep_duration_minutes, 'sleep_duration_minutes');
      if (!Number.isInteger(duration) || duration < 0 || duration > 24 * 60) {
        throw new BackupValidationError('Некорректное число: sleep_duration_minutes.');
      }
    }
    assertNullableString(r.notes, 'notes');

    readRequiredString(r.created_at, 'created_at');
    readRequiredString(r.updated_at, 'updated_at');
    assertIso(r.created_at, 'created_at');
    assertIso(r.updated_at, 'updated_at');
  }
}

function validateAppSettings(rows: unknown[]): void {
  const keys = new Set<string>();

  for (const row of rows) {
    const r = asRow(row, 'app_settings');
    assertRowColumns(r, 'app_settings');
    const key = readRequiredString(r.key, 'key');
    if (keys.has(key)) {
      throw new BackupValidationError('Дублирующийся ключ настроек.');
    }
    keys.add(key);
    readRequiredString(r.value, 'value');
    readRequiredString(r.updated_at, 'updated_at');
    assertIso(r.updated_at, 'updated_at');
  }
}

function asRow(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BackupValidationError(`Некорректная запись: ${context}.`);
  }
  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BackupValidationError(`Отсутствует поле: ${field}.`);
  }
  return value;
}

function readRequiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BackupValidationError(`Некорректное число: ${field}.`);
  }
  return value;
}

function assertUniqueId(ids: Set<string>, id: string, context: string): void {
  if (ids.has(id)) {
    throw new BackupValidationError(`Дублирующийся идентификатор: ${context}.`);
  }
  ids.add(id);
}

function assertUniqueLogicalRow(
  rows: Set<string>,
  key: string,
  context: string
): void {
  if (rows.has(key)) {
    throw new BackupValidationError(`Дублирующаяся запись: ${context}.`);
  }
  rows.add(key);
}

function assertRowColumns(
  row: Record<string, unknown>,
  table: keyof BackupDataPayload
): void {
  assertExactKeys(row, BACKUP_TABLE_COLUMNS[table], table);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  context: string
): void {
  const expectedSet = new Set(expected);
  const actual = Object.keys(value);
  if (
    actual.length !== expected.length ||
    actual.some((key) => !expectedSet.has(key))
  ) {
    throw new BackupValidationError(`Некорректные поля: ${context}.`);
  }
}

function assertNullableString(value: unknown, field: string): void {
  if (value !== null && typeof value !== 'string') {
    throw new BackupValidationError(`Некорректное поле: ${field}.`);
  }
}

function assertFk(
  parentIds: Set<string>,
  childId: string,
  field: string
): void {
  if (!parentIds.has(childId)) {
    throw new BackupValidationError(`Некорректная ссылка: ${field}.`);
  }
}

function assertEnum(
  value: unknown,
  allowed: readonly string[],
  field: string
): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new BackupValidationError(`Недопустимое значение: ${field}.`);
  }
}

function assertArchivedFlag(value: unknown, field: string): void {
  if (value !== 0 && value !== 1 && value !== true && value !== false) {
    throw new BackupValidationError(`Некорректный флаг архива: ${field}.`);
  }
}

function assertIso(value: unknown, field: string): void {
  if (typeof value !== 'string' || !isIsoTimestamp(value)) {
    throw new BackupValidationError(`Некорректная дата/время: ${field}.`);
  }
}

function isIsoTimestamp(value: string): boolean {
  if (!ISO_RE.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

function isLocalDate(value: string): boolean {
  if (!LOCAL_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
