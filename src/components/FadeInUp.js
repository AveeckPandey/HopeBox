import { useLayoutEffect } from 'react';
import { Platform, StyleSheet, UIManager } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Smooth fade + slide-up entrance. Replaces the hand-rolled
// `Animated.parallel(fade + slide)` blocks used in 4 screens.
//
// Why useLayoutEffect instead of useEffect: the original "auth
// screens permanently invisible" symptom came from the worklet
// runtime still warming up on cold start. The entrance was
// scheduled in useEffect, which fires *after* paint, and in the
// gap the screen was rendered at opacity 0. useLayoutEffect
// fires synchronously after the tree is built but before paint,
// so the animation is queued before the first frame is shown.
//
// Why the initial opacity is 0.001 and not 0: if the worklet is
// still bootstrapping when the first frame is drawn, the user
// would otherwise see a fully transparent screen. 0.001 is
// effectively invisible (no visible flash) but tells the worklet
// "this is the starting value, animate from here."
export default function FadeInUp({
  children,
  delay = 0,
  duration = 520,
  distance = 24,
  style,
}) {
  // Start the shared value at a barely-visible 0.001 so that if
  // the worklet runtime hasn't bootstrapped by the time the
  // first frame is drawn, the user still sees content (instead
  // of a fully transparent screen). useLayoutEffect below kicks
  // off the proper animation before paint; this is the safety
  // net for that race.
  const progress = useSharedValue(0.001);

  useLayoutEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
    );
    return () => {
      // Reset so the next mount animates again. Without this, a
      // re-mount of the same component (e.g. theme toggle) shows
      // the final frame instantly.
      progress.value = 0.001;
    };
  }, [delay, duration, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[styles.fill, animated, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { width: '100%' },
});
