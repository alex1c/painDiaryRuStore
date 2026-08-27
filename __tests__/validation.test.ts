/**
 * Unit tests for domain validation helpers.
 */

import {
  DomainValidationError,
  validateEpisodeTimes,
  validateIntensity,
  validateLocalDate,
  validateMedicationEffect,
  validateMedicationName,
} from '@/src/domain/validation';

describe('validation', () => {
  test('validateIntensity accepts 0–10 integers', () => {
    expect(() => validateIntensity(0)).not.toThrow();
    expect(() => validateIntensity(10)).not.toThrow();
    expect(() => validateIntensity(7)).not.toThrow();
  });

  test('validateIntensity rejects floats and out of range', () => {
    expect(() => validateIntensity(5.5)).toThrow(DomainValidationError);
    expect(() => validateIntensity(-1)).toThrow(DomainValidationError);
    expect(() => validateIntensity(11)).toThrow(DomainValidationError);
  });

  test('validateEpisodeTimes rejects endedAt before startedAt', () => {
    expect(() =>
      validateEpisodeTimes(
        '2024-01-01T12:00:00.000Z',
        '2024-01-01T11:00:00.000Z'
      )
    ).toThrow(DomainValidationError);

    expect(() =>
      validateEpisodeTimes('2024-01-01T12:00:00.000Z', null)
    ).not.toThrow();
  });

  test('validateMedicationName rejects blank names', () => {
    expect(() => validateMedicationName('  ')).toThrow(DomainValidationError);
    expect(() => validateMedicationName('Ibuprofen')).not.toThrow();
  });

  test('validateLocalDate rejects non YYYY-MM-DD', () => {
    expect(() => validateLocalDate('2024-01-01')).not.toThrow();
    expect(() => validateLocalDate('01.01.2024')).toThrow(DomainValidationError);
  });

  test('validateMedicationEffect accepts known codes only', () => {
    expect(() => validateMedicationEffect('helped_a_lot')).not.toThrow();
    expect(() => validateMedicationEffect('miracle')).toThrow(
      DomainValidationError
    );
  });
});
