import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, runTransaction, Timestamp } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

import { db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useUser } from '../../contexts/UserContext';
import { useWarehouse } from '../../contexts/WarehouseContext';
import { useCommodities } from '../../contexts/CommoditiesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { logAction } from '../../services/audit';
import { logger } from '../../services/logger';
import { snackbar } from '../../hooks/useSnackbar';
import {
  applyBoxToInventory,
  findNegativeQuantities,
  flattenContents,
} from '../../services/inventoryMath';
import { lineQty } from '../../services/boxLines';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import MetricTile from '../../components/MetricTile';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import FadeInUp from '../../components/FadeInUp';
import AmbientGlow from '../../components/AmbientGlow';
import { layout, radius, spacing, type } from '../../theme/tokens';

export default function BoxDetails({ route, navigation }) {
  const { theme } = useAppTheme();
  const { userData } = useUser();
  const { currentWarehouse } = useWarehouse();
  const { commodities, byId } = useCommodities();
  const { t: tAll } = useLanguage();
  const t = tAll('boxDetails');
  const tCommon = tAll('common');
  const [scanHistory, setScanHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Read the route param up front. Hooks below need to reference it,
  // so we can't early-return before the hooks — we keep `routeItem`
  // as the source of truth and alias it to `item` after the
  // missing-param guard.
  const routeItem = route?.params?.item;

  // Build the canonical contents map (commodityId → {qty, batch, expiry, ...})
  // from the new shape, falling back to legacy `box.rice`/`box.dal`/
  // `box.sachets` so old boxes still render. Then flatten for math.
  const contents = useMemo(() => {
    if (!routeItem) return {};
    if (routeItem.contents && Object.keys(routeItem.contents).length > 0) {
      return routeItem.contents;
    }
    const legacy = {};
    for (const c of commodities) {
      if (routeItem[c.id] != null) legacy[c.id] = routeItem[c.id];
    }
    // Known legacy keys for the v1.0 fields.
    if (routeItem.rice != null) legacy.rice = routeItem.rice;
    if (routeItem.dal != null) legacy.dal = routeItem.dal;
    if (routeItem.sachets != null) legacy.sachets = routeItem.sachets;
    return legacy;
  }, [routeItem, commodities]);

  // Materialized lines for the display grid, in sort order, filtered
  // to commodities that actually appear on this box.
  const displayLines = useMemo(() => {
    const out = [];
    for (const c of commodities) {
      const line = contents[c.id];
      if (line == null) continue;
      out.push({ commodity: c, line });
    }
    return out;
  }, [commodities, contents]);

  // Pick the inventory doc this box writes to. The box carries its
  // own warehouseId (set at creation). When missing we fall back to
  // the user's current warehouse, then to the legacy 'main' doc.
  const inventoryDocId = useMemo(() => {
    return routeItem?.warehouseId || currentWarehouse?.id || 'main';
  }, [routeItem?.warehouseId, currentWarehouse?.id]);

  // Live subscription to this box's scanHistory subcollection so the
  // "Recent activity" card shows fresh entries as they happen. The
  // hook reads `routeItem?.id` so it tolerates a missing-route render
  // (it just doesn't subscribe).
  useEffect(() => {
    const boxId = routeItem?.id;
    if (!boxId) return undefined;
    const ref = collection(db, 'boxes', boxId, 'scanHistory');
    const q = query(ref, orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setScanHistory(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        logger.logWarning('BoxDetails/scanHistory', err.message, { boxId });
      }
    );
    return unsubscribe;
  }, [routeItem?.id]);

  // After all hooks, we can safely early-return when the route
  // didn't carry an item. From here down, `item` is the canonical
  // reference and we don't need to null-check it.
  if (!routeItem) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }]}>
        <EmptyState
          icon="cube-outline"
          title="No box selected"
          message="Open a box from the registry to view its details."
          actionLabel="Back to boxes"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }
  const item = routeItem;

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({});
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      return null;
    }
  };

  const applyInventoryChange = async (nextStatus) => {
    const boxRef = doc(db, 'boxes', item.id);
    const inventoryRef = doc(db, 'inventory', inventoryDocId);

    await runTransaction(db, async (transaction) => {
      const boxSnap = await transaction.get(boxRef);
      const inventorySnap = await transaction.get(inventoryRef);
      if (!boxSnap.exists()) throw new Error('Box not found');
      const currentBox = boxSnap.data();
      if (currentBox.status === nextStatus) return;
      // Recompute the box contents inside the transaction so a stale
      // closure can't apply the wrong qty (e.g. a mid-flight edit).
      const boxContents =
        currentBox.contents && Object.keys(currentBox.contents).length > 0
          ? currentBox.contents
          : {
              rice: currentBox.rice ?? 0,
              dal: currentBox.dal ?? 0,
              sachets: currentBox.sachets ?? 0,
            };
      const direction = nextStatus === 'dispatched' ? 'dispatch' : 'return';
      const currentInventory = inventorySnap.exists() ? inventorySnap.data() : {};
      // `applyBoxToInventory` works on flat numbers; for boxes that
      // carry batch/expiry metadata we extract just the qty. The
      // batch/expiry information stays on the box itself — the
      // inventory doc only tracks aggregate counts (FEFO is a derived
      // view across boxes).
      const flatBoxContents = flattenContents(boxContents);
      const nextInventory = applyBoxToInventory(currentInventory, flatBoxContents, direction);

      if (nextStatus === 'dispatched') {
        const negs = findNegativeQuantities(nextInventory);
        if (negs) {
          const names = Object.keys(negs)
            .map((cid) => byId[cid]?.name || cid)
            .join(', ');
          throw new Error(`Insufficient inventory for: ${names}`);
        }
      }
      transaction.set(inventoryRef, { ...nextInventory, updatedAt: Timestamp.now() });
      transaction.update(boxRef, { status: nextStatus });
    });
  };

  const performStatusChange = async (nextStatus) => {
    if (busy) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const location = await getCurrentLocation();
      await applyInventoryChange(nextStatus);
      await addDoc(collection(db, 'boxes', item.id, 'scanHistory'), {
        action: nextStatus,
        userId: userData?.id || 'unknown',
        userName: userData?.name || 'Unknown',
        location,
        timestamp: Timestamp.now(),
      });
      await logAction(`box_${nextStatus}`, { boxId: item.id, location }, userData?.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      snackbar.success(nextStatus === 'dispatched' ? t.dispatchSuccess : t.returnSuccess);
      navigation.goBack();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      logger.logError('BoxDetails/statusChange', err, { nextStatus });
      const message = err.message?.startsWith('Insufficient inventory')
        ? t.insufficientInventory
        : nextStatus === 'dispatched'
        ? t.dispatchFailed
        : t.returnFailed;
      snackbar.error(message);
    } finally {
      setBusy(false);
    }
  };

  // P23: confirm dispatch/return before applying the inventory
  // change. A dispatch is destructive (it decrements the
  // inventory); a return is reversible but still adjusts state.
  // Either way, an accidental tap on the wrong button should
  // never silently mutate the inventory.
  const confirmStatusChange = (nextStatus) => {
    if (busy) return;
    const isDispatch = nextStatus === 'dispatched';
    Alert.alert(
      isDispatch ? t.dispatchConfirmTitle : t.returnConfirmTitle,
      isDispatch ? t.dispatchConfirmMessage : t.returnConfirmMessage,
      [
        { text: tCommon.cancel, style: 'cancel' },
        {
          text: isDispatch ? t.dispatch : t.return,
          style: isDispatch ? 'destructive' : 'default',
          onPress: () => performStatusChange(nextStatus),
        },
      ]
    );
  };

  // P50: delete the box record (and its scanHistory subcollection
  // entries). Inventory is intentionally NOT touched — a deleted
  // box is a record removal, not a stock event. If the org needs
  // to "undo" a dispatched box, they use the Return flow, not
  // Delete.
  const confirmDelete = () => {
    if (busy) return;
    Alert.alert(
      t.deleteConfirmTitle,
      t.deleteConfirmMessage,
      [
        { text: tCommon.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              // Best-effort scanHistory cleanup. We don't fail the
              // delete if these fail — the box doc is the source
              // of truth for "this box exists."
              const historySnap = await (async () => {
                try {
                  return await getDocs(query(collection(db, 'boxes', item.id, 'scanHistory')));
                } catch {
                  return { forEach: () => {} };
                }
              })();
              const deletes = [];
              historySnap.forEach?.((d) => deletes.push(deleteDoc(doc(db, 'boxes', item.id, 'scanHistory', d.id))));
              await Promise.allSettled(deletes);
              await deleteDoc(doc(db, 'boxes', item.id));
              await logAction('box_deleted', { boxId: item.id }, userData?.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              snackbar.success(t.deleteSuccess);
              navigation.goBack();
            } catch (err) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              logger.logError('BoxDetails/delete', err, { boxId: item.id });
              snackbar.error(t.deleteFailed);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <AmbientGlow variant="topLeft" opacity={0.6} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.contentWrap}>
          <FadeInUp delay={0}>
            <ScreenHeader
              eyebrow={t.eyebrow}
              title={t.title}
              subtitle={t.subtitle}
              right={
                <View style={[styles.statusPill, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                  <StatusBadge status={item.status} size="sm" />
                </View>
              }
            />
          </FadeInUp>

          <FadeInUp delay={80}>
            <SurfaceCard>
              <View style={styles.metricGrid}>
                <MetricTile label="Box ID" value={item.id} numberOfLines={2} />
                {displayLines.length > 0 ? (
                  displayLines.map(({ commodity, line }) => (
                    <MetricTile
                      key={commodity.id}
                      label={commodity.name}
                      value={lineQty(line)}
                      unit={commodity.unit}
                    />
                  ))
                ) : (
                  <Text style={[styles.emptyContents, { color: theme.muted }]}>No contents recorded</Text>
                )}
              </View>

              {displayLines.some((d) => d.line.expiryDate) ? (
                <View style={[styles.expiryBlock, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
                  <Text style={[styles.eyebrow, { color: theme.muted }]}>Earliest expiry on this box</Text>
                  {displayLines
                    .filter((d) => d.line.expiryDate)
                    .map((d) => (
                      <Text key={d.commodity.id} style={[styles.expiryRow, { color: theme.text }]}>
                        {d.commodity.name}: {d.line.expiryDate}
                        {d.line.batchNumber ? ` · Batch ${d.line.batchNumber}` : ''}
                      </Text>
                    ))}
                </View>
              ) : null}

              {item.category ? (
                <InfoRow styles={styles} theme={theme} label="Category" value={item.category} />
              ) : null}
              {item.tags && item.tags.length > 0 ? (
                <InfoRow styles={styles} theme={theme} label="Tags" value={item.tags.join(', ')} />
              ) : null}
              {item.donorName ? (
                <InfoRow styles={styles} theme={theme} label="Donor" value={item.donorName} />
              ) : null}

              <View style={[styles.statusBlock, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
                <Text style={[styles.statusBlockLabel, { color: theme.muted }]}>{t.currentStatus}</Text>
                <StatusBadge status={item.status} />
              </View>

              <Pressable
                onPress={() => confirmStatusChange('dispatched')}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t.dispatch}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="truck-fast-outline" size={18} color={theme.primaryText} />
                <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>{t.dispatch}</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmStatusChange('returned')}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t.return}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.border, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="restore" size={18} color={theme.text} />
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{t.return}</Text>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t.delete}
                style={({ pressed }) => [
                  styles.dangerButton,
                  { borderColor: theme.danger, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.danger} />
                <Text style={[styles.dangerButtonText, { color: theme.danger }]}>{t.delete}</Text>
              </Pressable>
            </SurfaceCard>
          </FadeInUp>

          <FadeInUp delay={160}>
            <SurfaceCard>
              <Text style={[styles.eyebrow, { color: theme.primary }]}>{t.scanHistory}</Text>
              <Text style={[styles.subTitle, { color: theme.text }]}>{t.recentActivity}</Text>
              {scanHistory.length > 0 ? (
                scanHistory.map((entry) => (
                  <View key={entry.id} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
                    <View style={styles.historyHeader}>
                      <StatusBadge status={entry.action} size="sm" />
                      <Text style={[styles.historyUser, { color: theme.muted }]}>{entry.userName}</Text>
                    </View>
                    <Text style={[styles.historyTime, { color: theme.muted }]}>
                      {entry.timestamp?.toDate?.()?.toLocaleString() || 'Unknown time'}
                    </Text>
                    {entry.location ? (
                      <Text style={[styles.historyLocation, { color: theme.muted }]}>
                        Lat: {entry.location.latitude?.toFixed(4)}, Lon: {entry.location.longitude?.toFixed(4)}
                      </Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyHistory, { color: theme.muted }]}>No activity recorded yet</Text>
              )}
            </SurfaceCard>
          </FadeInUp>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ theme, label, value, styles }) {
  return (
    <View style={[styles.infoRow, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
      <Text style={[styles.infoLabel, { color: theme.muted }]}>{label}:</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingBottom: spacing.xxl },
    contentWrap: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      padding: spacing.md,
      gap: spacing.lg,
    },
    statusPill: { padding: 4, borderRadius: radius.pill, borderWidth: 1 },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
    emptyContents: { ...type.body, paddingVertical: spacing.sm },
    expiryBlock: {
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    expiryRow: { ...type.body, marginTop: spacing.xs },
    infoRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
    },
    infoLabel: { ...type.caption, fontWeight: '700' },
    infoValue: { ...type.body, flexShrink: 1 },
    statusBlock: {
      marginTop: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusBlockLabel: { ...type.bodyStrong },
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
      marginTop: spacing.md,
    },
    secondaryButtonText: { ...type.bodyStrong, textTransform: 'uppercase', letterSpacing: 1.5 },
    dangerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      minHeight: 48,
      marginTop: spacing.md,
    },
    dangerButtonText: { ...type.bodyStrong, textTransform: 'uppercase', letterSpacing: 1.5 },
    eyebrow: { ...type.eyebrow, marginBottom: spacing.xs },
    subTitle: { ...type.subtitle, marginBottom: spacing.md },
    historyItem: {
      borderBottomWidth: 1,
      paddingVertical: spacing.md,
    },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
    historyUser: { ...type.caption },
    historyTime: { ...type.caption, fontSize: 11, marginTop: spacing.xs },
    historyLocation: { ...type.caption, fontSize: 11, marginTop: 2 },
    emptyHistory: { ...type.body, paddingVertical: spacing.md },
  });
}
