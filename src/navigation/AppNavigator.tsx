import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAppTheme } from '../theme/AppThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { layout, spacing, type } from '../theme/tokens';

import Dashboard from '../screens/main/Dashboard';
import Boxes from '../screens/main/Boxes';
import BoxDetails from '../screens/main/BoxDetails';
import AddBox from '../screens/main/AddBox';
import EditBox from '../screens/main/EditBox';
import PrintQR from '../screens/main/PrintQR';
import ScanQR from '../screens/main/ScanQR';
import Analytics from '../screens/main/Analytics';
import AdminInventory from '../screens/main/AdminInventory';
import AuditLog from '../screens/main/AuditLog';
import Settings from '../screens/main/Settings';
import Commodities from '../screens/main/Commodities';
import Templates from '../screens/main/Templates';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Custom themed tab bar — keeps brand consistency (black surface,
// orange active state) and respects safe-area insets.
function CustomTabBar({ state, descriptors, navigation }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  // P40: memoize createStyles so the StyleSheet object is
  // referentially stable across tab presses. The tab bar re-renders
  // on every navigation event; without useMemo, createStyles rebuilds
  // the whole StyleSheet on each render and the tab Pressables
  // see fresh style objects, defeating the work React Navigation
  // does to keep the bar stable.
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, spacing.sm), height: layout.tabBarHeight + insets.bottom },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const color = isFocused ? theme.tabBarActive : theme.tabBarInactive;
        const iconName = options.tabBarIconName;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={`${label} tab`}
            onPress={onPress}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name={iconName} size={24} color={color} />
            <Text
              style={[styles.label, { color }, isFocused && styles.labelActive]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {isFocused ? (
              <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// One root stack holds every screen. Tabs are rendered as a screen
// inside the stack so any tab can navigate to any flow screen
// (e.g. Scan → BoxDetails) without cross-stack wiring.
function MainTabs() {
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      id="MainTabs"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      screenOptions={{ headerShown: false } as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tabBar={(props: any) => <CustomTabBar {...props} />}
    >
      <Tab.Screen
        name="Home"
        component={Dashboard}
        options={{
          title: t('dashboard.title'),
          tabBarLabel: t('dashboard.title'),
          tabBarIconName: 'view-dashboard-outline',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any}
      />
      <Tab.Screen
        name="Boxes"
        component={Boxes}
        options={{
          title: t('boxes.title'),
          tabBarLabel: t('boxes.title'),
          tabBarIconName: 'package-variant-closed',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any}
      />
      <Tab.Screen
        name="Scan"
        component={ScanQR}
        options={{
          title: t('scan.title'),
          tabBarLabel: t('scan.title'),
          tabBarIconName: 'qrcode-scan',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any}
      />
      <Tab.Screen
        name="Analytics"
        component={Analytics}
        options={{
          title: t('analytics.title'),
          tabBarLabel: t('analytics.title'),
          tabBarIconName: 'chart-bar',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any}
      />
      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{
          title: t('settings.title'),
          tabBarLabel: t('settings.title'),
          tabBarIconName: 'cog-outline',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Stack.Navigator id="Root" screenOptions={{ headerShown: false } as any}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="BoxDetails" component={BoxDetails} />
      <Stack.Screen name="AddBox" component={AddBox} />
      <Stack.Screen name="EditBox" component={EditBox} />
      <Stack.Screen name="PrintQR" component={PrintQR} />
      <Stack.Screen name="AdminInventory" component={AdminInventory} />
      <Stack.Screen name="AuditLog" component={AuditLog} />
      <Stack.Screen name="Commodities" component={Commodities} />
      <Stack.Screen name="Templates" component={Templates} />
    </Stack.Navigator>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: theme.tabBar,
      borderTopWidth: 1,
      borderTopColor: theme.tabBarBorder,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.xs,
      gap: 2,
    },
    label: {
      ...type.caption,
      fontSize: 11,
      marginTop: 2,
    },
    labelActive: { fontWeight: '800' },
    activeDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginTop: 2,
    },
  });
}
