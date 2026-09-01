/**
 * Phase 6 analytics calculation and repository tests.
 */

import initSqlJs from 'sql.js';

import { AnalyticsRepository } from '@/src/analytics/AnalyticsRepository';
import {
  buildAnalyticsReport,
  buildCheckInBuckets,
  collectHeadacheDays,
  localHourToTimeOfDayBucket,
  tryBuildObservation,
} from '@/src/analytics/calculations';
import {
  MIN_CHECKIN_DAYS_FOR_COMPARISON,
  MIN_PATTERN_RATE_DIFF_PP,
} from '@/src/analytics/constants';
import { getPeriodBounds, periodToUtcHalfOpenRange } from '@/src/analytics/period';
import type { AnalyticsInput, EpisodeAnalyticsRow } from '@/src/analytics/types';
import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { CustomFactorRepository } from '@/src/repositories/CustomFactorRepository';
import { DailyCheckInRepository } from '@/src/repositories/DailyCheckInRepository';
import { HeadacheRepository } from '@/src/repositories/HeadacheRepository';
import { MedicationRepository } from '@/src/repositories/MedicationRepository';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

function episodeRow(
  partial: Partial<EpisodeAnalyticsRow> & Pick<EpisodeAnalyticsRow, 'id' | 'startedAt'>
): EpisodeAnalyticsRow {
  const started = new Date(partial.startedAt);
  return {
    endedAt: null,
    side: null,
    localStartDate: partial.localStartDate ?? started.toISOString().slice(0, 10),
    localStartHour: partial.localStartHour ?? started.getUTCHours(),
    avgIntensity: null,
    maxIntensity: null,
    ...partial,
  };
}

function emptyInput(overrides: Partial<AnalyticsInput> = {}): AnalyticsInput {
  return {
    period: '30d',
    bounds: { from: '2024-06-01', to: '2024-06-30' },
    episodes: [],
    symptoms: [],
    painCharacters: [],
    sides: [],
    locations: [],
    factors: [],
    medicationIntakes: [],
    checkIns: [],
    ...overrides,
  };
}

describe('analytics period boundaries', () => {
  test('Q 30-day window includes today + previous 29 local dates', () => {
    const bounds = getPeriodBounds('30d', '2024-06-30');
    expect(bounds).toEqual({ from: '2024-06-01', to: '2024-06-30' });
  });

  test('Q 7-day and 90-day windows', () => {
    expect(getPeriodBounds('7d', '2024-06-07')).toEqual({
      from: '2024-06-01',
      to: '2024-06-07',
    });
    expect(getPeriodBounds('90d', '2024-03-31')).toEqual({
      from: '2024-01-02',
      to: '2024-03-31',
    });
  });

  test('Q all-time has null lower bound', () => {
    expect(getPeriodBounds('all', '2024-06-30')).toEqual({
      from: null,
      to: '2024-06-30',
    });
  });

  test('Q UTC half-open range uses local midnight boundaries', () => {
    const { rangeStartIso, rangeEndIso } = periodToUtcHalfOpenRange({
      from: '2024-06-01',
      to: '2024-06-01',
    });
    expect(rangeStartIso).toBeTruthy();
    expect(rangeEndIso).toBeTruthy();
    expect(rangeStartIso!).not.toBe(rangeEndIso);
  });
});

