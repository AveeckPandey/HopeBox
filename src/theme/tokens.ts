// Single source of truth for non-color design constants.
// All screens should read from here instead of hardcoding numbers.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const type = {
  // `display` is the hero heading on Dashboard / Screen screens.
  // 30px + `adjustsFontSizeToFit` keeps it readable down to 320px wide.
  display: { fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  subtitle: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
} as const;

export const elevation = {
  card: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 3,
  },
  raised: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
  },
  flat: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

export const layout = {
  // Cap content width on tablets for readability
  maxContentWidth: 600,
  tabBarHeight: 64,
  fabSize: 56,
  minTouchTarget: 44,
} as const;
