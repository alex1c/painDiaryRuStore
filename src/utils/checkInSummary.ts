/**
 * Builds compact Russian summary lines for daily check-in display.
 */

import type { DailyCheckIn } from '@/src/domain/types';
import {
  CAFFEINE_LEVEL_LABELS,
  HYDRATION_LEVEL_LABELS,
  MEAL_PATTERN_LABELS,
  PHYSICAL_ACTIVITY_LABELS,
  SLEEP_QUALITY_LABELS,
  STRESS_LEVEL_LABELS,
} from '@/src/domain/labels';

/** Returns true when the check-in has at least one answered field or note. */
export function dailyCheckInHasContent(checkIn: DailyCheckIn): boolean {
  return dailyCheckInHasStructuredOrNote(checkIn);
}

/**
 * Compact summary parts for Today / Diary (only answered fields).
 * Example: ["Сон: плохо", "Стресс: высокий"].
 */
export function buildDailyCheckInSummaryParts(
  checkIn: DailyCheckIn
): string[] {
  const parts: string[] = [];

  if (checkIn.sleepQuality != null) {
    parts.push(
      `Сон: ${SLEEP_QUALITY_LABELS[checkIn.sleepQuality].toLowerCase()}`
    );
  } else if (checkIn.sleepDurationMinutes != null) {
    const hours = Math.floor(checkIn.sleepDurationMinutes / 60);
    const mins = checkIn.sleepDurationMinutes % 60;
    if (mins === 0) {
      parts.push(`Сон: ${hours} ч`);
    } else {
      parts.push(`Сон: ${hours} ч ${mins} мин`);
    }
  }
  if (checkIn.stressLevel != null) {
    parts.push(
      `Стресс: ${STRESS_LEVEL_LABELS[checkIn.stressLevel].toLowerCase()}`
    );
  }
  if (checkIn.hydrationLevel != null) {
    parts.push(
      `Воды: ${HYDRATION_LEVEL_LABELS[checkIn.hydrationLevel].toLowerCase()}`
    );
  }
  if (checkIn.caffeineLevel != null) {
    parts.push(
      `Кофеин: ${CAFFEINE_LEVEL_LABELS[checkIn.caffeineLevel].toLowerCase()}`
    );
  }
  if (checkIn.mealPattern != null) {
    parts.push(
      `Питание: ${MEAL_PATTERN_LABELS[checkIn.mealPattern].toLowerCase()}`
    );
  }
  if (checkIn.physicalActivity != null) {
    parts.push(
      `Нагрузка: ${PHYSICAL_ACTIVITY_LABELS[checkIn.physicalActivity].toLowerCase()}`
    );
  }

  return parts;
}

/** True when structured fields or note have content (for empty-row deletion). */
export function dailyCheckInHasStructuredOrNote(checkIn: DailyCheckIn): boolean {
  return (
    buildDailyCheckInSummaryParts(checkIn).length > 0 ||
    (checkIn.notes != null && checkIn.notes.trim().length > 0)
  );
}

/** Joins summary parts with a middle dot separator. */
export function buildDailyCheckInSummaryLine(checkIn: DailyCheckIn): string {
  return buildDailyCheckInSummaryParts(checkIn).join(' · ');
}
