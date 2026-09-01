/**
 * Loads raw analytics rows from SQLite for a selected period.
 */

import { buildAnalyticsReport, formatFactorRankLabel } from '@/src/analytics/calculations';
import { DEFAULT_ANALYTICS_PERIOD } from '@/src/analytics/constants';
import { getPeriodBounds, periodToUtcHalfOpenRange } from '@/src/analytics/period';
import type {
  AnalyticsInput,
  AnalyticsPeriod,
  AnalyticsReport,
  EpisodeAnalyticsRow,
  MedicationIntakeAnalyticsRow,
  RankedCount,
} from '@/src/analytics/types';
import type { SqlDatabase } from '@/src/db/types';
import { SIDE_LABELS, LOCATION_LABELS, PAIN_CHARACTER_LABELS, SYMPTOM_LABELS } from '@/src/domain/labels';
import { toLocalDateString } from '@/src/utils/localDate';

type EpisodeRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  side: string | null;
};

type IntensityAggRow = {
  episode_id: string;
  avg_intensity: number;
  max_intensity: number;
};

type TagCountRow = {
  code: string;
  custom_label: string | null;
  episode_count: number;
};

type IntakeRow = {
  medication_name_snapshot: string | null;
  effect: string | null;
  taken_at: string;
};

type CheckInRow = {
  local_date: string;
  sleep_quality: string | null;
  stress_level: string | null;
  hydration_level: string | null;
  caffeine_level: string | null;
  meal_pattern: string | null;
  physical_activity: string | null;
};

export class AnalyticsRepository {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Builds a full analytics report for the given period.
   * Uses local calendar dates for boundaries and episode-day attribution.
   */
  buildReport(
    period: AnalyticsPeriod = DEFAULT_ANALYTICS_PERIOD,
    todayLocal: string = toLocalDateString(new Date())
  ): AnalyticsReport {
    const bounds = getPeriodBounds(period, todayLocal);
    const input = this.loadInput(period, bounds);
    return buildAnalyticsReport(input);
  }

  loadInput(
    period: AnalyticsPeriod,
    bounds: import('@/src/analytics/types').PeriodBounds
  ): AnalyticsInput {
    const { rangeStartIso, rangeEndIso } = periodToUtcHalfOpenRange(bounds);
    const episodes = this.loadEpisodes(rangeStartIso, rangeEndIso);

    return {
      period,
      bounds,
      episodes,
      symptoms: this.loadSymptomCounts(rangeStartIso, rangeEndIso),
      painCharacters: this.loadPainCharacterCounts(rangeStartIso, rangeEndIso),
      sides: this.loadSideCounts(rangeStartIso, rangeEndIso),
      locations: this.loadLocationCounts(rangeStartIso, rangeEndIso),
      factors: this.loadFactorCounts(rangeStartIso, rangeEndIso),
      medicationIntakes: this.loadMedicationIntakes(rangeStartIso, rangeEndIso),
      checkIns: this.loadCheckIns(bounds),
    };
  }

  private episodeTimeFilter(
    rangeStartIso: string | null,
    rangeEndIso: string
  ): { sql: string; params: (string | null)[] } {
    if (rangeStartIso == null) {
      return {
        sql: 'he.started_at < ?',
        params: [rangeEndIso],
      };
    }
    return {
      sql: 'he.started_at >= ? AND he.started_at < ?',
      params: [rangeStartIso, rangeEndIso],
    };
  }

