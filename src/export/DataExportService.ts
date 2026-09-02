/**
 * CSV data export for user-owned diary records (separate from doctor PDF).
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { SqlDatabase } from '@/src/db/types';
import {
  FACTOR_LABELS,
  LOCATION_LABELS,
  MEDICATION_EFFECT_LABELS,
  PAIN_CHARACTER_LABELS,
  SIDE_LABELS,
  SYMPTOM_LABELS,
} from '@/src/domain/labels';
import type { FactorCode } from '@/src/domain/codes';

import { buildCsvDocument } from './csv';

export const CSV_SHARE_UNAVAILABLE =
  'Не удалось открыть меню «Поделиться».';

export const CSV_WRITE_ERROR = 'Не удалось сохранить CSV-файл.';

export type CsvExportBundle = {
  episodes: { fileName: string; content: string };
  medicationIntakes: { fileName: string; content: string };
  dailyCheckIns: { fileName: string; content: string };
};

type EpisodeRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  side: string | null;
  notes: string | null;
};

type IntensityAgg = {
  episode_id: string;
  avg_intensity: number | null;
  max_intensity: number | null;
};

type TagRow = {
  episode_id: string;
  code: string;
  custom_label: string | null;
};

type FactorRow = TagRow & { custom_factor_id: string | null };

type IntakeRow = {
  id: string;
  episode_id: string | null;
  taken_at: string;
  medication_name_snapshot: string;
  dose: string | null;
  unit: string | null;
  effect: string | null;
};

type CheckInRow = {
  local_date: string;
  sleep_quality: string | null;
  sleep_duration_minutes: number | null;
  stress_level: string | null;
  hydration_level: string | null;
  caffeine_level: string | null;
  meal_pattern: string | null;
  physical_activity: string | null;
  notes: string | null;
};

const CHECK_IN_LABELS: Record<string, Record<string, string>> = {
  sleep_quality: { bad: 'Плохой', medium: 'Средний', good: 'Хороший' },
  stress_level: { low: 'Низкий', medium: 'Средний', high: 'Высокий' },
  hydration_level: { low: 'Мало', normal: 'Нормально', high: 'Много' },
  caffeine_level: {
    none: 'Нет',
    normal: 'Обычно',
    more_than_usual: 'Больше обычного',
  },
  meal_pattern: { normal: 'Обычно', skipped_meals: 'Пропуски еды' },
  physical_activity: { light: 'Лёгкая', normal: 'Обычная', high: 'Высокая' },
};

export class DataExportService {
  constructor(private readonly db: SqlDatabase) {}

  /** Builds all three CSV documents in memory. */
  buildCsvBundle(): CsvExportBundle {
    const dateStamp = new Date().toISOString().slice(0, 10);
    return {
      episodes: {
        fileName: `episodes-${dateStamp}.csv`,
        content: this.buildEpisodesCsv(),
      },
      medicationIntakes: {
        fileName: `medication-intakes-${dateStamp}.csv`,
        content: this.buildMedicationIntakesCsv(),
      },
      dailyCheckIns: {
        fileName: `daily-checkins-${dateStamp}.csv`,
        content: this.buildDailyCheckInsCsv(),
      },
    };
  }

  /** Writes one CSV to documentDirectory and opens the native share sheet. */
  async shareCsvFile(fileName: string, content: string): Promise<string> {
    const fileUri = await writeTextToDocuments(fileName, content);
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw new Error(CSV_SHARE_UNAVAILABLE);
    }

    try {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: 'Поделиться CSV',
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[DataExportService] shareAsync failed', error);
      }
      throw new Error(CSV_SHARE_UNAVAILABLE);
    }

    return fileUri;
  }

  private buildEpisodesCsv(): string {
    const episodes = this.db.getAll<EpisodeRow>(
      `SELECT id, started_at, ended_at, side, notes
       FROM headache_episodes
       ORDER BY started_at ASC`
    );

    const intensityMap = new Map<string, IntensityAgg>();
    for (const row of this.db.getAll<IntensityAgg>(
      `SELECT episode_id,
              AVG(intensity) AS avg_intensity,
              MAX(intensity) AS max_intensity
       FROM pain_intensity_entries
       GROUP BY episode_id`
    )) {
      intensityMap.set(row.episode_id, row);
    }

    const locations = groupTags(
      this.db.getAll<TagRow>(
        'SELECT episode_id, code, custom_label FROM episode_locations'
      ),
      formatLocationLabel
    );
    const painChars = groupTags(
      this.db.getAll<TagRow>(
        'SELECT episode_id, code, custom_label FROM episode_pain_characters'
      ),
      formatPainCharacterLabel
    );
    const symptoms = groupTags(
      this.db.getAll<TagRow>(
        'SELECT episode_id, code, custom_label FROM episode_symptoms'
      ),
      formatSymptomLabel
    );
    const factors = groupFactorTags(
      this.db.getAll<FactorRow>(
        `SELECT episode_id, code, custom_label, custom_factor_id
         FROM episode_factors`
      )
    );

    const headers = [
      'episode_id',
      'start',
      'end',
      'status',
      'duration_minutes',
      'average_intensity',
      'max_intensity',
      'side',
      'locations',
      'pain_characters',
      'symptoms',
      'factors',
      'notes',
    ];

    const rows = episodes.map((ep) => {
      const agg = intensityMap.get(ep.id);
      const duration =
        ep.ended_at != null
          ? String(
              Math.max(
                0,
                Math.round(
                  (Date.parse(ep.ended_at) - Date.parse(ep.started_at)) / 60000
                )
              )
            )
          : '';

      return [
        ep.id,
        ep.started_at,
        ep.ended_at ?? '',
        ep.ended_at == null ? 'active' : 'completed',
        duration,
        agg?.avg_intensity != null ? formatNumber(agg.avg_intensity) : '',
        agg?.max_intensity != null ? String(agg.max_intensity) : '',
        ep.side ? SIDE_LABELS[ep.side as keyof typeof SIDE_LABELS] ?? ep.side : '',
        locations.get(ep.id) ?? '',
        painChars.get(ep.id) ?? '',
        symptoms.get(ep.id) ?? '',
        factors.get(ep.id) ?? '',
        ep.notes ?? '',
      ];
    });

    return buildCsvDocument(headers, rows);
  }

  private buildMedicationIntakesCsv(): string {
    const intakes = this.db.getAll<IntakeRow>(
      `SELECT id, episode_id, taken_at, medication_name_snapshot, dose, unit, effect
       FROM medication_intakes
       ORDER BY taken_at ASC`
    );

    const headers = [
      'intake_id',
      'episode_id',
      'taken_at',
      'medication_name',
      'dose',
      'unit',
      'effect',
    ];

    const rows = intakes.map((row) => [
      row.id,
      row.episode_id ?? '',
      row.taken_at,
      row.medication_name_snapshot,
      row.dose ?? '',
      row.unit ?? '',
      row.effect
        ? MEDICATION_EFFECT_LABELS[
            row.effect as keyof typeof MEDICATION_EFFECT_LABELS
          ] ?? row.effect
        : '',
    ]);

    return buildCsvDocument(headers, rows);
  }

  private buildDailyCheckInsCsv(): string {
    const checkIns = this.db.getAll<CheckInRow>(
      `SELECT local_date, sleep_quality, sleep_duration_minutes, stress_level,
              hydration_level, caffeine_level, meal_pattern, physical_activity, notes
       FROM daily_check_ins
       ORDER BY local_date ASC`
    );

    const headers = [
      'date',
      'sleep_quality',
      'sleep_duration',
      'stress',
      'hydration',
      'caffeine',
      'meals',
      'physical_activity',
      'notes',
    ];

    const rows = checkIns.map((row) => [
      row.local_date,
      labelCheckIn('sleep_quality', row.sleep_quality),
      row.sleep_duration_minutes != null
        ? String(row.sleep_duration_minutes)
        : '',
      labelCheckIn('stress_level', row.stress_level),
      labelCheckIn('hydration_level', row.hydration_level),
      labelCheckIn('caffeine_level', row.caffeine_level),
      labelCheckIn('meal_pattern', row.meal_pattern),
      labelCheckIn('physical_activity', row.physical_activity),
      row.notes ?? '',
    ]);

    return buildCsvDocument(headers, rows);
  }
}

