import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useCommodities } from '../../contexts/CommoditiesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { flattenContents } from '../../services/inventoryMath';
import { firestoreOnError } from '../../hooks/useFirestoreSubscription';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import MetricTile from '../../components/MetricTile';
import FadeInUp from '../../components/FadeInUp';
import AmbientGlow from '../../components/AmbientGlow';
import { layout, radius, spacing, type } from '../../theme/tokens';

export default function Analytics() {
  const { theme } = useAppTheme();
  const { commodities } = useCommodities();
  const { t: tAll } = useLanguage();
  const t = tAll('analytics');
  const tStatus = tAll('status');
  const [boxes, setBoxes] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  // P35: cap each subscription at 500 docs. Analytics doesn't need
  // the full history; the most recent 500 audit/scan rows are
  // enough to render every bar chart on the screen. Without the
  // cap a year-old org with thousands of scans will pay the full
  // read cost on every snapshot fire. The orderBy + limit combo
  // requires a Firestore composite index — declared in
  // firestore.indexes.json (added in the data-model slice).
  const MAX_ANALYTICS_DOCS = 500;
  useEffect(() => {
    const unsub1 = onSnapshot(
      collection(db, 'boxes'),
      (snap) => {
        setBoxes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => firestoreOnError('Analytics/boxes', err)
    );
    const unsub2 = onSnapshot(
      query(collection(db, 'scanHistory'), orderBy('timestamp', 'desc'), limit(MAX_ANALYTICS_DOCS)),
      (snap) => {
        setScanHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => firestoreOnError('Analytics/scanHistory', err)
    );
    const unsub3 = onSnapshot(
      query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(MAX_ANALYTICS_DOCS)),
      (snap) => {
        setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => firestoreOnError('Analytics/auditLogs', err)
    );
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // P26: pull-to-refresh. The three onSnapshot listeners above
  // are already live, so this is a UX spinner only — the data
  // is current. We hold the spinner for a beat so the user gets
  // visual confirmation that the pull did something.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const stored = boxes.filter((b) => b.status === 'stored').length;
    const dispatched = boxes.filter((b) => b.status === 'dispatched').length;
    const returned = boxes.filter((b) => b.status === 'returned').length;

    const categoryCounts = {};
    const warehouseCounts = {};
    const donorCounts = {};

    boxes.forEach((b) => {
      if (b.category) categoryCounts[b.category] = (categoryCounts[b.category] || 0) + 1;
      if (b.warehouseId) warehouseCounts[b.warehouseId] = (warehouseCounts[b.warehouseId] || 0) + 1;
      if (b.donorName) donorCounts[b.donorName] = (donorCounts[b.donorName] || 0) + 1;
    });

    const scansByAction = {};
    scanHistory.forEach((s) => {
      scansByAction[s.action] = (scansByAction[s.action] || 0) + 1;
    });

    const scansByDay = {};
    scanHistory.forEach((s) => {
      const date = s.timestamp?.toDate?.()?.toLocaleDateString() || 'unknown';
      scansByDay[date] = (scansByDay[date] || 0) + 1;
    });

    // Per-commodity totals, derived from the contents map (with
    // legacy field fallback for boxes written by v1.0).
    const commodityTotals = {};
    for (const c of commodities) {
      let sum = 0;
      for (const b of boxes) {
        const flat = flattenContents(b.contents || {});
        // Legacy: if no `contents` map, fall back to the top-level field.
        const v = flat[c.id] != null ? flat[c.id] : b[c.id];
        if (v) sum += Number(v) || 0;
      }
      commodityTotals[c.id] = sum;
    }

    return {
      stored, dispatched, returned,
      categoryCounts, warehouseCounts, donorCounts,
      scansByAction, scansByDay,
      commodityTotals,
      totalBoxes: boxes.length,
      totalScans: scanHistory.length,
      totalAuditLogs: auditLogs.length,
    };
  }, [boxes, scanHistory, auditLogs, commodities]);

  const renderBar = (label, value, max, color) => (
    <View key={label} style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={[styles.barLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.barValue, { color: theme.muted }]}>{value}</Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: theme.backgroundAlt }]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${value > 0 ? Math.max((value / Math.max(max, 1)) * 100, 8) : 0}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <AmbientGlow variant="topLeft" opacity={0.5} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
            progressBackgroundColor={theme.surfaceRaised}
          />
        }
      >
        <View style={styles.contentWrap}>
          <FadeInUp delay={0}>
            <ScreenHeader eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />
          </FadeInUp>

          <FadeInUp delay={80}>
            <SurfaceCard>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.inventoryTotals}</Text>
              <View style={styles.metricGrid}>
                {commodities.map((c) => (
                  <MetricTile
                    key={c.id}
                    label={c.name}
                    value={stats.commodityTotals[c.id] || 0}
                    unit={c.unit}
                  />
                ))}
              </View>
            </SurfaceCard>
          </FadeInUp>

          <FadeInUp delay={140}>
            <SurfaceCard>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.boxStatusDistribution}</Text>
              {renderBar(tStatus.stored, stats.stored, stats.totalBoxes, theme.success)}
              {renderBar(tStatus.dispatched, stats.dispatched, stats.totalBoxes, theme.danger)}
              {renderBar(tStatus.returned, stats.returned, stats.totalBoxes, theme.warning)}
            </SurfaceCard>
          </FadeInUp>

          {Object.keys(stats.categoryCounts).length > 0 ? (
            <FadeInUp delay={200}>
              <SurfaceCard>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.categories}</Text>
                {Object.entries(stats.categoryCounts).map(([cat, count]) =>
                  renderBar(cat, count, stats.totalBoxes, theme.primary)
                )}
              </SurfaceCard>
            </FadeInUp>
          ) : null}

          {Object.keys(stats.donorCounts).length > 0 ? (
            <FadeInUp delay={240}>
              <SurfaceCard>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.topDonors}</Text>
                {Object.entries(stats.donorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([donor, count]) =>
                  renderBar(donor, count, stats.totalBoxes, theme.warning)
                )}
              </SurfaceCard>
            </FadeInUp>
          ) : null}

          <FadeInUp delay={280}>
            <SurfaceCard>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.scanActivity}</Text>
              <View style={styles.metricGrid}>
                <MetricTile label={t.totalScans} value={stats.totalScans} tone="primary" />
                <MetricTile label={t.auditLogs} value={stats.totalAuditLogs} tone="warning" />
              </View>
              {Object.entries(stats.scansByAction).map(([action, count]) =>
                renderBar(action, count, stats.totalScans, theme.primary)
              )}
            </SurfaceCard>
          </FadeInUp>

          {Object.keys(stats.scansByDay).length > 0 ? (
            <FadeInUp delay={320}>
              <SurfaceCard>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.scansByDate}</Text>
                {Object.entries(stats.scansByDay).slice(0, 7).map(([date, count]) =>
                  renderBar(date, count, stats.totalScans, theme.success)
                )}
              </SurfaceCard>
            </FadeInUp>
          ) : null}
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
    sectionTitle: { ...type.subtitle, marginBottom: spacing.md },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    barRow: { marginBottom: spacing.md },
    barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    barLabel: { ...type.bodyStrong, fontSize: 13 },
    barValue: { ...type.caption, fontWeight: '700' },
    barTrack: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: radius.pill },
  });
}
