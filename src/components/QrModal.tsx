import { useEffect, useState } from 'react';
import { InteractionManager, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// P34: full-screen QR modal. The Boxes list no longer renders
// the QR on every card — a small "View QR" button on each card
// opens this modal. That removes the per-row QR render cost:
// the QR is mounted exactly once, on demand.
//
// Why a Modal and not a screen push: the QR is a transient
// reference for a single box ID; routing it through
// navigation would force a screen header / back button /
// focus state for a 1-second interaction. The Modal is
// dismissed by tapping outside, the back button, or the
// explicit close button.
//
// `value` is what the QR encodes. For a box this is the box
// id. `visible` controls the modal. `onClose` fires on any
// dismiss path so the caller can clear its own state.
export default function QrModal({ visible, value, onClose, label, helperText }) {
  const [Component, setComponent] = useState(null);

  useEffect(() => {
    if (!visible) {
      setComponent(null);
      return undefined;
    }
    let cancelled = false;
    // InteractionManager delay keeps the QR module out of the
    // modal-open animation path. By the time the user releases
    // their finger, the underlying press animation has settled
    // and the QR is mounted underneath.
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const QR = require('react-native-qrcode-svg').default;
      setComponent(() => QR);
    });
    return () => {
      cancelled = true;
      if (handle && typeof handle.cancel === 'function') handle.cancel();
    };
  }, [visible, value]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close QR preview"
      >
        <Pressable
          // Inner pressable absorbs taps so the outer dismiss
          // doesn't fire when the user taps the QR itself.
          style={styles.card}
          onPress={() => {}}
        >
          {Component ? (
            <Component value={value} size={240} color="#000000" backgroundColor="#FFFFFF" />
          ) : (
            // Reserve the QR footprint so the card doesn't reflow.
            <View style={styles.qrPlaceholder} />
          )}
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    minWidth: 280,
  },
  qrPlaceholder: {
    width: 240,
    height: 240,
    backgroundColor: '#F5F5F5',
  },
  label: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
  helper: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    maxWidth: 240,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#000000',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 4,
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
