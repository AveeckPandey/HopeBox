import QRCode from 'react-native-qrcode-svg';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
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
export default function QrModal({ visible, value, onClose, label, helperText, closeLabel, closePreviewLabel }) {
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
        accessibilityLabel={closePreviewLabel}
      >
        <Pressable
          // Inner pressable absorbs taps so the outer dismiss
          // doesn't fire when the user taps the QR itself.
          style={styles.card}
          onPress={() => {}}
          accessible={false}
        >
          <QRCode value={value} size={240} color="#000000" backgroundColor="#FFFFFF" />
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
            <Text style={styles.closeText}>{closeLabel}</Text>
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