  private loadEpisodes(
    rangeStartIso: string | null,
    rangeEndIso: string
  ): EpisodeAnalyticsRow[] {
    const { sql, params } = this.episodeTimeFilter(rangeStartIso, rangeEndIso);
    const rows = this.db.getAll<EpisodeRow>(
      `SELECT id, started_at, ended_at, side
       FROM headache_episodes he
       WHERE ${sql}
       ORDER BY started_at ASC`,
      params
    );

    const intensityMap = this.loadIntensityAggregates(rows.map((r) => r.id));

    return rows.map((row) => {
      const started = new Date(row.started_at);
      const agg = intensityMap.get(row.id);
      return {
        id: row.id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        side: row.side,
        localStartDate: toLocalDateString(started),
        localStartHour: started.getHours(),
        avgIntensity: agg?.avg ?? null,
        maxIntensity: agg?.max ?? null,
      };
    });
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

  private loadSymptomCounts(
    rangeStartIso: string | null,
    rangeEndIso: string
  ): RankedCount[] {
    const { sql, params } = this.episodeTimeFilter(rangeStartIso, rangeEndIso);
    const rows = this.db.getAll<{ code: string; episode_count: number }>(
      `SELECT es.code, COUNT(DISTINCT es.episode_id) AS episode_count
       FROM episode_symptoms es
       JOIN headache_episodes he ON he.id = es.episode_id
       WHERE ${sql}
       GROUP BY es.code`,
      params
    );

    return rows.map((row) => ({
      key: row.code,
      label: SYMPTOM_LABELS[row.code as keyof typeof SYMPTOM_LABELS] ?? row.code,
      episodeCount: row.episode_count,
    }));
  }

  private loadPainCharacterCounts(
    rangeStartIso: string | null,
    rangeEndIso: string
  ): RankedCount[] {
    const { sql, params } = this.episodeTimeFilter(rangeStartIso, rangeEndIso);
    const rows = this.db.getAll<{ code: string; episode_count: number }>(
      `SELECT pc.code, COUNT(DISTINCT pc.episode_id) AS episode_count
       FROM episode_pain_characters pc
       JOIN headache_episodes he ON he.id = pc.episode_id
       WHERE ${sql}
       GROUP BY pc.code`,
      params
    );

    return rows.map((row) => ({
      key: row.code,
      label:
        PAIN_CHARACTER_LABELS[row.code as keyof typeof PAIN_CHARACTER_LABELS] ??
        row.code,
      episodeCount: row.episode_count,
    }));
  }

  private loadSideCounts(
    rangeStartIso: string | null,
    rangeEndIso: string
  ): RankedCount[] {
    const { sql, params } = this.episodeTimeFilter(rangeStartIso, rangeEndIso);
    const rows = this.db.getAll<{ side: string; episode_count: number }>(
      `SELECT he.side, COUNT(*) AS episode_count
       FROM headache_episodes he
       WHERE he.side IS NOT NULL AND ${sql}
       GROUP BY he.side`,
      params
    );

    return rows.map((row) => ({
      key: row.side,
      label: SIDE_LABELS[row.side as keyof typeof SIDE_LABELS] ?? row.side,
      episodeCount: row.episode_count,
    }));
  }

  private loadLocationCounts(
    rangeStartIso: string | null,
    rangeEndIso: string
  ): RankedCount[] {
    const { sql, params } = this.episodeTimeFilter(rangeStartIso, rangeEndIso);
    const rows = this.db.getAll<TagCountRow>(
      `SELECT el.code, el.custom_label, COUNT(DISTINCT el.episode_id) AS episode_count
       FROM episode_locations el
       JOIN headache_episodes he ON he.id = el.episode_id
       WHERE ${sql}
       GROUP BY el.code, el.custom_label`,
      params
    );

    return rows.map((row) => ({
      key: `${row.code}:${row.custom_label ?? ''}`,
      label:
        row.code === 'other' && row.custom_label
          ? row.custom_label
          : LOCATION_LABELS[row.code as keyof typeof LOCATION_LABELS] ?? row.code,
      episodeCount: row.episode_count,
    }));
  }

  private loadFactorCounts(
    rangeStartIso: string | null,
    rangeEndIso: string
  ): RankedCount[] {
    const { sql, params } = this.episodeTimeFilter(rangeStartIso, rangeEndIso);
    const rows = this.db.getAll<TagCountRow & { factor_name: string | null }>(
      `SELECT ef.code, ef.custom_label, cf.name AS factor_name,
              COUNT(DISTINCT ef.episode_id) AS episode_count
       FROM episode_factors ef
       JOIN headache_episodes he ON he.id = ef.episode_id
       LEFT JOIN custom_factors cf ON cf.id = ef.custom_factor_id
       WHERE ${sql}
       GROUP BY ef.code, ef.custom_label, cf.name`,
      params
    );

    return rows.map((row) => ({
      key: `${row.code}:${row.custom_label ?? ''}:${row.factor_name ?? ''}`,
      label: formatFactorRankLabel(
        row.code,
        row.code === 'custom' ? row.factor_name ?? row.custom_label : row.custom_label
      ),
      episodeCount: row.episode_count,
    }));
  }

  private loadMedicationIntakes(
    rangeStartIso: string | null,
    rangeEndIso: string
  ): MedicationIntakeAnalyticsRow[] {
    const params: (string | null)[] = [];
    let timeSql: string;
    if (rangeStartIso == null) {
      timeSql = 'mi.taken_at < ?';
      params.push(rangeEndIso);
    } else {
      timeSql = 'mi.taken_at >= ? AND mi.taken_at < ?';
      params.push(rangeStartIso, rangeEndIso);
    }

    const rows = this.db.getAll<IntakeRow>(
      `SELECT mi.medication_name_snapshot, mi.effect, mi.taken_at
       FROM medication_intakes mi
       WHERE ${timeSql}`,
      params
    );

    return rows.map((row) => ({
      medicationNameSnapshot: row.medication_name_snapshot?.trim() || 'Без названия',
      effect: row.effect as MedicationIntakeAnalyticsRow['effect'],
      takenAt: row.taken_at,
    }));
  }

  private loadCheckIns(
    bounds: import('@/src/analytics/types').PeriodBounds
  ): AnalyticsInput['checkIns'] {
    const from = bounds.from ?? '1970-01-01';
    const rows = this.db.getAll<CheckInRow>(
      `SELECT local_date, sleep_quality, stress_level, hydration_level,
              caffeine_level, meal_pattern, physical_activity
       FROM daily_check_ins
       WHERE local_date >= ? AND local_date <= ?`,
      [from, bounds.to]
    );

    return rows.map((row) => ({
      localDate: row.local_date,
      sleepQuality: row.sleep_quality,
      stressLevel: row.stress_level,
      hydrationLevel: row.hydration_level,
      caffeineLevel: row.caffeine_level,
      mealPattern: row.meal_pattern,
      physicalActivity: row.physical_activity,
    }));
  }
}
