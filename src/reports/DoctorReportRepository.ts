/**
 * Loads episode-level rows for doctor reports without per-episode N+1 queries.
 */

import type { MedicationEffect } from '@/src/domain/codes';
import {
  LOCATION_LABELS,
  MEDICATION_EFFECT_LABELS,
  MEDICATION_EFFECT_UNRATED_LABEL,
  PAIN_CHARACTER_LABELS,
  SIDE_LABELS,
  SYMPTOM_LABELS,
  factorDisplayLabel,
  medicationDoseLabel,
} from '@/src/domain/labels';
import type {
  DoctorReportEpisode,
  DoctorReportEpisodeMedication,
} from '@/src/reports/types';
import type { SqlDatabase } from '@/src/db/types';
import { periodToUtcHalfOpenRange } from '@/src/analytics/period';
import type { PeriodBounds } from '@/src/analytics/types';
import { toLocalDateString } from '@/src/utils/localDate';

type EpisodeRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  side: string | null;
  notes: string | null;
};

type IntensityAggRow = {
  episode_id: string;
  avg_intensity: number;
  max_intensity: number;
};

type TagRow = {
  episode_id: string;
  code: string;
  custom_label: string | null;
  factor_name?: string | null;
};

type IntakeRow = {
  episode_id: string;
  medication_name_snapshot: string | null;
  dose: string | null;
  unit: string | null;
  effect: string | null;
};

export class DoctorReportRepository {
  constructor(private readonly db: SqlDatabase) {}

  /** Loads chronological episode blocks for the inclusive local-date period. */
  loadEpisodes(bounds: PeriodBounds): DoctorReportEpisode[] {
    const { rangeStartIso, rangeEndIso } = periodToUtcHalfOpenRange(bounds);
    const episodes = this.loadEpisodeRows(rangeStartIso, rangeEndIso);
    if (episodes.length === 0) {
      return [];
    }

    const ids = episodes.map((row) => row.id);
    const intensityMap = this.loadIntensityAggregates(ids);
    const locations = this.groupByEpisode(this.loadLocationRows(ids));
    const painCharacters = this.groupByEpisode(this.loadPainCharacterRows(ids));
    const symptoms = this.groupByEpisode(this.loadSymptomRows(ids));
    const factors = this.groupByEpisode(this.loadFactorRows(ids));
    const medications = this.groupByEpisode(this.loadIntakeRows(ids));

    return episodes.map((row) => {
      const agg = intensityMap.get(row.id);
      const started = new Date(row.started_at);
      return {
        id: row.id,
        localDate: toLocalDateString(started),
        startedAt: row.started_at,
        endedAt: row.ended_at,
        isActive: row.ended_at == null,
        maxIntensity: agg?.max ?? null,
        avgIntensity: agg?.avg ?? null,
        sideLabel: row.side
          ? SIDE_LABELS[row.side as keyof typeof SIDE_LABELS] ?? row.side
          : null,
        locationLabels: (locations.get(row.id) ?? []).map((tag) =>
          tag.code === 'other' && tag.custom_label
            ? tag.custom_label
            : LOCATION_LABELS[tag.code as keyof typeof LOCATION_LABELS] ??
              tag.code
        ),
        painCharacterLabels: (painCharacters.get(row.id) ?? []).map((tag) =>
          tag.code === 'other' && tag.custom_label
            ? tag.custom_label
            : PAIN_CHARACTER_LABELS[
                tag.code as keyof typeof PAIN_CHARACTER_LABELS
              ] ?? tag.code
        ),
        symptomLabels: (symptoms.get(row.id) ?? []).map((tag) =>
          tag.code === 'other' && tag.custom_label
            ? tag.custom_label
            : SYMPTOM_LABELS[tag.code as keyof typeof SYMPTOM_LABELS] ??
              tag.code
        ),
        factorLabels: (factors.get(row.id) ?? []).map((tag) =>
          factorDisplayLabel(
            tag.code as import('@/src/domain/codes').FactorCode,
            tag.code === 'custom'
              ? tag.factor_name ?? tag.custom_label
              : tag.custom_label
          )
        ),
        medications: (medications.get(row.id) ?? []).map((intake) =>
          mapEpisodeMedication(intake)
        ),
        notes: row.notes?.trim() || null,
      };
    });
  }

