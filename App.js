import { useEffect, useState } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

import AuthNavigator from './src/navigation/AuthNavigator';
import AppNavigator from './src/navigation/AppNavigator';
import { AppThemeContext, palettes } from './src/theme/AppThemeContext';
import { UserProvider, useUser } from './src/contexts/UserContext';
import { WarehouseProvider } from './src/contexts/WarehouseContext';
import { CommoditiesProvider } from './src/contexts/CommoditiesContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { NetworkProvider } from './src/contexts/NetworkContext';

import ErrorBoundary from './src/components/ErrorBoundary';
import SnackbarHost from './src/components/SnackbarHost';
import SplashScreen from './src/components/SplashScreen';
import PermissionBanner from './src/components/PermissionBanner';
import OfflineBanner from './src/components/OfflineBanner';

const THEME_KEY = 'inventory-app-theme';

export default function App() {
  const systemTheme = useColorScheme();
  const [themeName, setThemeName] = useState('dark');

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
    const nextTheme = themeName === 'dark' ? 'light' : 'dark';
    setThemeName(nextTheme);
    await AsyncStorage.setItem(THEME_KEY, nextTheme);
  };

  const appPalette = palettes[themeName];
  const navigationTheme = {
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
                    <NavigationRoot navigationTheme={navigationTheme} themeName={themeName} />
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
function NavigationRoot({ navigationTheme, themeName }) {
  const { userData, loading } = useUser();
  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      {loading ? <SplashScreen /> : userData ? <AppNavigator /> : <AuthNavigator />}
      <OfflineBanner />
      <PermissionBanner />
      <SnackbarHost />
    </NavigationContainer>
  );
}
