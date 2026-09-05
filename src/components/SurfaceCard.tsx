import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/AppThemeContext';
import { elevation, radius, spacing } from '../theme/tokens';

// A themed container that replaces the ad-hoc `styles.card` blocks
// repeated across every screen. Supports tone variants and an optional
// "raised" depth.
export default function SurfaceCard({
  children,
  style,
  tone = 'default', // 'default' | 'raised' | 'flat'
  padding = spacing.lg,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'raised' | 'flat';
  padding?: number;
}) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const toneStyle = tone === 'flat'
    ? styles.flat
    : tone === 'raised'
      ? styles.raised
      : styles.default;

  return (
    <View
      style={[
        styles.base,
        toneStyle,
        { padding },
        style,
      ]}
      accessibilityRole="summary"
    >
      {children}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    base: {
      backgroundColor: theme.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
    },
    default: {
      ...elevation.card,
    },
    raised: {
      ...elevation.raised,
    },
    flat: {
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  });
}