  private episodeTimeFilter(
    rangeStartIso: string | null,
    rangeEndIso: string
  ): { sql: string; params: (string | null)[] } {
    if (rangeStartIso == null) {
      return { sql: 'he.started_at < ?', params: [rangeEndIso] };
    }
    return {
      sql: 'he.started_at >= ? AND he.started_at < ?',
      params: [rangeStartIso, rangeEndIso],
    };
  }

  private loadEpisodeRows(
    rangeStartIso: string | null,
    rangeEndIso: string
  ): EpisodeRow[] {
    const { sql, params } = this.episodeTimeFilter(rangeStartIso, rangeEndIso);
    return this.db.getAll<EpisodeRow>(
      `SELECT id, started_at, ended_at, side, notes
       FROM headache_episodes he
       WHERE ${sql}
       ORDER BY started_at ASC`,
      params
    );
  }

  private loadIntensityAggregates(
    episodeIds: string[]
  ): Map<string, { avg: number; max: number }> {
    if (episodeIds.length === 0) {
      return new Map();
    }
    const placeholders = episodeIds.map(() => '?').join(',');
    const rows = this.db.getAll<IntensityAggRow>(
      `SELECT episode_id,
              AVG(intensity) AS avg_intensity,
              MAX(intensity) AS max_intensity
       FROM pain_intensity_entries
       WHERE episode_id IN (${placeholders})
       GROUP BY episode_id`,
      episodeIds
    );
    const map = new Map<string, { avg: number; max: number }>();
    for (const row of rows) {
      map.set(row.episode_id, {
        avg: row.avg_intensity,
        max: row.max_intensity,
      });
    }
    return map;
  }

  private loadLocationRows(episodeIds: string[]): TagRow[] {
    return this.loadTagRows(
      episodeIds,
      `SELECT episode_id, code, custom_label
       FROM episode_locations
       WHERE episode_id IN ({placeholders})`
    );
  }

  private loadPainCharacterRows(episodeIds: string[]): TagRow[] {
    return this.loadTagRows(
      episodeIds,
      `SELECT episode_id, code, custom_label
       FROM episode_pain_characters
       WHERE episode_id IN ({placeholders})`
    );
  }

  private loadSymptomRows(episodeIds: string[]): TagRow[] {
    return this.loadTagRows(
      episodeIds,
      `SELECT episode_id, code, custom_label
       FROM episode_symptoms
       WHERE episode_id IN ({placeholders})`
    );
  }

  private loadFactorRows(episodeIds: string[]): TagRow[] {
    return this.loadTagRows(
      episodeIds,
      `SELECT ef.episode_id, ef.code, ef.custom_label, cf.name AS factor_name
       FROM episode_factors ef
       LEFT JOIN custom_factors cf ON cf.id = ef.custom_factor_id
       WHERE ef.episode_id IN ({placeholders})`
    );
  }

  private loadTagRows(episodeIds: string[], sqlTemplate: string): TagRow[] {
    if (episodeIds.length === 0) {
      return [];
    }
    const placeholders = episodeIds.map(() => '?').join(',');
    return this.db.getAll<TagRow>(
      sqlTemplate.replace('{placeholders}', placeholders),
      episodeIds
    );
  }

  private loadIntakeRows(episodeIds: string[]): (IntakeRow & {
    episode_id: string;
  })[] {
    if (episodeIds.length === 0) {
      return [];
    }
    const placeholders = episodeIds.map(() => '?').join(',');
    return this.db.getAll<IntakeRow>(
      `SELECT episode_id, medication_name_snapshot, dose, unit, effect
       FROM medication_intakes
       WHERE episode_id IN (${placeholders})
       ORDER BY taken_at ASC, created_at ASC, id ASC`,
      episodeIds
    );
  }

  private groupByEpisode<T extends { episode_id: string }>(
    rows: T[]
  ): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const list = map.get(row.episode_id) ?? [];
      list.push(row);
      map.set(row.episode_id, list);
    }
    return map;
  }
}

function mapEpisodeMedication(row: IntakeRow): DoctorReportEpisodeMedication {
  const effect = row.effect as MedicationEffect | null;
  return {
    name: row.medication_name_snapshot?.trim() || 'Без названия',
    doseLabel: medicationDoseLabel(row.dose, row.unit),
    effectLabel: effect
      ? MEDICATION_EFFECT_LABELS[effect]
      : MEDICATION_EFFECT_UNRATED_LABEL,
  };
}
