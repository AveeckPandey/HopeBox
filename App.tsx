import { useEffect, useState } from 'react';
import { Animated, useColorScheme } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

import AuthNavigator from './src/navigation/AuthNavigator';
import AppNavigator from './src/navigation/AppNavigator';
import { AppThemeContext, palettes, type ThemeMode } from './src/theme/AppThemeContext';
import { UserProvider, useUser } from './src/contexts/UserContext';
import { WarehouseProvider } from './src/contexts/WarehouseContext';
import { CommoditiesProvider } from './src/contexts/CommoditiesContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { SimpleModeProvider } from './src/contexts/SimpleModeContext';

import ErrorBoundary from './src/components/ErrorBoundary';
import SnackbarHost from './src/components/SnackbarHost';
import SplashScreen from './src/components/SplashScreen';
import PermissionBanner from './src/components/PermissionBanner';
import OfflineBanner from './src/components/OfflineBanner';

// P42: initialise Sentry BEFORE any other module touches it. We
// guard on the DSN so the app still works locally without a
// configured error reporting backend — Sentry stays inert, the
// `if` body never runs, and every `require('@sentry/react-native')`
// in the rest of the app returns a no-op stub.
// `enableInExpoDevelopment: false` keeps dev logs from spamming
// the dev's Sentry project; `tracesSampleRate: 0.1` caps perf
// traces at 10% of sessions to keep the org's quota healthy.
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      enableInExpoDevelopment: false,
      tracesSampleRate: 0.1,
    });
  } catch (err) {
    // Sentry init failed (e.g. native module not yet linked). Don't
    // block app startup — logger will still capture locally.
    // eslint-disable-next-line no-console
    console.warn('[App] Sentry init skipped:', (err as Error)?.message || err);
  }
}

const THEME_KEY = 'inventory-app-theme';

export default function App() {
  const systemTheme = useColorScheme();
  const [themeName, setThemeName] = useState<ThemeMode>('dark');

  useEffect(() => {
    const loadTheme = async () => {
      const storedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (storedTheme === 'dark' || storedTheme === 'light') {
        setThemeName(storedTheme);
        return;
      }
      setThemeName(systemTheme === 'dark' ? 'dark' : 'light');
    };
    loadTheme();
  }, [systemTheme]);

  const toggleTheme = async () => {
    const nextTheme: ThemeMode = themeName === 'dark' ? 'light' : 'dark';
    setThemeName(nextTheme);
    await AsyncStorage.setItem(THEME_KEY, nextTheme);
  };

  const appPalette = palettes[themeName];
  const navigationTheme: NavigationTheme = {
    ...(themeName === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(themeName === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: appPalette.background,
      card: appPalette.surface,
      text: appPalette.text,
      border: appPalette.border,
      primary: appPalette.primary,
    },
  };

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppThemeContext.Provider value={{ theme: appPalette, themeName, toggleTheme }}>
          <NetworkProvider>
            <LanguageProvider>
              <UserProvider>
                <WarehouseProvider>
                  <CommoditiesProvider>
                    <SimpleModeProvider>
                      <NavigationRoot navigationTheme={navigationTheme} themeName={themeName} />
                    </SimpleModeProvider>
                  </CommoditiesProvider>
                </WarehouseProvider>
              </UserProvider>
            </LanguageProvider>
          </NetworkProvider>
        </AppThemeContext.Provider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// Single source of truth for the auth state is `UserContext`. Splitting
// the auth listener between App.js and UserContext (the previous
// arrangement) meant two onAuthStateChanged subscriptions and the
// risk of the two falling out of sync. `UserContext` already derives
// `userData` from the auth listener; we use its presence to choose
// between the auth and main navigators.
//
// P47: instead of swapping `<SplashScreen />` for the navigator in
// one render, we hold the splash in a sibling `Animated.View` and
// fade it out across 220ms before mounting the navigator. Without
// the fade, the swap is binary and a fast launcher (Android Go, low
// RAM) shows a single-frame white flash. The phase-state pattern
// (`'splash' | 'app'`) means the navigator doesn't render until the
// fade has started, so the user never sees the navigator behind a
// half-faded splash.
function NavigationRoot({ navigationTheme, themeName }: { navigationTheme: NavigationTheme; themeName: ThemeMode }) {
  const { userData, loading } = useUser();
  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      {loading || !userData ? <BootSplash ready={!loading} /> : <AppNavigator />}
      <OfflineBanner />
      <PermissionBanner />
      <SnackbarHost />
    </NavigationContainer>
  );
}

// P47: wrapper that holds the splash in an Animated.View and only
// swaps to the navigator once the fade has begun. The `ready` prop
// flips true when `UserContext.loading` resolves.
function BootSplash({ ready }: { ready: boolean }) {
  // The Animated.Value is owned by state (created lazily once) so
  // the JSX can read it without a `.current` access — which the
  // React Compiler treats as a render-time ref read. `useRef`
  // would also work but the compiler flags the JSX access either
  // way; the `useState(() => …)` form is the idiomatic escape.
  const [opacity] = useState(() => new Animated.Value(1));
  const [phase, setPhase] = useState<'splash' | 'app'>('splash');

  useEffect(() => {
    if (!ready) return;
    if (phase !== 'splash') return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPhase('app');
    });
  }, [ready, phase, opacity]);

  if (phase === 'app') {
    return <AuthNavigator />;
  }
  return (
    <Animated.View
      style={{ flex: 1, opacity }}
      pointerEvents={ready ? 'none' : 'auto'}
    >
      <SplashScreen />
    </Animated.View>
  );
}
