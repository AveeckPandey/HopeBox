import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TextInput } from 'react-native-paper';
import { signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';

import { auth, db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useWarehouse } from '../../contexts/WarehouseContext';
import { useUser } from '../../contexts/UserContext';
import { useCommodities, useTemplates } from '../../contexts/CommoditiesContext';
import { useSimpleMode } from '../../contexts/SimpleModeContext';
import {
  boxesByEarliestExpiry,
  chartRowsForTemplate,
  possibleBoxesFromTemplate,
  shortageForTarget,
} from '../../services/inventoryMath';
import { flattenContents } from '../../services/boxLines';
import { exportToCSV, exportToPDF } from '../../services/export';
import { logAction } from '../../services/audit';
import { useLanguage } from '../../contexts/LanguageContext';
import { snackbar } from '../../hooks/useSnackbar';
import { safeIcon } from '../../services/commodities';
import { firestoreOnError } from '../../hooks/useFirestoreSubscription';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import MetricTile from '../../components/MetricTile';
import StatusBadge from '../../components/StatusBadge';
import FadeInUp from '../../components/FadeInUp';
import AmbientGlow from '../../components/AmbientGlow';
import { layout, radius, spacing, type } from '../../theme/tokens';

export default function Dashboard({ navigation }) {
  const { theme, themeName, toggleTheme } = useAppTheme();
  const { currentWarehouse } = useWarehouse();
  const { userData } = useUser();
  const { commodities, byId } = useCommodities();
  const { defaultTemplate } = useTemplates();
  const { scale: simpleScale } = useSimpleMode();
  const { t: tAll } = useLanguage();
  const t = tAll('dashboard');
  const tCommon = tAll('common');

  const [inventory, setInventory] = useState({});
  const [boxes, setBoxes] = useState([]);
  const [targetBoxes, setTargetBoxes] = useState('');
  const styles = useMemo(() => createStyles(theme, simpleScale), [theme, simpleScale]);

  useEffect(() => {
    const loadTarget = async () => {
      const stored = await AsyncStorage.getItem('hopebox-target-boxes');
      if (stored != null && stored !== '') {
        setTargetBoxes(stored.replace(/[^0-9]/g, ''));
      }
    };
    void loadTarget();
  }, []);

  useEffect(() => {
    if (targetBoxes === '') return;
    void AsyncStorage.setItem('hopebox-target-boxes', targetBoxes);
  }, [targetBoxes]);

  useEffect(() => {
    const inventoryId = currentWarehouse?.id || 'main';
    const unsubscribe = onSnapshot(
      doc(db, 'inventory', inventoryId),
      (snap) => {
        if (!snap.exists()) {
          setInventory({});
          return;
        }
        // Read the new contents-map shape. Legacy fields (rice/dal/
        // sachets) are also exposed under their commodity ids so the
        // rest of the dashboard doesn't have to special-case them.
        const data = snap.data();
        const next = {};
        for (const [k, v] of Object.entries(data)) {
          if (k === 'rice' || k === 'dal' || k === 'sachets') {
            // Map legacy keys to their commodity ids.
            if (k === 'rice') next['commodity_rice'] = Number(v) || 0;
            else if (k === 'dal') next['commodity_dal'] = Number(v) || 0;
            else if (k === 'sachets') next['commodity_sachets'] = Number(v) || 0;
          } else if (k === 'updatedAt' || k === 'createdAt') {
            // Skip timestamps — they're not commodity counts.
            continue;
          } else {
            next[k] = Number(v) || 0;
          }
        }
        setInventory(next);
      },
      (err) => firestoreOnError('Dashboard/inventory', err)
    );
    return () => unsubscribe();
  }, [currentWarehouse]);

  useEffect(() => {
    let boxesRef: any = collection(db, 'boxes');
    if (currentWarehouse?.id) {
      boxesRef = query(boxesRef, where('warehouseId', '==', currentWarehouse.id));
    }
    const unsubscribe = onSnapshot(
      boxesRef,
      (snapshot) => {
        setBoxes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => firestoreOnError('Dashboard/boxes', err)
    );
    return () => unsubscribe();
  }, [currentWarehouse]);

  const counts = useMemo(() => {
    let stored = 0, dispatched = 0, returned = 0;
    boxes.forEach((b) => {
      if (b.status === 'stored') stored++;
      else if (b.status === 'dispatched') dispatched++;
      else if (b.status === 'returned') returned++;
    });
    return { stored, dispatched, returned };
  }, [boxes]);

  // Template-driven planning: how many boxes can we build right now,
  // and what would we need to hit the target? Falls back to empty
  // map if no template is configured yet. Memoised so the
  // downstream useMemo hooks (possibleBoxes, shortageMap, chartData)
  // don't see a new reference on every render — without this the
  // `templateCommodities` in their dep arrays is a fresh `{}` every
  // render and they all re-run.
  const templateCommodities = useMemo(
    () => defaultTemplate?.commodities || {},
    [defaultTemplate]
  );
  const targetNum = Number(targetBoxes) || 0;
  const possibleBoxes = useMemo(
    () => possibleBoxesFromTemplate(inventory, templateCommodities),
    [inventory, templateCommodities]
  );
  const shortageMap = useMemo(
    () => shortageForTarget(inventory, templateCommodities, targetNum),
    [inventory, templateCommodities, targetNum]
  );
  const completionRate = targetNum > 0 ? Math.min((possibleBoxes / targetNum) * 100, 100) : 0;
  const hasLiveInventory = useMemo(
    () => Object.values(inventory).some((value) => Number(value) > 0),
    [inventory]
  );

  // Chart rows for the live-inventory card, pulled from the live
  // commodity catalog so it works for any sector (food, medical, hygiene).
  const chartData = useMemo(
    () => {
      if (!hasLiveInventory) return [];
      return chartRowsForTemplate(inventory, templateCommodities).map((row) => {
        const c = byId[row.commodityId] || { name: row.commodityId, unit: '', color: theme.primary };
        return {
          id: row.commodityId,
          label: c.name,
          value: row.onHand,
          requiredPerBox: row.requiredPerBox,
          shortage: shortageMap[row.commodityId] || 0,
          unit: c.unit,
          color: c.color || theme.primary,
        };
      });
    },
    [hasLiveInventory, inventory, templateCommodities, byId, shortageMap, theme.primary]
  );
  const maxChartValue = chartData.length > 0 ? Math.max(...chartData.map((item) => item.value), 1) : 1;

  // FEFO awareness: for each commodity with expiry-tracking, surface
  // the next box that's about to expire in this warehouse.
  const fefoAlerts = useMemo(() => {
    const alerts = [];
    for (const c of commodities) {
      if (!c.expiryTracking) continue;
      const expiring = boxesByEarliestExpiry(boxes, c.id);
      const next = expiring[0];
      if (!next) continue;
      const line = next.contents?.[c.id];
      const expiryStr = line?.expiryDate;
      if (!expiryStr) continue;
      alerts.push({
        commodity: c,
        boxId: next.id,
        expiry: expiryStr,
        batch: line?.batchNumber || null,
      });
    }
    return alerts.slice(0, 5);
  }, [commodities, boxes]);

  const handleThemeToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTheme();
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await signOut(auth);
      snackbar.info(tCommon.signedOut);
    } catch (_e) {
      snackbar.error(tCommon.signOutFailed);
    }
  };

  // P38: stable navigation callbacks. Without useCallback here
  // every Dashboard render hands `ActionTile` a new onPress
  // identity. ActionTile isn't memoised, so this matters less
  // than Boxes' renderItem, but it's also the more honest
  // shape for the action tiles, and it stops the inline
  // arrow allocations on every keystroke in the target input.
  const goBoxes = useCallback(() => navigation.navigate('Boxes'), [navigation]);
  const goScan = useCallback(() => navigation.navigate('ScanQR'), [navigation]);
  const goInventory = useCallback(() => navigation.navigate('AdminInventory'), [navigation]);
  const goAnalytics = useCallback(() => navigation.navigate('Analytics'), [navigation]);
  const goAudit = useCallback(() => navigation.navigate('AuditLog'), [navigation]);

  // P38: build the action-tile list. We intentionally do NOT wrap
  // this in useMemo — `boxes` is a fresh reference on every Firestore
  // snapshot, and the React compiler correctly notes that any memo
  // here would invalidate every render anyway. The cost of
  // reconstructing 7 small objects is negligible compared to the
  // JSX the array drives.
  //
  // P45: empty-export guard. Without it the snackbar says
  // "CSV exported" but the file is just a header row. Haptic
  // warning + an explicit message is more honest.
  const actionTiles = [
    { key: 'boxes', icon: 'package-variant-closed', label: t.manageBoxes, onPress: goBoxes, primary: true },
    { key: 'scan', icon: 'qrcode-scan', label: t.scanQR, onPress: goScan },
    { key: 'inv', icon: 'warehouse', label: t.adminInventory, onPress: goInventory },
    { key: 'analytics', icon: 'chart-bar', label: t.analytics, onPress: goAnalytics },
    { key: 'audit', icon: 'history', label: t.auditLog, onPress: goAudit },
    {
      key: 'csv',
      icon: 'file-export-outline',
      label: t.exportCSV,
      onPress: async () => {
        if (boxes.length === 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          snackbar.error(t.exportEmpty);
          return;
        }
        try {
          const exportData = boxes.map((b) => {
            const flat = flattenContents(b.contents || {});
            return {
              id: b.id,
              ...flat,
              status: b.status,
              warehouse: b.warehouseId || 'default',
              createdAt: b.createdAt?.toDate?.()?.toISOString() || '',
            };
          });
          await exportToCSV(exportData, `hopebox-inventory-${Date.now()}`);
          await logAction('export_csv', { count: boxes.length }, userData?.id);
          snackbar.success(t.exportSuccess);
        } catch (_e) {
          snackbar.error(t.exportFailed);
        }
      },
    },
    {
      key: 'pdf',
      icon: 'file-pdf-box',
      label: t.exportPDF,
      onPress: async () => {
        if (boxes.length === 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          snackbar.error(t.exportEmpty);
          return;
        }
        try {
          const exportData = boxes.map((b) => {
            const flat = flattenContents(b.contents || {});
            return {
              id: b.id,
              ...flat,
              status: b.status,
              warehouse: b.warehouseId || 'default',
            };
          });
          await exportToPDF(exportData, 'HopeBox Inventory Report', `hopebox-report-${Date.now()}`);
          await logAction('export_pdf', { count: boxes.length }, userData?.id);
          snackbar.success(t.pdfSuccess);
        } catch (_e) {
          snackbar.error(t.pdfFailed);
        }
      },
    },
  ];

  const statusRows = useMemo(
    () => [
      { status: 'stored', count: counts.stored },
      { status: 'dispatched', count: counts.dispatched },
      { status: 'returned', count: counts.returned },
    ],
    [counts.stored, counts.dispatched, counts.returned]
  );

  const heroRight = (
    <View style={styles.heroActions}>
      <Pressable
        onPress={handleThemeToggle}
        accessibilityRole="button"
        accessibilityLabel={`Switch to ${themeName === 'dark' ? 'light' : 'dark'} mode`}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
      >
        <MaterialCommunityIcons
          name={themeName === 'dark' ? 'white-balance-sunny' : 'weather-night'}
          size={14}
          color={theme.primary}
        />
        <Text style={styles.pillText}>
          {themeName === 'dark' ? t.themeLight : t.themeDark}
        </Text>
      </Pressable>
      <Pressable
        onPress={handleSignOut}
        accessibilityRole="button"
        accessibilityLabel={t.signOut}
        style={({ pressed }) => [styles.pill, styles.pillGhost, pressed && { opacity: 0.7 }]}
      >
        <MaterialCommunityIcons name="logout" size={14} color={theme.text} />
        <Text style={[styles.pillText, { color: theme.text }]}>{t.signOut}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <AmbientGlow variant="dual" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrap}>
          <FadeInUp delay={0}>
            <View style={styles.topHeaderRow}>
              <View style={styles.titleTextWrap}>
                <Text style={styles.dashboardHeading}>{t.title}</Text>
                {userData ? (
                  <View style={[styles.roleBadge, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                    <Text style={[styles.roleBadgeText, { color: theme.primary }]}>
                      {userData.role?.toUpperCase() || 'STAFF'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.headerIconButtonRow}>
                <Pressable
                  onPress={() => navigation.navigate('Settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                  style={({ pressed }) => [styles.headerIconButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }, pressed && { opacity: 0.7 }]}
                >
                  <MaterialCommunityIcons name="cog-outline" size={20} color={theme.text} />
                </Pressable>
              </View>
            </View>
          </FadeInUp>

          {/* Contextual Low Stock Alert Card */}
          {chartData.some((c) => c.shortage > 0) ? (
            <FadeInUp delay={40}>
              <View style={[styles.alertCard, { backgroundColor: theme.warningSoft || 'rgba(251,191,36,0.12)', borderColor: theme.warning }]}>
                <MaterialCommunityIcons name="alert-outline" size={22} color={theme.warning} style={styles.alertIcon} />
                <View style={styles.alertTextWrap}>
                  <Text style={[styles.alertTitle, { color: theme.warning }]}>Low Stock Alert</Text>
                  <Text style={[styles.alertBody, { color: theme.text }]}>
                    {chartData.filter((c) => c.shortage > 0).map((c) => `${c.label} is below target`).join(', ')}. Consider restocking before the next deployment campaign.
                  </Text>
                </View>
              </View>
            </FadeInUp>
          ) : null}

          {/* Campaign Readiness Card */}
          <FadeInUp delay={80}>
            <SurfaceCard padding={spacing.lg}>
              <Text style={[styles.cardSectionEyebrow, { color: theme.muted }]}>CAMPAIGN READINESS</Text>
              <View style={styles.readinessStatRow}>
                <View style={[styles.readinessStatBox, { backgroundColor: theme.backgroundAlt }]}>
                  <Text style={[styles.readinessStatLabel, { color: theme.muted }]}>Possible Boxes</Text>
                  <Text style={[styles.readinessStatNum, { color: theme.text }]}>{possibleBoxes}</Text>
                  <Text style={[styles.readinessStatSub, { color: theme.muted }]}>Based on stock</Text>
                </View>
                <View style={[styles.readinessStatBox, { backgroundColor: theme.backgroundAlt }]}>
                  <Text style={[styles.readinessStatLabel, { color: theme.muted }]}>Deployed</Text>
                  <Text style={[styles.readinessStatNum, { color: theme.success }]}>{counts.dispatched}</Text>
                  <Text style={[styles.readinessStatSub, { color: theme.muted }]}>This campaign</Text>
                </View>
              </View>

              <View style={styles.targetProgressBlock}>
                <View style={styles.targetProgressHeader}>
                  <Text style={[styles.targetProgressTitle, { color: theme.text }]}>Target coverage</Text>
                  <Text style={[styles.targetProgressPercent, { color: theme.warning }]}>
                    {Math.round(completionRate)}% <Text style={[styles.targetProgressSubText, { color: theme.muted }]}>({possibleBoxes} of {targetNum || 100} HH)</Text>
                  </Text>
                </View>
                <View style={[styles.targetProgressBarTrack, { backgroundColor: theme.backgroundAlt }]}>
                  <View
                    style={[
                      styles.targetProgressBarFill,
                      { width: `${Math.min(completionRate, 100)}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </View>
              </View>
            </SurfaceCard>
          </FadeInUp>

          {/* Live Inventory Status Bars */}
          <FadeInUp delay={140}>
            <SurfaceCard padding={spacing.lg}>
              <Text style={[styles.cardSectionEyebrow, { color: theme.muted }]}>LIVE INVENTORY</Text>
              {chartData.length === 0 ? (
                <Text style={[styles.empty, { color: theme.muted }]}>{t.emptyChart}</Text>
              ) : (
                <View style={styles.inventoryList}>
                  {chartData.map((item) => {
                    const statusColor = item.shortage > 0 ? (theme.warning || '#FBBF24') : (theme.success || '#10B981');
                    const statusLabel = item.shortage > 0 ? '↓ low' : 'healthy';
                    return (
                      <View key={item.id} style={styles.inventoryRow}>
                        <View style={styles.inventoryHeader}>
                          <View style={styles.inventoryNameRow}>
                            <View style={[styles.legendDot, { backgroundColor: statusColor }]} />
                            <Text style={[styles.inventoryName, { color: theme.text }]}>{item.label}</Text>
                          </View>
                          <Text style={[styles.inventoryValue, { color: theme.text }]}>
                            {item.value.toLocaleString()} {item.unit} <Text style={{ color: statusColor, fontSize: 12 }}>{statusLabel}</Text>
                          </Text>
                        </View>
                        <View style={[styles.chartTrack, { backgroundColor: theme.backgroundAlt }]}>
                          <View
                            style={[
                              styles.chartBar,
                              {
                                width: `${Math.max((item.value / maxChartValue) * 100, item.value > 0 ? 8 : 0)}%`,
                                backgroundColor: statusColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}

                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: theme.warning || '#FBBF24' }]} />
                      <Text style={[styles.legendText, { color: theme.muted }]}>Low (&lt;50%)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: theme.success || '#10B981' }]} />
                      <Text style={[styles.legendText, { color: theme.muted }]}>Healthy</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
                      <Text style={[styles.legendText, { color: theme.muted }]}>Tracked</Text>
                    </View>
                  </View>
                </View>
              )}
            </SurfaceCard>
          </FadeInUp>

          {/* Quick Actions 2x2 Grid */}
          <FadeInUp delay={200}>
            <SurfaceCard padding={spacing.lg}>
              <Text style={[styles.cardSectionEyebrow, { color: theme.muted }]}>QUICK ACTIONS</Text>
              <View style={styles.quickGrid2x2}>
                <Pressable
                  onPress={goBoxes}
                  accessibilityRole="button"
                  accessibilityLabel="Manage boxes"
                  style={({ pressed }) => [styles.quickTile, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }, pressed && { opacity: 0.8 }]}
                >
                  <MaterialCommunityIcons name="package-variant-closed" size={26} color={theme.primary} />
                  <Text style={[styles.quickTileText, { color: theme.text }]}>Manage boxes</Text>
                </Pressable>

                <Pressable
                  onPress={goScan}
                  accessibilityRole="button"
                  accessibilityLabel="Scan box"
                  style={({ pressed }) => [styles.quickTile, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }, pressed && { opacity: 0.8 }]}
                >
                  <MaterialCommunityIcons name="qrcode-scan" size={26} color={theme.primary} />
                  <Text style={[styles.quickTileText, { color: theme.text }]}>Scan box</Text>
                </Pressable>

                <Pressable
                  onPress={goAnalytics}
                  accessibilityRole="button"
                  accessibilityLabel="Analytics"
                  style={({ pressed }) => [styles.quickTile, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }, pressed && { opacity: 0.8 }]}
                >
                  <MaterialCommunityIcons name="chart-bar" size={26} color={theme.primary} />
                  <Text style={[styles.quickTileText, { color: theme.text }]}>Analytics</Text>
                </Pressable>

                <Pressable
                  onPress={actionTiles.find((t) => t.key === 'csv')?.onPress}
                  accessibilityRole="button"
                  accessibilityLabel="Export report"
                  style={({ pressed }) => [styles.quickTile, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }, pressed && { opacity: 0.8 }]}
                >
                  <MaterialCommunityIcons name="file-export-outline" size={26} color={theme.primary} />
                  <Text style={[styles.quickTileText, { color: theme.text }]}>Export report</Text>
                </Pressable>
              </View>
            </SurfaceCard>
          </FadeInUp>
        </View>
      </ScrollView>
    </View>
  );
}

function ThemedTargetInput({ value, onChange, theme, styles }) {
  return (
    <TextInput
      mode="outlined"
      value={value}
      onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
      keyboardType="numeric"
      placeholder="Target boxes"
      style={styles.input}
      outlineColor={theme.border}
      activeOutlineColor={theme.primary}
      textColor={theme.text}
      theme={{
        colors: {
          background: theme.surfaceRaised,
          primary: theme.primary,
          outline: theme.border,
          text: theme.text,
          placeholder: theme.muted,
        },
      }}
    />
  );
}

function ActionTile({ theme, icon, label, onPress, primary, minHeight = 52 }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          minHeight,
          borderRadius: radius.md,
          borderWidth: 1,
          backgroundColor: primary ? theme.primary : theme.surfaceRaised,
          borderColor: primary ? theme.primary : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={primary ? theme.primaryText : theme.primary}
      />
      <Text
        style={[
          type.bodyStrong,
          { color: primary ? theme.primaryText : theme.text, flex: 1 },
        ]}
      >
        {label}
      </Text>
      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color={primary ? theme.primaryText : theme.muted}
      />
    </Pressable>
  );
}

function createStyles(theme, simpleScale = 1) {
  // P32: simple mode bumps the action-tile minHeight so the
  // primary touch targets on the home screen are easier to
  // hit for low-literacy field staff. Returned alongside the
  // StyleSheet as a bare number — StyleSheet.create's inferred
  // type only allows style values, so a raw number doesn't
  // belong inside it.
  const actionMinHeight = Math.round(52 * simpleScale);
  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    scrollContent: { paddingBottom: spacing.xxl },
    contentWrap: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    topHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    titleTextWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dashboardHeading: {
      fontSize: 32,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.5,
    },
    headerIconButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    headerIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardSectionEyebrow: {
      ...type.eyebrow,
      marginBottom: spacing.md,
      letterSpacing: 1.5,
    },
    alertCard: {
      flexDirection: 'row',
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    alertIcon: {
      marginTop: 2,
    },
    alertTextWrap: {
      flex: 1,
    },
    alertTitle: {
      ...type.bodyStrong,
      fontSize: 14,
      marginBottom: 2,
    },
    alertBody: {
      ...type.caption,
      fontSize: 13,
      lineHeight: 18,
    },
    readinessStatRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    readinessStatBox: {
      flex: 1,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    readinessStatLabel: {
      ...type.caption,
      fontSize: 12,
      marginBottom: 4,
    },
    readinessStatNum: {
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 34,
    },
    readinessStatSub: {
      ...type.caption,
      fontSize: 11,
      marginTop: 2,
    },
    targetProgressBlock: {
      marginTop: spacing.xs,
    },
    targetProgressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: spacing.xs,
    },
    targetProgressTitle: {
      ...type.bodyStrong,
      fontSize: 14,
    },
    targetProgressPercent: {
      ...type.bodyStrong,
      fontSize: 14,
    },
    targetProgressSubText: {
      fontWeight: '400',
      fontSize: 12,
    },
    targetProgressBarTrack: {
      height: 10,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    targetProgressBarFill: {
      height: '100%',
      borderRadius: radius.pill,
    },
    inventoryList: {
      gap: spacing.md,
    },
    inventoryRow: {},
    inventoryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    inventoryNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    inventoryName: {
      ...type.bodyStrong,
    },
    inventoryValue: {
      ...type.bodyStrong,
      fontSize: 14,
    },
    legendRow: {
      flexDirection: 'row',
      gap: spacing.lg,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      ...type.caption,
      fontSize: 11,
    },
    quickGrid2x2: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    quickTile: {
      width: '47.5%',
      minHeight: 90,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    quickTileText: {
      ...type.bodyStrong,
      fontSize: 13,
      textAlign: 'center',
    },
    heroCard: { marginBottom: 0 },
    heroActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: theme.primarySoft,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pillGhost: { backgroundColor: theme.surfaceRaised },
    pillText: { color: theme.primary, fontWeight: '700', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
    roleBadge: {
      alignSelf: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    roleBadgeText: { ...type.caption, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    heroStats: {
      flexDirection: 'row',
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatDivider: { width: 1 },
    heroStatValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    heroStatLabel: { ...type.caption, marginTop: 2 },
    sectionTitle: { ...type.subtitle, marginBottom: spacing.md },
    empty: { ...type.body, paddingVertical: spacing.md },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    chartRow: { marginBottom: spacing.md },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    chartLabel: { ...type.bodyStrong },
    chartValue: { ...type.caption, fontWeight: '700' },
    chartTrack: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
    chartBar: { height: '100%', borderRadius: radius.pill },
    fefoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      marginBottom: spacing.xs,
    },
    fefoIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fefoText: { flex: 1 },
    fefoName: { ...type.bodyStrong },
    fefoMeta: { ...type.caption, marginTop: 2 },
    statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    statusRow: {
      flexGrow: 1, minWidth: '30%',
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    },
    statusCount: { fontSize: 22, fontWeight: '800' },
    helper: { ...type.body, marginBottom: spacing.md },
    input: { backgroundColor: theme.surfaceRaised, marginBottom: spacing.md },
    requirementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    actionGrid: { gap: spacing.md },
  });
  return { ...styles, actionMinHeight: actionMinHeight as number };
}
