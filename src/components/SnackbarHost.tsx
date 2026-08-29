import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { useAppTheme } from '../theme/AppThemeContext';
import { useSnackbarHost } from '../hooks/useSnackbar';

// Mounted once near the root. Subscribes to the snackbar emitter and
// renders a themed Paper Snackbar. Drop-in replacement for `Alert.alert`
// across the app.
//
// The previous version copied `next` into local `current` state
// inside the render body. That triggered a "Cannot update a component
// while rendering" warning and an extra render per snackbar. The
// current version moves the copy into a useEffect, gated on the
// message identity so identical messages don't re-show the snackbar.
export default function SnackbarHost() {
  const { theme } = useAppTheme();
  const next = useSnackbarHost();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);
  // Tracking the last-shown message in a ref lets the effect fire
  // only on genuinely new messages without re-running when `current`
  // changes (which would cause an infinite loop because the effect
  // would update `current` and re-trigger itself).
  const lastMessageRef = useRef(null);

  useEffect(() => {
    if (next && next.message !== lastMessageRef.current) {
      lastMessageRef.current = next.message;
      setCurrent(next);
      setVisible(true);
    }
  }, [next]);

  const tone = current?.tone || 'info';
  const bg =
    tone === 'success' ? theme.success :
    tone === 'error'   ? theme.danger  :
    theme.primary;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Snackbar
        visible={visible}
        onDismiss={() => setVisible(false)}
        duration={current?.duration || 3000}
        style={[styles.bar, { backgroundColor: bg }]}
        action={
          current?.action ? {
            label: current.action,
            onPress: () => {
              current.onAction?.();
              setVisible(false);
            },
            labelStyle: { color: theme.primaryText, fontWeight: '700' },
          } : undefined
        }
      >
        <Text style={{ color: theme.primaryText, fontSize: 14, fontWeight: '600' }}>
          {current?.message || ''}
        </Text>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bar: { borderRadius: 12, marginHorizontal: 12, marginBottom: 12 },
});
