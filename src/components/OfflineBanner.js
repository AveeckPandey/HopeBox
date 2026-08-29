// P25: offline banner. Mounts a thin strip across the top of the
// navigator when `useNetwork().isOffline` is true. Uses the same
// slide-down animation as the PermissionBanner so the two feel
// consistent.
//
// The banner is fully theme-aware (uses primarySoft in light mode
// and a muted raised surface in dark mode). Tap is a no-op; the
// banner is purely informational.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAppTheme } from '../theme/AppThemeContext';
import { useNetwork } from '../contexts/NetworkContext';
import { useLanguage } from '../contexts/LanguageContext';
import { spacing, type } from '../theme/tokens';

export default function OfflineBanner() {
  const { theme } = useAppTheme();
  const { isOffline } = useNetwork();
  const { t: tAll } = useLanguage();
  const t = tAll('common');
  const slide = useRef(new Animated.Value(0));

  useEffect(() => {
    Animated.spring(slide.current, {
      toValue: isOffline ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [isOffline, slide]);

  // Render always so the slide-out animation has a node to
  // transition from; the translate keeps the banner out of the
  // hit area when offline=false. The `slide.current.interpolate`
  // call is intentional — `Animated.Value` exposes `interpolate` as
  // a method on its mutable ref, and there is no React-idiomatic
  // way to derive an AnimatedInterpolation outside render. The
  // interpolation is referentially stable for the lifetime of the
  // underlying value, so it does not retrigger animations.
  // eslint-disable-next-line react-hooks/refs
  const translateY = slide.current.interpolate({
    inputRange: [0, 1],
    outputRange: [-64, 0],
  });

  return (
    <Animated.View
      pointerEvents={isOffline ? 'auto' : 'none'}
      style={[
        styles.wrap,
        { backgroundColor: theme.warningSoft || theme.primarySoft, borderColor: theme.warning || theme.primary },
        { transform: [{ translateY }] },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={t.offline || 'You are offline. Changes will sync when connection returns.'}
    >
      <Pressable style={styles.row} disabled>
        <MaterialCommunityIcons name="wifi-off" size={18} color={theme.warning || theme.primary} />
        <Text style={[styles.text, { color: theme.warning || theme.primary }]}>
          {t.offline || 'You are offline. Changes will sync when connection returns.'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    zIndex: 50,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  text: { ...type.bodyStrong, flexShrink: 1 },
});
