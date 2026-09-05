import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/AppThemeContext';
import { spacing, type } from '../theme/tokens';

// Shown while the auth/role lookup is in flight. The previous
// behaviour — `loading ? null : <Navigator/>` — left a blank
// background flash for 200-800ms on cold start. Rendering this
// component fills that gap with a branded, themed surface and a
// small spinner so the user knows the app is alive.
//
// Once `userData` resolves (in UserContext), App.js swaps back to
// the auth or main navigator. The swap is instant — no exit
// animation — because the splash and the first screen share the
// same background.
export default function SplashScreen({ message }: { message?: string }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message || 'Loading HopeBox'}
    >
      <View style={styles.brand}>
        <Text style={styles.title}>HopeBox</Text>
        <Text style={styles.tagline}>QR inventory for NGOs</Text>
      </View>
      <ActivityIndicator
        size="small"
        color={theme.primary}
        style={styles.spinner}
        accessible={false}
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    brand: { alignItems: 'center' },
    title: {
      ...type.display,
      color: theme.text,
      letterSpacing: -1,
    },
    tagline: {
      ...type.caption,
      color: theme.muted,
      marginTop: spacing.xs,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    spinner: { marginTop: spacing.xxl },
    message: {
      ...type.caption,
      color: theme.muted,
      marginTop: spacing.lg,
    },
  });
}
