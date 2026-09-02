/**
 * Renders doctor report model into print-friendly HTML for expo-print.
 */

import {
  OBSERVATIONAL_DISCLAIMER,
} from '@/src/analytics/constants';
import type { RankedCount } from '@/src/analytics/types';
import { MEDICATION_EFFECT_LABELS } from '@/src/domain/labels';
import { escapeHtml } from '@/src/reports/escapeHtml';
import {
  formatReportGeneratedAt,
  formatReportLocalDate,
} from '@/src/reports/period';
import {
  REPORT_FACTOR_DISCLAIMER,
  REPORT_INSUFFICIENT_OBSERVATIONS,
  REPORT_OBSERVATIONS_TITLE,
} from '@/src/reports/constants';
import type { DoctorReport, DoctorReportEpisode } from '@/src/reports/types';
import { formatDurationBetween, formatDurationMs } from '@/src/utils/formatDuration';
import { formatLocalTime } from '@/src/utils/formatTime';

/** Builds a complete HTML document for A4 portrait PDF export. */
export function renderDoctorReportHtml(report: DoctorReport): string {
  const sections = [
    renderHeader(report),
    renderSummary(report),
    renderFrequencySection(report),
    renderRankedSection('Часто отмечаемые симптомы', report.analytics.symptoms),
    renderRankedSection('Характер боли', report.analytics.painCharacters),
    renderLocationSection(report),
    renderRankedSection(
      'Часто отмечаемые факторы',
      report.analytics.factors,
      REPORT_FACTOR_DISCLAIMER
    ),
    renderObservationsSection(report),
    renderMedicationsSection(report),
    renderEpisodesSection(report),
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <style>${REPORT_CSS}</style>
</head>
<body>
  ${sections.join('\n')}
</body>
</html>`;
}

const REPORT_CSS = `
  @page { size: A4 portrait; margin: 18mm 14mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #111;
    margin: 0;
  }
  h1 { font-size: 20pt; margin: 0 0 8pt; }
  h2 {
    font-size: 13pt;
    margin: 18pt 0 8pt;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4pt;
  }
  h3 { font-size: 11pt; margin: 0 0 6pt; }
  p { margin: 0 0 8pt; }
  .muted { color: #555; font-size: 10pt; }
  .disclaimer { color: #666; font-size: 9.5pt; margin-bottom: 8pt; }
  .summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8pt;
    margin-bottom: 8pt;
  }
  .summary-item {
    border: 1px solid #ddd;
    border-radius: 4pt;
    padding: 8pt;
    break-inside: avoid;
  }
  .summary-label { color: #555; font-size: 9.5pt; margin-bottom: 2pt; }
  .summary-value { font-size: 12pt; font-weight: 600; }
  table.freq {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6pt;
    font-size: 10pt;
  }
  table.freq th, table.freq td {
    border: 1px solid #ddd;
    padding: 4pt 6pt;
    text-align: left;
  }
  table.freq th { background: #f5f5f5; }
  ul.rank { margin: 0; padding-left: 16pt; }
  ul.rank li { margin-bottom: 4pt; }
  .med-block { margin-bottom: 10pt; break-inside: avoid; }
  .episode {
    border: 1px solid #ddd;
    border-radius: 4pt;
    padding: 10pt;
    margin-bottom: 10pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .episode-date { font-weight: 700; font-size: 12pt; margin-bottom: 4pt; }
  .episode-line { margin-bottom: 4pt; }
  .episode-label { color: #555; }
`;

function renderHeader(report: DoctorReport): string {
  const generated = formatReportGeneratedAt(report.generatedAtIso);
  return `
    <h1>${escapeHtml(report.title)}</h1>
    <p><strong>Период:</strong> ${escapeHtml(report.periodLabel)}</p>
    ${generated ? `<p class="muted">Сформирован: ${escapeHtml(generated)}</p>` : ''}
  `;
}

function renderSummary(report: DoctorReport): string {
  const { overview } = report.analytics;
  const completedCount = report.episodes.filter((e) => !e.isActive).length;
  const avgIntensity =
    overview.averageIntensity != null
      ? `${overview.averageIntensity} / 10`
      : '—';
  const maxIntensity =
    overview.maxIntensity != null ? `${overview.maxIntensity} / 10` : '—';
  const avgDuration =
    overview.averageDurationMs != null
      ? formatDurationMs(overview.averageDurationMs)
      : '—';

  return `
    <h2>Обзор</h2>
    <div class="summary-grid">
      ${summaryTile('Приступов', String(overview.episodeCount))}
      ${summaryTile('Дней с головной болью', String(overview.headacheDayCount))}
      ${summaryTile('Средняя интенсивность', avgIntensity)}
      ${summaryTile('Максимальная интенсивность', maxIntensity)}
      ${summaryTile('Средняя длительность', avgDuration)}
      ${summaryTile('Завершённых приступов', String(completedCount))}
    </div>
  `;
}

function summaryTile(label: string, value: string): string {
  return `
    <div class="summary-item">
      <div class="summary-label">${escapeHtml(label)}</div>
      <div class="summary-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderFrequencySection(report: DoctorReport): string {
  const buckets = report.analytics.frequency.buckets.filter(
    (b) => b.headacheDays > 0
  );
  if (buckets.length === 0) {
    return `
      <h2>Частота</h2>
      <p class="muted">За период не отмечено дней с головной болью.</p>
    `;
  }

  const rows = buckets
    .map(
      (bucket) =>
        `<tr><td>${escapeHtml(bucket.label)}</td><td>${bucket.headacheDays}</td></tr>`
    )
    .join('');

  return `
    <h2>Частота</h2>
    <p class="muted">${escapeHtml(report.analytics.frequency.metricLabel)}</p>
    <table class="freq">
      <thead><tr><th>Период</th><th>Дней с головной болью</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderRankedSection(
  title: string,
  items: RankedCount[],
  disclaimer?: string
): string {
  if (items.length === 0) {
    return '';
  }

  const list = items
    .map(
      (item) =>
        `<li>${escapeHtml(item.label)} — ${item.episodeCount}</li>`
    )
    .join('');

  return `
    <h2>${escapeHtml(title)}</h2>
    ${disclaimer ? `<p class="disclaimer">${escapeHtml(disclaimer)}</p>` : ''}
    <ul class="rank">${list}</ul>
  `;
}

function renderLocationSection(report: DoctorReport): string {
  const { sides, locations } = report.analytics;
  if (sides.length === 0 && locations.length === 0) {
    return '';
  }

  const parts: string[] = [];
  if (sides.length > 0) {
    parts.push(renderRankedSection('Сторона', sides));
  }
  if (locations.length > 0) {
    parts.push(renderRankedSection('Локация', locations));
  }

  return `
    <h2>Где чаще болит</h2>
    ${parts.join('\n')}
  `;
}

function renderObservationsSection(report: DoctorReport): string {
  const { dailyObservations, isLowData } = report.analytics;
  if (isLowData) {
    return '';
  }

  if (
    !dailyObservations.hasEnoughData ||
    dailyObservations.observations.length === 0
  ) {
    return `
      <h2>${escapeHtml(REPORT_OBSERVATIONS_TITLE)}</h2>
      <p class="muted">${escapeHtml(REPORT_INSUFFICIENT_OBSERVATIONS)}</p>
    `;
  }

  const lines = dailyObservations.observations
    .map((obs) => `<p>${escapeHtml(obs.text)}</p>`)
    .join('');

  return `
    <h2>${escapeHtml(REPORT_OBSERVATIONS_TITLE)}</h2>
    <p class="disclaimer">${escapeHtml(OBSERVATIONAL_DISCLAIMER)}</p>
    ${lines}
  `;
}

function renderMedicationsSection(report: DoctorReport): string {
  const meds = report.analytics.medications;
  if (meds.length === 0) {
    return '';
  }

  const blocks = meds
    .map((med) => {
      const lines = [
        `<p><strong>${escapeHtml(med.name)}</strong></p>`,
        `<p>Приёмов: ${med.intakeCount}</p>`,
      ];
      if (med.helpedALot > 0) {
        lines.push(
          `<p>${escapeHtml(MEDICATION_EFFECT_LABELS.helped_a_lot)}: ${med.helpedALot}</p>`
        );
      }
      if (med.helpedSomewhat > 0) {
        lines.push(
          `<p>${escapeHtml(MEDICATION_EFFECT_LABELS.helped_somewhat)}: ${med.helpedSomewhat}</p>`
        );
      }
      if (med.noEffect > 0) {
        lines.push(
          `<p>${escapeHtml(MEDICATION_EFFECT_LABELS.no_effect)}: ${med.noEffect}</p>`
        );
      }
      if (med.madeWorse > 0) {
        lines.push(
          `<p>${escapeHtml(MEDICATION_EFFECT_LABELS.made_worse)}: ${med.madeWorse}</p>`
        );
      }
      if (med.tooEarlyToTell > 0) {
        lines.push(
          `<p>${escapeHtml(MEDICATION_EFFECT_LABELS.too_early_to_tell)}: ${med.tooEarlyToTell}</p>`
        );
      }
      if (med.unrated > 0) {
        lines.push(`<p>Не оценено: ${med.unrated}</p>`);
      }
      return `<div class="med-block">${lines.join('')}</div>`;
    })
    .join('');

  return `<h2>Лекарства</h2>${blocks}`;
}

function renderEpisodesSection(report: DoctorReport): string {
  if (report.episodes.length === 0) {
    return '';
  }

  const cards = report.episodes
    .map((episode) => renderEpisodeCard(episode, report.generatedAtIso))
    .join('');
  return `<h2>Хронология приступов</h2>${cards}`;
}

function renderEpisodeCard(
  episode: DoctorReportEpisode,
  generatedAtIso: string
): string {
  const dateLabel = formatReportLocalDate(episode.localDate);
  const startTime = formatLocalTime(episode.startedAt);
  const timing = episode.isActive
    ? `${startTime} · Не завершён`
    : `${startTime}–${formatLocalTime(episode.endedAt!)} · ${formatDurationBetween(episode.startedAt, episode.endedAt, Date.parse(generatedAtIso))}`;

  const intensityParts: string[] = [];
  if (episode.maxIntensity != null) {
    intensityParts.push(`Макс. ${episode.maxIntensity}/10`);
  }
  if (episode.avgIntensity != null) {
    intensityParts.push(`Сред. ${roundOne(episode.avgIntensity)}/10`);
  }

  const whereParts = [
    episode.sideLabel,
    ...episode.locationLabels,
    ...episode.painCharacterLabels,
  ].filter(Boolean);

  const lines: string[] = [
    `<div class="episode-date">${escapeHtml(dateLabel)}</div>`,
    `<div class="episode-line">${escapeHtml(timing)}</div>`,
  ];

  if (intensityParts.length > 0) {
    lines.push(
      `<div class="episode-line">${escapeHtml(intensityParts.join(' · '))}</div>`
    );
  }

  if (whereParts.length > 0) {
    lines.push(
      `<div class="episode-line">${escapeHtml(whereParts.join(' · '))}</div>`
    );
  }

  if (episode.symptomLabels.length > 0) {
    lines.push(
      `<div class="episode-line"><span class="episode-label">Симптомы:</span> ${escapeHtml(episode.symptomLabels.join(', '))}</div>`
    );
  }

  if (episode.factorLabels.length > 0) {
    lines.push(
      `<div class="episode-line"><span class="episode-label">Факторы:</span> ${escapeHtml(episode.factorLabels.join(', '))}</div>`
    );
  }

  if (episode.medications.length > 0) {
    const medText = episode.medications
      .map((med) => {
        const dose = med.doseLabel ? ` ${med.doseLabel}` : '';
        return `${med.name}${dose} — ${med.effectLabel}`;
      })
      .join('; ');
    lines.push(
      `<div class="episode-line"><span class="episode-label">Лекарства:</span> ${escapeHtml(medText)}</div>`
    );
  }

  if (episode.notes) {
    lines.push(
      `<div class="episode-line"><span class="episode-label">Заметка:</span> ${escapeHtml(episode.notes)}</div>`
    );
  }

  return `<div class="episode">${lines.join('')}</div>`;
}

function roundOne(value: number): string {
  return String(Math.round(value * 10) / 10);
}
