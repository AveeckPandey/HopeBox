import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { addDoc, collection, doc, getDoc, Timestamp } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useUser } from '../../contexts/UserContext';
import { logAction } from '../../services/audit';
import { logger } from '../../services/logger';
import { useLanguage } from '../../contexts/LanguageContext';
import { snackbar } from '../../hooks/useSnackbar';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import { layout, radius, spacing, type } from '../../theme/tokens';

export default function ScanQR({ navigation }) {
  const { theme } = useAppTheme();
  const { userData } = useUser();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const { t: tAll } = useLanguage();
  const t = tAll('scan');
  const styles = useMemo(() => createStyles(theme), [theme]);

  // QR payload validation. Firestore auto-generated document IDs are
  // 20 alphanumeric characters by default; we accept any 1–64
  // printable, path-safe character (letters, digits, `-`, `_`).
  // Anything else is either junk or an attempted traversal — we
  // skip the network round-trip and show a friendly "not a box" message.
  function isValidBoxId(s) {
    if (typeof s !== 'string') return false;
    if (s.length === 0 || s.length > 64) return false;
    return /^[A-Za-z0-9_-]+$/.test(s);
  }

  const handleScan = async ({ data }) => {
    if (scanned) {
      // P29: cooldown feedback. Without this, users tap the QR
      // code, nothing happens, and they don't know whether the
      // app registered the tap. An info-level snackbar confirms
      // the tap was caught and the camera is paused.
      snackbar.info(t.cooldownShort);
      return;
    }
    setScanned(true);
    if (!isValidBoxId(data)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      snackbar.error(t.invalidCode);
      setTimeout(() => setScanned(false), 1500);
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const docRef = doc(db, 'boxes', data);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const boxId = docSnap.id;
        await addDoc(collection(db, 'scanHistory'), {
          boxId,
          action: 'scanned',
          userId: userData?.id || 'unknown',
          userName: userData?.name || 'Unknown',
          timestamp: Timestamp.now(),
        });
        await addDoc(collection(db, 'boxes', boxId, 'scanHistory'), {
          action: 'scanned',
          userId: userData?.id || 'unknown',
          userName: userData?.name || 'Unknown',
          timestamp: Timestamp.now(),
        });
        await logAction('qr_scanned', { boxId }, userData?.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate('BoxDetails', { item: { id: docSnap.id, ...docSnap.data() } });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        snackbar.error(t.boxNotFound);
      }
    } catch (err) {
      logger.logError('ScanQR/scan', err, { value: String(data).slice(0, 80) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      snackbar.error(t.scanFailed);
    }
    setTimeout(() => setScanned(false), 2000);
  };

  if (!permission) {
    return (
      <View style={styles.stateScreen}>
        <View style={styles.contentWrap}>
          <SurfaceCard>
            <ScreenHeader title={t.preparing} subtitle={t.preparingMessage} />
          </SurfaceCard>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.stateScreen}>
        <AmbientPad theme={theme} />
        <View style={styles.contentWrap}>
          <SurfaceCard>
            <ScreenHeader title={t.permissionTitle} subtitle={t.permissionMessage} />
            <Pressable
              onPress={requestPermission}
              accessibilityRole="button"
              accessibilityLabel={t.permissionCta}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.ctaText, { color: theme.primaryText }]}>{t.permissionCta}</Text>
            </Pressable>
          </SurfaceCard>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        // P56: accept the full set of 1D and 2D barcodes that
        // NGO suppliers actually print. The previous `['qr']`
        // setting required a phone-only flow; field staff handed
        // a Code 128 label by a partner org would see "no
        // barcode found". Order matters: QR is checked first
        // because it's our own generated format.
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e'],
        }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />
      <View style={styles.overlay}>
        <View style={styles.contentWrap}>
          <Text style={styles.eyebrow}>{t.eyebrow}</Text>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{t.subtitle}</Text>

          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft, { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.topRight, { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.primary }]} />
            <View style={[styles.corner, styles.bottomRight, { borderColor: theme.primary }]} />
          </View>

          {scanned ? (
            <View
              style={[
                styles.cooldownChip,
                { backgroundColor: theme.primarySoft, borderColor: theme.primary },
              ]}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={t.cooldownChip}
            >
              <MaterialCommunityIcons name="timer-sand" size={16} color={theme.primary} />
              <Text style={[styles.cooldownChipText, { color: theme.primary }]}>{t.cooldownChip}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t.back}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: 'rgba(0,0,0,0.6)', opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.backText}>{t.back}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AmbientPad({ theme }) {
  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.background }]} pointerEvents="none" />
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#000000' },
    stateScreen: { flex: 1, backgroundColor: theme.background, justifyContent: 'center' },
    contentWrap: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      padding: spacing.lg,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    eyebrow: {
      ...type.eyebrow,
      color: '#FFFFFF',
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    title: {
      ...type.display,
      color: '#FFFFFF',
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      ...type.body,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    scanFrame: {
      width: 240,
      height: 240,
      marginBottom: spacing.xl,
    },
    corner: {
      position: 'absolute',
      width: 56,
      height: 56,
    },
    cooldownChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill || 999,
      borderWidth: 1,
      marginTop: spacing.lg,
    },
    cooldownChipText: { ...type.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    topLeft: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 24 },
    topRight: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 24 },
    bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 24 },
    bottomRight: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 24 },
    backButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      minHeight: 48,
      minWidth: 140,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backText: {
      ...type.bodyStrong,
      color: '#FFFFFF',
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
    cta: {
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.lg,
    },
    ctaText: {
      ...type.bodyStrong,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
  });
}
