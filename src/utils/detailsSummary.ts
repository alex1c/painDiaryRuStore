/**
 * Compact Russian summary lines for Today active-card (max ~2 lines).
 */

import type { EpisodeDetails } from '@/src/domain/types';
import {
  LOCATION_LABELS,
  PAIN_CHARACTER_LABELS,
  SIDE_LABELS,
  SYMPTOM_LABELS,
  factorDisplayLabel,
} from '@/src/domain/labels';

/**
 * Builds up to two short summary lines for an episode's pain details.
 * Returns empty array when there is nothing to show.
 */
export function buildDetailsSummaryLines(details: EpisodeDetails): string[] {
  const lines: string[] = [];

  const whereParts: string[] = [];
  if (details.episode.side) {
    whereParts.push(SIDE_LABELS[details.episode.side]);
  }
  for (const loc of details.locations) {
    whereParts.push(
      loc.code === 'other' && loc.customLabel
        ? loc.customLabel
        : LOCATION_LABELS[loc.code]
    );
  }
  if (whereParts.length > 0) {
    lines.push(whereParts.slice(0, 4).join(' • '));
  }

  const howParts = details.painCharacters.map((c) =>
    c.code === 'other' && c.customLabel
      ? c.customLabel
      : PAIN_CHARACTER_LABELS[c.code]
  );
  const symptomParts = details.symptoms.map((s) =>
    s.code === 'other' && s.customLabel
      ? s.customLabel
      : SYMPTOM_LABELS[s.code]
  );

  if (howParts.length > 0 || symptomParts.length > 0) {
    const mixed = [...howParts.slice(0, 2), ...symptomParts.slice(0, 2)];
    lines.push(mixed.join(' • '));
  } else if (details.factors.length > 0) {
    if (details.factors.length <= 2) {
      lines.push(
        details.factors
          .map((f) => factorDisplayLabel(f.code, f.customLabel))
          .join(' • ')
      );
    } else {
      lines.push(`${details.factors.length} возможных фактора`);
    }
  }

  // Prefer count summary when lists are long and we already have where-line.
  if (
    lines.length >= 1 &&
    details.symptoms.length + details.factors.length > 4 &&
    howParts.length === 0
  ) {
    // Keep first line; replace second with counts when crowded.
    const counts: string[] = [];
    if (details.symptoms.length > 0) {
      counts.push(`${details.symptoms.length} симптом`);
    }
    if (details.factors.length > 0) {
      counts.push(`${details.factors.length} возможных фактора`);
    }
    if (counts.length > 0) {
      lines[1] = counts.join(' • ');
    }
  }

  return lines.slice(0, 2);
}

const COMPACT_CARD_SEPARATOR = ' · ';
const COMPACT_CARD_MAX_LENGTH = 56;

/**
 * One-line compact summary for completed Today cards:
 * side → first location → first pain character.
 */
export function buildCompactCardSummary(details: EpisodeDetails): string | null {
	const parts: string[] = [];

	if (details.episode.side) {
		parts.push(SIDE_LABELS[details.episode.side]);
	}

	const firstLocation = details.locations[0];
	if (firstLocation) {
		parts.push(
			firstLocation.code === 'other' && firstLocation.customLabel
				? firstLocation.customLabel
				: LOCATION_LABELS[firstLocation.code]
		);
	}

	const firstCharacter = details.painCharacters[0];
	if (firstCharacter) {
		parts.push(
			firstCharacter.code === 'other' && firstCharacter.customLabel
				? firstCharacter.customLabel
				: PAIN_CHARACTER_LABELS[firstCharacter.code]
		);
	}

	if (parts.length === 0) {
		return null;
	}

	let summary = parts.join(COMPACT_CARD_SEPARATOR);
	if (summary.length > COMPACT_CARD_MAX_LENGTH) {
		summary = `${summary.slice(0, COMPACT_CARD_MAX_LENGTH - 1).trimEnd()}…`;
	}
	return summary;
}
