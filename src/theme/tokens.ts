/**
 * Design tokens for Phase 1 UI foundations.
 * Soft teal / slate medical-calm palette — deliberately avoiding purple AI defaults.
 */

export const colors = {
  /** Primary brand / interactive teal. */
  primary: '#0F766E',
  primaryMuted: '#14B8A6',
  primarySoft: '#CCFBF1',

  /** Neutrals — cool slate, not pure black. */
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',

  border: '#E2E8F0',
  danger: '#B91C1C',
  warning: '#B45309',
  success: '#047857',
} as const;

/** Spacing scale in density-independent pixels. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

export const tokens = {
  colors,
  spacing,
  typography,
  radii,
} as const;

export default tokens;
