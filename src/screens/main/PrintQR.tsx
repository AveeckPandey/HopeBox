import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// P11: `expo-file-system` SDK 54+ removed the legacy `FileSystem`
// namespace from the package root. The deprecation notes point to
// `expo-file-system/legacy` for the old `writeAsStringAsync` /
// `EncodingType` API. The legacy subpath exports individual
// functions rather than a `FileSystem` namespace, so we destructure
// the exact call we need. `EncodingType` lives in a sibling types
// subpath and is imported separately. Once the project drops
// support for older SDKs, this can move to the new `File` class
// (`new File(uri).write(content, options)`).
import * as FileSystem from 'expo-file-system/legacy';
import { EncodingType } from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';

import { useAppTheme } from '../../theme/AppThemeContext';
import { useCommodities } from '../../contexts/CommoditiesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { snackbar } from '../../hooks/useSnackbar';
import { lineQty } from '../../services/boxLines';
import { logger } from '../../services/logger';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import MetricTile from '../../components/MetricTile';
import EmptyState from '../../components/EmptyState';
import FadeInUp from '../../components/FadeInUp';
import AmbientGlow from '../../components/AmbientGlow';
import { layout, radius, spacing, type } from '../../theme/tokens';
import { buildPrintLabelHtml } from '../../templates/printLabel';

export default function PrintQR({ route, navigation }) {
  const { theme } = useAppTheme();
  const { commodities, byId } = useCommodities();
  const { t: tAll } = useLanguage();
  const t = tAll('print');
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const qrRef = useRef(null);
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Defensive guard for missing `item` param. Lives after all
  // hook calls so the rules of hooks are satisfied.
  const item = route?.params?.item;
  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <EmptyState
          icon="qrcode"
          title="No box to print"
          message="Pick a box from the registry to print its QR label."
          actionLabel="Back to boxes"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const getQrFileUri = () => `${FileSystem.documentDirectory}qr-${item.id}.png`;

  const getQrDataUrl = (): Promise<string> =>
    new Promise((resolve, reject) => {
      if (!qrRef.current) { reject(new Error('QR ref not ready')); return; }
      qrRef.current.toDataURL((base64: string | undefined) => {
        if (!base64) { reject(new Error('QR export failed')); return; }
        resolve(`data:image/png;base64,${base64}`);
      });
    });

  const saveQrFile = async () => {
    const qrDataUrl: string = await getQrDataUrl();
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const fileUri = getQrFileUri();
    await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: EncodingType.Base64 });
    return { fileUri, qrDataUrl };
  };

  const handleDownload = async () => {
    try {
      setIsSaving(true);
      const { fileUri } = await saveQrFile();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { dialogTitle: 'Save or share QR image', mimeType: 'image/png', UTI: 'public.png' });
      }
      snackbar.success(canShare ? t.saved : `${t.saved}: ${fileUri}`);
    } catch (err) {
      logger.logError('PrintQR/save', err, { boxId: item?.id });
      snackbar.error(t.saveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      const { qrDataUrl } = await saveQrFile();
      const html = buildPrintLabelHtml(item, qrDataUrl, byId);
      await Print.printAsync({ html });
    } catch (err) {
      logger.logError('PrintQR/print', err, { boxId: item?.id });
      snackbar.error(t.printFailed);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AmbientGlow variant="topLeft" opacity={0.5} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.contentWrap}>
          <FadeInUp delay={0}>
            <ScreenHeader
              eyebrow={t.eyebrow}
              title={t.title}
              subtitle={t.subtitle}
              right={
                <IconButton
                  icon="download"
                  mode="contained"
                  size={22}
                  iconColor={theme.primaryText}
                  containerColor={theme.primary}
                  accessibilityLabel={t.download}
                  onPress={handleDownload}
                  disabled={isSaving}
                />
              }
            />
          </FadeInUp>

          <FadeInUp delay={80}>
            <SurfaceCard>
              <View style={[styles.qrPanel, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                <View style={styles.qrFrame}>
                  <QRCode
                    getRef={(ref) => { qrRef.current = ref; }}
                    value={item.id}
                    size={220}
                    color="#000000"
                    backgroundColor={theme.surfaceRaised}
                  />
                </View>
                {(isSaving || isPrinting) ? (
                  <ActivityIndicator color={theme.primary} size="small" style={styles.loader} />
                ) : null}
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={handleDownload}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={t.download}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary, opacity: isSaving ? 0.6 : pressed ? 0.85 : 1 },
                  ]}
                >
                  <MaterialCommunityIcons name="download" size={18} color={theme.primaryText} />
                  <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>
                    {isSaving ? t.saving : t.download}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handlePrint}
                  disabled={isPrinting}
                  accessibilityRole="button"
                  accessibilityLabel={t.print}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.border, opacity: isPrinting ? 0.6 : pressed ? 0.85 : 1 },
                  ]}
                >
                  <MaterialCommunityIcons name="printer-outline" size={18} color={theme.text} />
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                    {isPrinting ? t.opening : t.print}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.detailGrid}>
                <MetricTile label="Box ID" value={item.id} numberOfLines={2} />
                {commodities.map((c) => {
                  const v =
                    item.contents && item.contents[c.id] != null
                      ? lineQty(item.contents[c.id])
                      : item[c.id];
                  if (!v) return null;
                  return <MetricTile key={c.id} label={c.name} value={v} unit={c.unit} />;
                })}
                {item.category ? <MetricTile label="Category" value={item.category} /> : null}
                {item.donorName ? <MetricTile label="Donor" value={item.donorName} /> : null}
              </View>
            </SurfaceCard>
          </FadeInUp>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingBottom: spacing.xxl, paddingTop: spacing.lg },
    contentWrap: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.lg,
    },
    qrPanel: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 260,
      marginBottom: spacing.lg,
    },
    qrFrame: { borderRadius: radius.md, overflow: 'hidden' },
    loader: { marginTop: spacing.md },
    actionsRow: { gap: spacing.md, marginBottom: spacing.lg },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      minHeight: 52,
    },
    primaryButtonText: { ...type.bodyStrong, textTransform: 'uppercase', letterSpacing: 1.5 },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      minHeight: 52,
    },
    secondaryButtonText: { ...type.bodyStrong, textTransform: 'uppercase', letterSpacing: 1.5 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  });
}