function groupTags(
  rows: TagRow[],
  format: (row: TagRow) => string
): Map<string, string> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.episode_id) ?? [];
    list.push(format(row));
    map.set(row.episode_id, list);
  }

  const result = new Map<string, string>();
  for (const [episodeId, labels] of map) {
    result.set(episodeId, labels.join(', '));
  }
  return result;
}

function groupFactorTags(rows: FactorRow[]): Map<string, string> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.episode_id) ?? [];
    list.push(formatFactorLabel(row));
    map.set(row.episode_id, list);
  }

  const result = new Map<string, string>();
  for (const [episodeId, labels] of map) {
    result.set(episodeId, labels.join(', '));
  }
  return result;
}

function formatLocationLabel(row: TagRow): string {
  if (row.code === 'other' && row.custom_label) {
    return row.custom_label;
  }
  return LOCATION_LABELS[row.code as keyof typeof LOCATION_LABELS] ?? row.code;
}

function formatPainCharacterLabel(row: TagRow): string {
  if (row.code === 'other' && row.custom_label) {
    return row.custom_label;
  }
  return (
    PAIN_CHARACTER_LABELS[row.code as keyof typeof PAIN_CHARACTER_LABELS] ??
    row.code
  );
}

function formatSymptomLabel(row: TagRow): string {
  if (row.code === 'other' && row.custom_label) {
    return row.custom_label;
  }
  return SYMPTOM_LABELS[row.code as keyof typeof SYMPTOM_LABELS] ?? row.code;
}

function formatFactorLabel(row: FactorRow): string {
  if (row.code === 'custom') {
    return row.custom_label ?? 'Свой фактор';
  }
  return (
    FACTOR_LABELS[row.code as Exclude<FactorCode, 'custom'>] ?? row.code
  );
}

function labelCheckIn(field: string, value: string | null): string {
  if (!value) {
    return '';
  }
  return CHECK_IN_LABELS[field]?.[value] ?? value;
}

function formatNumber(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

async function writeTextToDocuments(
  fileName: string,
  contents: string
): Promise<string> {
  const documentDir = FileSystem.documentDirectory;
  if (!documentDir) {
    throw new Error(CSV_WRITE_ERROR);
  }

  const destUri = `${documentDir}${fileName}`;
  const existing = await FileSystem.getInfoAsync(destUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(destUri, { idempotent: true });
  }
  await FileSystem.writeAsStringAsync(destUri, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return destUri;
}
