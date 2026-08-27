/**
 * Unit tests for flexible numeric parsing (comma/dot, incomplete states).
 */

import { finalizeNumber, parseFlexibleNumber } from '@/src/utils/numeric';

describe('numeric', () => {
  test('parseFlexibleNumber accepts dot and comma decimals', () => {
    expect(parseFlexibleNumber('1.5')).toBe(1.5);
    expect(parseFlexibleNumber('1,5')).toBe(1.5);
    expect(parseFlexibleNumber('-2')).toBe(-2);
  });

  test('parseFlexibleNumber returns null for incomplete editable states', () => {
    expect(parseFlexibleNumber('')).toBeNull();
    expect(parseFlexibleNumber(',')).toBeNull();
    expect(parseFlexibleNumber('.')).toBeNull();
    expect(parseFlexibleNumber('1,')).toBeNull();
    expect(parseFlexibleNumber('1.')).toBeNull();
    expect(parseFlexibleNumber('-')).toBeNull();
  });

  test('parseFlexibleNumber throws on invalid complete junk', () => {
    expect(() => parseFlexibleNumber('abc')).toThrow();
    expect(() => parseFlexibleNumber('1.2.3')).toThrow();
  });

  test('finalizeNumber commits complete values, nulls empty, throws on incomplete', () => {
    expect(finalizeNumber('')).toBeNull();
    expect(finalizeNumber('2,25')).toBe(2.25);
    expect(() => finalizeNumber('1,')).toThrow();
    expect(() => finalizeNumber('.')).toThrow();
  });
});