describe('analytics calculations', () => {
  test('A empty analytics when no episodes', () => {
    const report = buildAnalyticsReport(emptyInput());
    expect(report.isEmpty).toBe(true);
    expect(report.overview.episodeCount).toBe(0);
    expect(report.overview.headacheDayCount).toBe(0);
  });

  test('B episode count', () => {
    const report = buildAnalyticsReport(
      emptyInput({
        episodes: [
          episodeRow({ id: 'a', startedAt: '2024-06-01T10:00:00.000Z' }),
          episodeRow({ id: 'b', startedAt: '2024-06-02T10:00:00.000Z' }),
        ],
      })
    );
    expect(report.overview.episodeCount).toBe(2);
  });

  test('C headache-day count with multiple episodes same day', () => {
    const episodes = [
      episodeRow({
        id: 'a',
        startedAt: '2024-06-01T08:00:00.000Z',
        localStartDate: '2024-06-01',
      }),
      episodeRow({
        id: 'b',
        startedAt: '2024-06-01T18:00:00.000Z',
        localStartDate: '2024-06-01',
      }),
      episodeRow({
        id: 'c',
        startedAt: '2024-06-02T10:00:00.000Z',
        localStartDate: '2024-06-02',
      }),
    ];
    expect(collectHeadacheDays(episodes).size).toBe(2);
    const report = buildAnalyticsReport(emptyInput({ episodes }));
    expect(report.overview.episodeCount).toBe(3);
    expect(report.overview.headacheDayCount).toBe(2);
  });

  test('D representative average intensity uses per-episode mean', () => {
    const report = buildAnalyticsReport(
      emptyInput({
        episodes: [
          episodeRow({
            id: 'a',
            startedAt: '2024-06-01T10:00:00.000Z',
            avgIntensity: 4,
            maxIntensity: 6,
          }),
          episodeRow({
            id: 'b',
            startedAt: '2024-06-02T10:00:00.000Z',
            avgIntensity: 8,
            maxIntensity: 9,
          }),
        ],
      })
    );
    expect(report.overview.averageIntensity).toBe(6);
  });

  test('E maximum intensity across episodes', () => {
    const report = buildAnalyticsReport(
      emptyInput({
        episodes: [
          episodeRow({
            id: 'a',
            startedAt: '2024-06-01T10:00:00.000Z',
            avgIntensity: 4,
            maxIntensity: 7,
          }),
          episodeRow({
            id: 'b',
            startedAt: '2024-06-02T10:00:00.000Z',
            avgIntensity: 6,
            maxIntensity: 9,
          }),
        ],
      })
    );
    expect(report.overview.maxIntensity).toBe(9);
  });

  test('F completed duration excludes active episode', () => {
    const report = buildAnalyticsReport(
      emptyInput({
        episodes: [
          episodeRow({
            id: 'a',
            startedAt: '2024-06-01T10:00:00.000Z',
            endedAt: '2024-06-01T12:00:00.000Z',
          }),
          episodeRow({
            id: 'b',
            startedAt: '2024-06-02T10:00:00.000Z',
            endedAt: null,
          }),
        ],
      })
    );
    expect(report.duration.hasCompletedEpisodes).toBe(true);
    expect(report.duration.averageMs).toBe(7_200_000);
    expect(report.duration.longestMs).toBe(7_200_000);
  });

  test('G time-of-day buckets', () => {
    expect(localHourToTimeOfDayBucket(2)).toBe('night');
    expect(localHourToTimeOfDayBucket(8)).toBe('morning');
    expect(localHourToTimeOfDayBucket(14)).toBe('day');
    expect(localHourToTimeOfDayBucket(20)).toBe('evening');
  });

  test('H symptom ranking by episode count', () => {
    const report = buildAnalyticsReport(
      emptyInput({
        episodes: [episodeRow({ id: 'a', startedAt: '2024-06-01T10:00:00.000Z' })],
        symptoms: [
          { key: 'photophobia', label: 'Свет мешает', episodeCount: 8 },
          { key: 'nausea', label: 'Тошнота', episodeCount: 5 },
        ],
      })
    );
    expect(report.symptoms[0]?.key).toBe('photophobia');
    expect(report.symptoms[1]?.key).toBe('nausea');
  });

  test('I pain character ranking', () => {
    const report = buildAnalyticsReport(
      emptyInput({
        episodes: [episodeRow({ id: 'a', startedAt: '2024-06-01T10:00:00.000Z' })],
        painCharacters: [
          { key: 'pressure', label: 'Давит', episodeCount: 3 },
          { key: 'throbbing', label: 'Пульсирует', episodeCount: 7 },
        ],
      })
    );
    expect(report.painCharacters[0]?.key).toBe('throbbing');
  });

  test('J factor ranking', () => {
    const report = buildAnalyticsReport(
      emptyInput({
        episodes: [episodeRow({ id: 'a', startedAt: '2024-06-01T10:00:00.000Z' })],
        factors: [
          { key: 'stress', label: 'Стресс', episodeCount: 4 },
          { key: 'poor_sleep', label: 'Недосып', episodeCount: 2 },
        ],
      })
    );
    expect(report.factors[0]?.key).toBe('stress');
  });

  test('K custom factor ranking uses display label', () => {
    const report = buildAnalyticsReport(
      emptyInput({
        episodes: [episodeRow({ id: 'a', startedAt: '2024-06-01T10:00:00.000Z' })],
        factors: [
          { key: 'custom:Шоколад', label: 'Шоколад', episodeCount: 3 },
        ],
      })
    );
    expect(report.factors[0]?.label).toBe('Шоколад');
  });

  test('L medication counts and effect breakdown', () => {
    const report = buildAnalyticsReport(
      emptyInput({
        episodes: [episodeRow({ id: 'a', startedAt: '2024-06-01T10:00:00.000Z' })],
        medicationIntakes: [
          {
            medicationNameSnapshot: 'Ибупрофен',
            effect: 'helped_a_lot',
            takenAt: '2024-06-01T11:00:00.000Z',
          },
          {
            medicationNameSnapshot: 'Ибупрофен',
            effect: null,
            takenAt: '2024-06-02T11:00:00.000Z',
          },
        ],
      })
    );
    expect(report.medications).toHaveLength(1);
    expect(report.medications[0]?.intakeCount).toBe(2);
    expect(report.medications[0]?.helpedALot).toBe(1);
    expect(report.medications[0]?.unrated).toBe(1);
  });

  test('M check-in day joined to episode-start local date', () => {
    const headacheDays = new Set(['2024-06-01', '2024-06-03']);
    const buckets = buildCheckInBuckets(
      [
        {
          localDate: '2024-06-01',
          sleepQuality: 'bad',
          stressLevel: null,
          hydrationLevel: null,
          caffeineLevel: null,
          mealPattern: null,
          physicalActivity: null,
        },
        {
          localDate: '2024-06-02',
          sleepQuality: 'good',
          stressLevel: null,
          hydrationLevel: null,
          caffeineLevel: null,
          mealPattern: null,
          physicalActivity: null,
        },
      ],
      headacheDays,
      (r) => r.sleepQuality,
      (v) => (v === 'bad' ? 'Плохо' : 'Хорошо')
    );
    const bad = buckets.find((b) => b.valueKey === 'bad');
    const good = buckets.find((b) => b.valueKey === 'good');
    expect(bad?.headacheDays).toBe(1);
    expect(good?.headacheDays).toBe(0);
  });

  test('N multiple episodes same day count once in check-in comparison', () => {
    const headacheDays = collectHeadacheDays([
      episodeRow({
        id: 'a',
        startedAt: '2024-06-01T08:00:00.000Z',
        localStartDate: '2024-06-01',
      }),
      episodeRow({
        id: 'b',
        startedAt: '2024-06-01T20:00:00.000Z',
        localStartDate: '2024-06-01',
      }),
    ]);
    const buckets = buildCheckInBuckets(
      [
        {
          localDate: '2024-06-01',
          sleepQuality: null,
          stressLevel: 'high',
          hydrationLevel: null,
          caffeineLevel: null,
          mealPattern: null,
          physicalActivity: null,
        },
      ],
      headacheDays,
      (r) => r.stressLevel,
      (v) => v
    );
    expect(buckets[0]?.headacheDays).toBe(1);
    expect(buckets[0]?.totalDays).toBe(1);
  });

  test('O minimum sample rule suppresses observation', () => {
    const buckets = buildCheckInBuckets(
      Array.from({ length: 4 }, (_, i) => ({
        localDate: `2024-06-0${i + 1}`,
        sleepQuality: null,
        stressLevel: 'high',
        hydrationLevel: null,
        caffeineLevel: null,
        mealPattern: null,
        physicalActivity: null,
      })),
      new Set(['2024-06-01', '2024-06-02']),
      (r) => r.stressLevel,
      (v) => v
    );
    expect(tryBuildObservation('Стресс', buckets)).toBeNull();
    expect(MIN_CHECKIN_DAYS_FOR_COMPARISON).toBe(5);
  });

  test('P minimum percentage-difference rule suppresses tiny gap', () => {
    const observation = tryBuildObservation('Стресс', [
      {
        valueKey: 'high',
        valueLabel: 'Высокий',
        totalDays: 5,
        headacheDays: 3,
        headacheRate: 0.6,
      },
      {
        valueKey: 'low',
        valueLabel: 'Низкий',
        totalDays: 4,
        headacheDays: 2,
        headacheRate: 0.5,
      },
    ]);
    expect(observation).toBeNull();
    expect(MIN_PATTERN_RATE_DIFF_PP).toBe(15);
  });

  test('P emits observation when sample and gap are sufficient', () => {
    const observation = tryBuildObservation('Стресс', [
      {
        valueKey: 'high',
        valueLabel: 'Высокий',
        totalDays: 5,
        headacheDays: 4,
        headacheRate: 0.8,
      },
      {
        valueKey: 'low',
        valueLabel: 'Низкий',
        totalDays: 8,
        headacheDays: 1,
        headacheRate: 0.125,
      },
    ]);
    expect(observation).not.toBeNull();
    expect(observation?.text).toContain('высокий');
  });

  test('R deterministic sorting on ties', () => {
    const report = buildAnalyticsReport(
      emptyInput({
        episodes: [episodeRow({ id: 'a', startedAt: '2024-06-01T10:00:00.000Z' })],
        symptoms: [
          { key: 'nausea', label: 'Тошнота', episodeCount: 3 },
          { key: 'aura', label: 'Аура', episodeCount: 3 },
        ],
      })
    );
    expect(report.symptoms.map((s) => s.key)).toEqual(['aura', 'nausea']);
  });
});

