import { createContext, useContext } from 'react';

// Black + Deep Orange brand palette.
// Primary is the same in both modes (burnt orange #EA580C) so the brand
// reads identically regardless of theme choice.

export type ThemeMode = 'dark' | 'light';

export type ThemePalette = {
  mode: ThemeMode;
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

export const palettes: Record<ThemeMode, ThemePalette> = {
  dark: {
    mode: 'dark',
    // Surfaces
    background: '#0A0A0A',
    backgroundAlt: '#101010',
    surface: '#161616',
    surfaceRaised: '#1F1F1F',
    // Brand
    primary: '#EA580C',
    primaryDark: '#C2410C',
    primarySoft: 'rgba(234,88,12,0.14)',
    primaryText: '#FFFFFF',
    // Text
    text: '#F5F2EC',
    textInverse: '#0A0A0A',
    muted: '#A8A29A',
    // Lines
    border: '#2A2A2A',
    borderStrong: '#3A3A3A',
    // Status
    success: '#4ADE80',
    successSoft: 'rgba(74,222,128,0.14)',
    danger: '#F87171',
    dangerSoft: 'rgba(248,113,113,0.14)',
    warning: '#FBBF24',
    warningSoft: 'rgba(251,191,36,0.14)',
    // Effects
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.65)',
    // Tab bar
    tabBar: '#0A0A0A',
    tabBarBorder: '#1F1F1F',
    tabBarActive: '#EA580C',
    tabBarInactive: '#A8A29A',
  },
  light: {
    mode: 'light',
    background: '#FFF7F2',
    backgroundAlt: '#FBEFE6',
    surface: '#FFFFFF',
    surfaceRaised: '#FBEFE6',
    primary: '#EA580C',
    primaryDark: '#C2410C',
    primarySoft: 'rgba(234,88,12,0.10)',
    primaryText: '#FFFFFF',
    text: '#1A1A1A',
    textInverse: '#FFFFFF',
    muted: '#5A5550',
    border: '#F2D9C9',
    borderStrong: '#E5C2AC',
    success: '#16A34A',
    successSoft: 'rgba(22,163,74,0.10)',
    danger: '#DC2626',
    dangerSoft: 'rgba(220,38,38,0.10)',
    warning: '#D97706',
    warningSoft: 'rgba(217,119,6,0.10)',
    shadow: '#A85A2A',
    overlay: 'rgba(0,0,0,0.45)',
    tabBar: '#FFFFFF',
    tabBarBorder: '#F2D9C9',
    tabBarActive: '#EA580C',
    tabBarInactive: '#5A5550',
  },
};

export type AppThemeValue = {
  theme: ThemePalette;
  themeName: ThemeMode;
  toggleTheme: () => void;
};

export const AppThemeContext = createContext<AppThemeValue>({
  theme: palettes.dark,
  themeName: 'dark',
  toggleTheme: () => {},
});

export function useAppTheme(): AppThemeValue {
  return useContext(AppThemeContext);
}
