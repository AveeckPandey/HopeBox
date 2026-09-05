import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/AppThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  acknowledgePermissionError,
  subscribeToPermissionErrors,
  type PermissionErrorEvent,
} from '../hooks/reportPermissionError';
import { spacing, type } from '../theme/tokens';

// Listens to the `reportPermissionError` emitter and shows a single
// dismissable banner when ANY Firestore listener in the app gets a
// permission-denied error. Without this, the same error prints to
// the console 4-5 times (once per affected screen) and the user has
// no UI signal that something is missing.
//
// The banner is intentionally quiet: it doesn't vibrate, doesn't
// push a snackbar, and doesn't block input. A red warning bar
// floating above the tab bar is enough to tell staff "ask an
// admin" without interrupting their flow.

export default function PermissionBanner() {
  const { theme } = useAppTheme();
  const { t: tAll } = useLanguage();
  const tCommon = tAll('common') as { permissionDeniedTitle?: string; permissionDeniedMessage?: string; dismiss?: string };
  const [event, setEvent] = useState<PermissionErrorEvent | null>(null);
  const [translateY] = useState(() => new Animated.Value(-120));
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    const unsubscribe = subscribeToPermissionErrors((next) => {
      setEvent(next);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 220,
        damping: 24,
      }).start();
    });
    return () => { unsubscribe(); };
  }, [translateY]);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: -120,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setEvent(null);
        acknowledgePermissionError();
      }
    });
  };

  if (!event) return null;

  return (
    <Animated.View
      style={[styles.root, { transform: [{ translateY }] }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={styles.bar}>
        <MaterialCommunityIcons
          name="shield-alert-outline"
          size={20}
          color={theme.danger}
          accessible={false}
        />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {tCommon.permissionDeniedTitle}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {tCommon.permissionDeniedMessage}
          </Text>
        </View>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={tCommon.dismiss}
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
        >
          <MaterialCommunityIcons name="close" size={18} color={theme.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    root: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      zIndex: 100,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: theme.dangerSoft,
      borderColor: theme.danger,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    text: { flex: 1 },
    title: {
      ...type.caption,
      color: theme.danger,
      fontWeight: '700',
    },
    message: {
      ...type.caption,
      color: theme.text,
      marginTop: 2,
    },
    close: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
  });
}
