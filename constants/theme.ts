/**
 * Design tokens from Stitch project "GharKaSwad Marketplace"
 * Design system: Artisanal Kitchen (projects/11845391070777637560)
 * Never hardcode hex values in components — import from here.
 */

export const colors = {
  // Brand — terracotta family (customColor #d96b41 → Material primary)
  primary: '#9d3e18',
  primaryContainer: '#bd562e',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#fffbff',
  terracotta: '#D96B41', // brand accent alias used in product copy

  secondary: '#835400',
  secondaryContainer: '#feb64e',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#714800',

  tertiary: '#436349',
  tertiaryContainer: '#5b7c60',
  onTertiary: '#ffffff',

  // Surfaces — warm cream family
  background: '#fff8f5',
  warmCream: '#FDF8F2', // product copy alias; maps near surfaceContainerLow
  surface: '#fff8f5',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#fbf2ed',
  surfaceContainer: '#f5ece7',
  surfaceContainerHigh: '#efe6e2',
  surfaceContainerHighest: '#e9e1dc',
  surfaceVariant: '#e9e1dc',

  onBackground: '#1e1b18',
  onSurface: '#1e1b18',
  onSurfaceVariant: '#56423b',

  outline: '#8a726a',
  outlineVariant: '#ddc0b7',

  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  success: '#436349',
  warning: '#835400',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
  gutter: 16,
  margin: 20,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

export const typography = {
  displayLg: {
    fontFamily: 'Literata_700Bold',
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -0.5,
  },
  headlineLg: {
    fontFamily: 'Literata_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
  },
  headlineMd: {
    fontFamily: 'Literata_600SemiBold',
    fontSize: 24,
    lineHeight: 32,
  },
  headlineSm: {
    fontFamily: 'Literata_600SemiBold',
    fontSize: 20,
    lineHeight: 28,
  },
  bodyLg: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 18,
    lineHeight: 28,
  },
  bodyMd: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodySm: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  labelMd: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.15,
  },
  labelSm: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    lineHeight: 16,
  },
} as const;

export const shadow = {
  soft: {
    shadowColor: '#1e1b18',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