describe('analytics repository integration', () => {
  test('loads episodes, tags, medications, and check-ins for a period', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);
    const checkIns = new DailyCheckInRepository(db);
    const customFactors = new CustomFactorRepository(db);
    const analytics = new AnalyticsRepository(db);

    const { episode: ep1 } = headaches.startEpisode({
      intensity: 6,
      startedAt: '2024-06-01T09:00:00.000Z',
    });
    headaches.addIntensityEntry(ep1.id, 8, '2024-06-01T10:00:00.000Z');
    headaches.replaceEpisodeDetails(ep1.id, {
      side: 'right',
      locations: [{ code: 'temple' }],
      painCharacters: [{ code: 'throbbing' }],
      symptoms: [{ code: 'photophobia' }, { code: 'photophobia' }],
      factors: [{ code: 'stress' }],
    });
    headaches.finishEpisode(ep1.id, '2024-06-01T11:00:00.000Z');

    const { episode: ep2 } = headaches.startEpisode({
      intensity: 5,
      startedAt: '2024-06-01T15:00:00.000Z',
    });
    headaches.finishEpisode(ep2.id, '2024-06-01T16:00:00.000Z');

    const custom = customFactors.getOrCreate('Шоколад');
    const { episode: ep3 } = headaches.startEpisode({
      intensity: 4,
      startedAt: '2024-06-02T07:00:00.000Z',
    });
    headaches.replaceEpisodeDetails(ep3.id, {
      factors: [{ code: 'custom', customFactorId: custom.id }],
    });
    headaches.finishEpisode(ep3.id, '2024-06-02T08:00:00.000Z');

    const medication = meds.createMedication({ name: 'Ибупрофен' });
    meds.createIntake({
      medicationId: medication.id,
      episodeId: ep1.id,
      takenAt: '2024-06-01T09:30:00.000Z',
      effect: 'helped_a_lot',
      medicationNameSnapshot: 'Ибупрофен 400',
    });

    checkIns.upsertDailyCheckIn({
      localDate: '2024-06-01',
      stressLevel: 'high',
    });
    checkIns.upsertDailyCheckIn({
      localDate: '2024-06-02',
      stressLevel: 'low',
    });

    const report = analytics.buildReport('30d', '2024-06-30');

    expect(report.overview.episodeCount).toBe(3);
    expect(report.overview.headacheDayCount).toBe(2);
    expect(report.symptoms[0]?.episodeCount).toBe(1);
    expect(report.factors.some((f: { label: string }) => f.label === 'Шоколад')).toBe(true);
    expect(report.medications[0]?.name).toBe('Ибупрофен 400');
    expect(report.medications[0]?.helpedALot).toBe(1);
  });
});
