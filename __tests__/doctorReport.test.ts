/**
 * Phase 7 doctor report tests — data, periods, HTML escaping, analytics parity.
 */

import initSqlJs from 'sql.js';

import { AnalyticsRepository } from '@/src/analytics/AnalyticsRepository';
import { getCustomPeriodBounds, getPeriodBounds } from '@/src/analytics/period';
import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { HeadacheRepository } from '@/src/repositories/HeadacheRepository';
import { MedicationRepository } from '@/src/repositories/MedicationRepository';
import { buildDoctorReport } from '@/src/reports/buildDoctorReport';
import { DoctorReportRepository } from '@/src/reports/DoctorReportRepository';
import { escapeHtml } from '@/src/reports/escapeHtml';
import {
  resolveReportPeriod,
  validateCustomReportRange,
} from '@/src/reports/period';
import { renderDoctorReportHtml } from '@/src/reports/renderDoctorReportHtml';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

function seedCompletedEpisode(
  headaches: HeadacheRepository,
  startedAt: string,
  endedAt: string,
  intensity: number
): string {
  const episode = headaches.createEpisode({ startedAt, endedAt });
  headaches.addIntensityEntry(episode.id, intensity, startedAt);
  return episode.id;
}

describe('doctor report periods', () => {
  test('14-day preset matches analytics bounds', () => {
    const bounds = getPeriodBounds('14d', '2024-06-14');
    expect(bounds).toEqual({ from: '2024-06-01', to: '2024-06-14' });
  });

  test('custom inclusive range is accepted', () => {
    expect(getCustomPeriodBounds('2024-06-01', '2024-06-30')).toEqual({
      from: '2024-06-01',
      to: '2024-06-30',
    });
  });

  test('invalid custom range is rejected', () => {
    expect(validateCustomReportRange('2024-06-30', '2024-06-01')).toMatch(
      /начала/
    );
    expect(() =>
      getCustomPeriodBounds('2024-06-30', '2024-06-01')
    ).toThrow();
  });

  test('resolveReportPeriod maps 30d default', () => {
    const resolved = resolveReportPeriod('30d', '2024-06-30');
    expect(resolved.bounds).toEqual({ from: '2024-06-01', to: '2024-06-30' });
  });
});

describe('doctor report HTML escaping', () => {
  test('escapes script tags and quotes', () => {
    const input = `<script>alert(1)</script> "test" & 'note'`;
    expect(escapeHtml(input)).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; &quot;test&quot; &amp; &#39;note&#39;'
    );
  });

  test('user notes appear escaped in HTML output', () => {
    const db = openTestDb();
    return db.then(async (database) => {
      const headaches = new HeadacheRepository(database);
      const analytics = new AnalyticsRepository(database);
      const reports = new DoctorReportRepository(database);

      const episodeId = seedCompletedEpisode(
        headaches,
        '2024-06-10T10:00:00.000Z',
        '2024-06-10T12:00:00.000Z',
        6
      );
      headaches.updateEpisode(episodeId, {
        notes: '<b>опасно</b> & "цитата"',
      });

      const report = buildDoctorReport(analytics, reports, {
        preset: '30d',
        todayLocal: '2024-06-30',
        generatedAtIso: '2024-06-30T12:00:00.000Z',
      });

      const html = renderDoctorReportHtml(report);
      expect(html).toContain('&lt;b&gt;опасно&lt;/b&gt; &amp; &quot;цитата&quot;');
      expect(html).not.toContain('<b>опасно</b>');
    });
  });
});

