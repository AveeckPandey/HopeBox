import { createContext, useContext } from 'react';

// Black + Deep Orange brand palette.
// Primary is the same in both modes (burnt orange #EA580C) so the brand
// reads identically regardless of theme choice.

export type ThemeMode = 'dark' | 'light';
export type BrandPreset = 'orange' | 'emerald' | 'cobalt';

export type ThemePalette = {
  mode: ThemeMode;
  brand: BrandPreset;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceRaised: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryText: string;
  text: string;
  textInverse: string;
  muted: string;
  border: string;
  borderStrong: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  shadow: string;
  overlay: string;
  tabBar: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
};

// Brand accent definitions across modes
const brandColors: Record<BrandPreset, { primary: string; primaryDark: string; primarySoftDark: string; primarySoftLight: string }> = {
  orange: {
    primary: '#EA580C',
    primaryDark: '#C2410C',
    primarySoftDark: 'rgba(234,88,12,0.14)',
    primarySoftLight: 'rgba(234,88,12,0.10)',
  },
  emerald: {
    primary: '#10B981',
    primaryDark: '#059669',
    primarySoftDark: 'rgba(16,185,129,0.14)',
    primarySoftLight: 'rgba(16,185,129,0.10)',
  },
  cobalt: {
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    primarySoftDark: 'rgba(37,99,235,0.14)',
    primarySoftLight: 'rgba(37,99,235,0.10)',
  },
};

export function getPalette(mode: ThemeMode, brand: BrandPreset = 'orange'): ThemePalette {
  const b = brandColors[brand] || brandColors.orange;

  if (mode === 'dark') {
    return {
      mode: 'dark',
      brand,
      background: '#0A0A0A',
      backgroundAlt: '#101010',
      surface: '#161616',
      surfaceRaised: '#1F1F1F',
      primary: b.primary,
      primaryDark: b.primaryDark,
      primarySoft: b.primarySoftDark,
      primaryText: '#FFFFFF',
      text: '#F5F2EC',
      textInverse: '#0A0A0A',
      muted: '#A8A29A',
      border: '#2A2A2A',
      borderStrong: '#3A3A3A',
      success: '#4ADE80',
      successSoft: 'rgba(74,222,128,0.14)',
      danger: '#F87171',
      dangerSoft: 'rgba(248,113,113,0.14)',
      warning: '#FBBF24',
      warningSoft: 'rgba(251,191,36,0.14)',
      shadow: '#000000',
      overlay: 'rgba(0,0,0,0.65)',
      tabBar: '#0A0A0A',
      tabBarBorder: '#1F1F1F',
      tabBarActive: b.primary,
      tabBarInactive: '#A8A29A',
    };
  }

  return {
    mode: 'light',
    brand,
    background: brand === 'orange' ? '#FFF7F2' : brand === 'emerald' ? '#F0FDF4' : '#F0F6FF',
    backgroundAlt: brand === 'orange' ? '#FBEFE6' : brand === 'emerald' ? '#E6F4EA' : '#E5EDFF',
    surface: '#FFFFFF',
    surfaceRaised: brand === 'orange' ? '#FBEFE6' : brand === 'emerald' ? '#E6F4EA' : '#E5EDFF',
    primary: b.primary,
    primaryDark: b.primaryDark,
    primarySoft: b.primarySoftLight,
    primaryText: '#FFFFFF',
    text: '#1A1A1A',
    textInverse: '#FFFFFF',
    muted: '#5A5550',
    border: brand === 'orange' ? '#F2D9C9' : brand === 'emerald' ? '#A7F3D0' : '#BFDBFE',
    borderStrong: brand === 'orange' ? '#E5C2AC' : brand === 'emerald' ? '#6EE7B7' : '#93C5FD',
    success: '#16A34A',
    successSoft: 'rgba(22,163,74,0.10)',
    danger: '#DC2626',
    dangerSoft: 'rgba(220,38,38,0.10)',
    warning: '#D97706',
    warningSoft: 'rgba(217,119,6,0.10)',
    shadow: brand === 'orange' ? '#A85A2A' : brand === 'emerald' ? '#065F46' : '#1E40AF',
    overlay: 'rgba(0,0,0,0.45)',
    tabBar: '#FFFFFF',
    tabBarBorder: brand === 'orange' ? '#F2D9C9' : brand === 'emerald' ? '#A7F3D0' : '#BFDBFE',
    tabBarActive: b.primary,
    tabBarInactive: '#5A5550',
  };
}

export const palettes: Record<ThemeMode, ThemePalette> = {
  dark: getPalette('dark', 'orange'),
  light: getPalette('light', 'orange'),
};

export type AppThemeValue = {
  theme: ThemePalette;
  themeName: ThemeMode;
  brandPreset: BrandPreset;
  toggleTheme: () => void;
  setBrandPreset: (brand: BrandPreset) => void;
};

export const AppThemeContext = createContext<AppThemeValue>({
  theme: palettes.dark,
  themeName: 'dark',
  brandPreset: 'orange',
  toggleTheme: () => {},
  setBrandPreset: () => {},
});

export function useAppTheme(): AppThemeValue {
  return useContext(AppThemeContext);
}

