import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/AppThemeContext';

// Soft, blurred brand-colored circles used as ambient background.
// Replaces the ad-hoc `glowTop` / `glowBottom` Views in SignIn, SignUp,
// Dashboard, etc. Pass a `variant` to control placement.
export default function AmbientGlow({ variant = 'dual', opacity = 1 }) {
  const { theme } = useAppTheme();
  const styles = createStyles(theme, opacity);

  if (variant === 'top') {
    return <View style={[styles.glow, styles.top]} pointerEvents="none" />;
  }
  if (variant === 'bottom') {
    return <View style={[styles.glow, styles.bottom]} pointerEvents="none" />;
  }
  if (variant === 'topLeft') {
    return <View style={[styles.glow, styles.topLeft]} pointerEvents="none" />;
  }
  if (variant === 'bottomRight') {
    return <View style={[styles.glow, styles.bottomRight]} pointerEvents="none" />;
  }
  return (
    <>
      <View style={[styles.glow, styles.top]} pointerEvents="none" />
      <View style={[styles.glow, styles.bottom]} pointerEvents="none" />
    </>
  );
}

function createStyles(theme, opacityMultiplier) {
  const baseOpacity = theme.mode === 'dark' ? 0.16 : 0.12;
  const o = baseOpacity * opacityMultiplier;
  return StyleSheet.create({
    glow: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: theme.primary,
      opacity: o,
    },
    top: { top: -100, right: -40 },
    topLeft: { top: -80, left: '20%' },
    bottom: { bottom: -80, left: -30 },
    bottomRight: { bottom: 60, left: -60 },
  });
}