describe('doctor report data', () => {
  test('no episodes yields empty preview', async () => {
    const db = await openTestDb();
    const analytics = new AnalyticsRepository(db);
    const reports = new DoctorReportRepository(db);

    const report = buildDoctorReport(analytics, reports, {
      preset: '30d',
      todayLocal: '2024-06-30',
    });

    expect(report.preview.hasEpisodes).toBe(false);
    expect(report.preview.episodeCount).toBe(0);
    expect(renderDoctorReportHtml(report)).toContain('Дневник головной боли');
  });

  test('completed episode appears in chronology with max intensity', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const meds = new MedicationRepository(db);
    const analytics = new AnalyticsRepository(db);
    const reports = new DoctorReportRepository(db);

    const episodeId = seedCompletedEpisode(
      headaches,
      '2024-06-10T08:00:00.000Z',
      '2024-06-10T11:00:00.000Z',
      8
    );
    headaches.replaceEpisodeDetails(episodeId, {
      side: 'right',
      locations: [{ code: 'temple' }],
      painCharacters: [{ code: 'throbbing' }],
      symptoms: [{ code: 'photophobia' }],
      factors: [{ code: 'stress' }],
    });

    const medication = meds.createMedication({ name: 'Ибупрофен' });
    meds.createIntake({
      episodeId,
      medicationId: medication.id,
      takenAt: '2024-06-10T09:00:00.000Z',
      dose: '400',
      unit: 'мг',
      effect: 'helped_a_lot',
    });

    const report = buildDoctorReport(analytics, reports, {
      preset: '30d',
      todayLocal: '2024-06-30',
      generatedAtIso: '2024-06-30T12:00:00.000Z',
    });

    expect(report.preview.episodeCount).toBe(1);
    expect(report.episodes[0].maxIntensity).toBe(8);
    expect(report.episodes[0].medications[0].name).toBe('Ибупрофен');
    expect(report.episodes[0].medications[0].effectLabel).toBe('Помогло');

    const html = renderDoctorReportHtml(report);
    expect(html).toContain('Ибупрофен');
    expect(html).toContain('Справа');
    expect(html).toContain('Пульсирует');
    expect(html).toContain('Свет мешает');
  });

  test('active episode is marked as not completed', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const analytics = new AnalyticsRepository(db);
    const reports = new DoctorReportRepository(db);

    headaches.startEpisode({
      intensity: 7,
      startedAt: '2024-06-12T10:00:00.000Z',
    });

    const report = buildDoctorReport(analytics, reports, {
      preset: '30d',
      todayLocal: '2024-06-30',
    });

    expect(report.episodes[0].isActive).toBe(true);
    expect(renderDoctorReportHtml(report)).toContain('Не завершён');
  });

  test('summary metrics match analytics for equivalent 30-day period', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const analytics = new AnalyticsRepository(db);
    const reports = new DoctorReportRepository(db);

    seedCompletedEpisode(
      headaches,
      '2024-06-01T10:00:00.000Z',
      '2024-06-01T12:00:00.000Z',
      6
    );
    seedCompletedEpisode(
      headaches,
      '2024-06-02T10:00:00.000Z',
      '2024-06-02T13:00:00.000Z',
      8
    );

    const report = buildDoctorReport(analytics, reports, {
      preset: '30d',
      todayLocal: '2024-06-30',
    });
    const analyticsReport = analytics.buildReport('30d', '2024-06-30');

    expect(report.analytics.overview.episodeCount).toBe(
      analyticsReport.overview.episodeCount
    );
    expect(report.analytics.overview.headacheDayCount).toBe(
      analyticsReport.overview.headacheDayCount
    );
    expect(report.analytics.overview.averageIntensity).toBe(
      analyticsReport.overview.averageIntensity
    );
  });

  test('multiple episodes on same headache day dedupe headache days', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const analytics = new AnalyticsRepository(db);
    const reports = new DoctorReportRepository(db);

    seedCompletedEpisode(
      headaches,
      '2024-06-10T08:00:00.000Z',
      '2024-06-10T10:00:00.000Z',
      5
    );
    seedCompletedEpisode(
      headaches,
      '2024-06-10T18:00:00.000Z',
      '2024-06-10T20:00:00.000Z',
      7
    );

    const report = buildDoctorReport(analytics, reports, {
      preset: '7d',
      todayLocal: '2024-06-10',
    });

    expect(report.preview.episodeCount).toBe(2);
    expect(report.preview.headacheDayCount).toBe(1);
  });

  test('custom inclusive date range filters episodes by local start date', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const analytics = new AnalyticsRepository(db);
    const reports = new DoctorReportRepository(db);

    seedCompletedEpisode(
      headaches,
      '2024-06-05T10:00:00.000Z',
      '2024-06-05T12:00:00.000Z',
      5
    );
    seedCompletedEpisode(
      headaches,
      '2024-06-20T10:00:00.000Z',
      '2024-06-20T12:00:00.000Z',
      6
    );

    const report = buildDoctorReport(analytics, reports, {
      preset: 'custom',
      todayLocal: '2024-06-30',
      customFrom: '2024-06-01',
      customTo: '2024-06-10',
    });

    expect(report.preview.episodeCount).toBe(1);
  });

  test('long Russian labels render without breaking HTML structure', async () => {
    const db = await openTestDb();
    const headaches = new HeadacheRepository(db);
    const analytics = new AnalyticsRepository(db);
    const reports = new DoctorReportRepository(db);

    const episodeId = seedCompletedEpisode(
      headaches,
      '2024-06-10T10:00:00.000Z',
      '2024-06-10T12:00:00.000Z',
      6
    );
    headaches.replaceEpisodeDetails(episodeId, {
      symptoms: [{ code: 'other', customLabel: 'Очень длинное название симптома на русском языке' }],
    });

    const html = renderDoctorReportHtml(
      buildDoctorReport(analytics, reports, {
        preset: '30d',
        todayLocal: '2024-06-30',
      })
    );

    expect(html).toContain('Очень длинное название симптома на русском языке');
    expect(html.endsWith('</html>')).toBe(true);
  });
});
