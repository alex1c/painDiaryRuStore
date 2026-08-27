/**
 * Unit tests for local calendar-date utilities.
 */

import {
  LOCAL_DATE_REGEX,
  addDaysToLocalDate,
  compareLocalDates,
  isValidLocalDateString,
  parseLocalDate,
  toLocalDateString,
} from '@/src/utils/localDate';

describe('localDate', () => {
  test('LOCAL_DATE_REGEX matches zero-padded YYYY-MM-DD', () => {
    expect(LOCAL_DATE_REGEX.test('2024-01-09')).toBe(true);
    expect(LOCAL_DATE_REGEX.test('2024-1-9')).toBe(false);
    expect(LOCAL_DATE_REGEX.test('2024-01-09T12:00:00Z')).toBe(false);
  });

  test('toLocalDateString uses local Y/M/D components', () => {
    const d = new Date(2024, 0, 9, 15, 30, 0);
    expect(toLocalDateString(d)).toBe('2024-01-09');
  });

  test('parseLocalDate builds local midnight without Date.parse locale traps', () => {
    const d = parseLocalDate('2024-02-29');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
    expect(d.getHours()).toBe(0);
  });

  test('isValidLocalDateString rejects impossible dates', () => {
    expect(isValidLocalDateString('2023-02-29')).toBe(false);
    expect(isValidLocalDateString('2024-13-01')).toBe(false);
    expect(isValidLocalDateString('2024-02-29')).toBe(true);
  });

  test('compareLocalDates orders lexicographically', () => {
    expect(compareLocalDates('2024-01-01', '2024-01-02')).toBeLessThan(0);
    expect(compareLocalDates('2024-01-02', '2024-01-02')).toBe(0);
    expect(compareLocalDates('2024-02-01', '2024-01-31')).toBeGreaterThan(0);
  });

  test('addDaysToLocalDate crosses month boundaries', () => {
    expect(addDaysToLocalDate('2024-01-31', 1)).toBe('2024-02-01');
    expect(addDaysToLocalDate('2024-03-01', -1)).toBe('2024-02-29');
  });
});
