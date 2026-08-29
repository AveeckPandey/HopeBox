import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const { t: tAll } = useLanguage();
  const t = tAll('dashboard');
  const tCommon = tAll('common');

  const [inventory, setInventory] = useState({});
  const [boxes, setBoxes] = useState([]);
  const [targetBoxes, setTargetBoxes] = useState('100');
  const styles = useMemo(() => createStyles(theme), [theme]);

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
  const completionRate = Math.min((possibleBoxes / Math.max(targetNum, 1)) * 100, 100);

  // Chart rows for the live-inventory card, pulled from the live
  // commodity catalog so it works for any sector (food, medical, hygiene).
  const chartData = useMemo(
    () => chartRowsForTemplate(inventory, templateCommodities).map((row) => {
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
    }),
    [inventory, templateCommodities, byId, shortageMap, theme.primary]
  );
  const maxChartValue = Math.max(...chartData.map((item) => item.value), 1);

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
            <SurfaceCard tone="raised" padding={spacing.lg} style={styles.heroCard}>
              <ScreenHeader
                eyebrow={t.eyebrow}
                title={t.title}
                subtitle={t.subtitle}
                style={{ marginBottom: 0 }}
              />
              <View style={styles.heroActionsRow}>{heroRight}</View>
              {userData ? (
                <View style={[styles.roleBadge, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                  <Text style={[styles.roleBadgeText, { color: theme.primary }]}>
                    {userData.role?.toUpperCase() || 'STAFF'}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.heroStats, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {possibleBoxes}
                  </Text>
                  <Text style={[styles.heroStatLabel, { color: theme.muted }]} numberOfLines={2}>
                    {t.possibleBoxes}
                  </Text>
                </View>
                <View style={[styles.heroStatDivider, { backgroundColor: theme.border }]} />
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {boxes.length}
                  </Text>
                  <Text style={[styles.heroStatLabel, { color: theme.muted }]} numberOfLines={2}>
                    {t.totalBoxes}
                  </Text>
                </View>
                <View style={[styles.heroStatDivider, { backgroundColor: theme.border }]} />
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, { color: theme.primary }]} numberOfLines={1} adjustsFontSizeToFit>
                    {Math.round(completionRate)}%
                  </Text>
                  <Text style={[styles.heroStatLabel, { color: theme.muted }]} numberOfLines={2}>
                    {t.targetCoverage}
                  </Text>
                </View>
              </View>
            </SurfaceCard>
          </FadeInUp>

          <FadeInUp delay={80}>
            <SurfaceCard>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.liveInventory}</Text>
              {chartData.length === 0 ? (
                <Text style={[styles.empty, { color: theme.muted }]}>
                  {t.emptyChart}
                </Text>
              ) : (
                <View style={styles.metricGrid}>
                  {chartData.map((item) => (
                    <MetricTile
                      key={item.id}
                      label={item.label}
                      value={item.value}
                      unit={item.unit}
                      tone={item.shortage > 0 ? 'warning' : 'primary'}
                    />
                  ))}
                </View>
              )}
            </SurfaceCard>
          </FadeInUp>

          <FadeInUp delay={140}>
            <SurfaceCard>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.inventoryChart}</Text>
              {chartData.map((item) => (
                <View key={item.id} style={styles.chartRow}>
                  <View style={styles.chartHeader}>
                    <Text style={[styles.chartLabel, { color: theme.text }]}>{item.label}</Text>
                    <Text style={[styles.chartValue, { color: theme.muted }]}>
                      {item.value} {item.unit}
                    </Text>
                  </View>
                  <View style={[styles.chartTrack, { backgroundColor: theme.backgroundAlt }]}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          width: `${Math.max((item.value / maxChartValue) * 100, item.value > 0 ? 10 : 0)}%`,
                          backgroundColor: item.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </SurfaceCard>
          </FadeInUp>

          {fefoAlerts.length > 0 ? (
            <FadeInUp delay={180}>
              <SurfaceCard>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Expiring soon</Text>
                <Text style={[styles.helper, { color: theme.muted }]}>
                  First-expiry-first-out (FEFO) preview across this warehouse.
                </Text>
                {fefoAlerts.map((alert) => (
                  <View
                    key={`${alert.commodity.id}-${alert.boxId}`}
                    style={[styles.fefoRow, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
                  >
                    <View style={[styles.fefoIcon, { backgroundColor: alert.commodity.color || theme.warning }]}>
                      <MaterialCommunityIcons
                        name={safeIcon(alert.commodity.icon) as any}
                        size={16}
                        color={theme.primaryText}
                      />
                    </View>
                    <View style={styles.fefoText}>
                      <Text style={[styles.fefoName, { color: theme.text }]}>
                        {alert.commodity.name}
                      </Text>
                      <Text style={[styles.fefoMeta, { color: theme.muted }]}>
                        Box {alert.boxId} · expires {alert.expiry}
                        {alert.batch ? ` · batch ${alert.batch}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </SurfaceCard>
            </FadeInUp>
          ) : null}

          <FadeInUp delay={200}>
            <SurfaceCard>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.boxStatus}</Text>
              <View style={styles.statusGrid}>
                {statusRows.map((row) => (
                  <View
                    key={row.status}
                    style={[styles.statusRow, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
                  >
                    <StatusBadge status={row.status} size="sm" />
                    <Text style={[styles.statusCount, { color: theme.text }]}>{row.count}</Text>
                  </View>
                ))}
              </View>
            </SurfaceCard>
          </FadeInUp>

          <FadeInUp delay={260}>
            <SurfaceCard>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.targetPlanning}</Text>
              <Text style={[styles.helper, { color: theme.muted }]}>{t.targetHelper}</Text>
              <ThemedTargetInput
                value={targetBoxes}
                onChange={setTargetBoxes}
                theme={theme}
                styles={styles}
              />
              {chartData.length > 0 ? (
                <View style={styles.requirementGrid}>
                  {chartData.map((item) => (
                    <MetricTile
                      key={item.id}
                      label={item.label}
                      value={item.shortage}
                      unit={item.unit}
                      tone={item.shortage > 0 ? 'warning' : 'success'}
                    />
                  ))}
                </View>
              ) : null}
            </SurfaceCard>
          </FadeInUp>

          <FadeInUp delay={320}>
            <SurfaceCard>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.actions}</Text>
              <View style={styles.actionGrid}>
                {actionTiles.map((tile) => (
                  <ActionTile
                    key={tile.key}
                    theme={theme}
                    icon={tile.icon}
                    label={tile.label}
                    onPress={tile.onPress}
                    primary={tile.primary}
                  />
                ))}
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

function ActionTile({ theme, icon, label, onPress, primary }) {
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
          minHeight: 52,
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

function createStyles(theme) {
  return StyleSheet.create({
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
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    roleBadgeText: { ...type.caption, fontWeight: '800', letterSpacing: 1.5 },
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
    chartTrack: { height: 12, borderRadius: radius.pill, overflow: 'hidden' },
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
}
