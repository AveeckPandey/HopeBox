import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useWarehouse } from '../../contexts/WarehouseContext';
import { useCommodities } from '../../contexts/CommoditiesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { snackbar } from '../../hooks/useSnackbar';
import { safeIcon } from '../../services/commodities';
import { logger } from '../../services/logger';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import ThemedTextInput from '../../components/ThemedTextInput';
import ChipGroup, { type ChipOption } from '../../components/ChipGroup';
import FadeInUp from '../../components/FadeInUp';
import AmbientGlow from '../../components/AmbientGlow';
import { layout, radius, spacing, type } from '../../theme/tokens';

export default function AdminInventory() {
  const { theme } = useAppTheme();
  const { warehouses, currentWarehouse } = useWarehouse();
  const { commodities, loading: commoditiesLoading } = useCommodities();
  const { t: tAll } = useLanguage();
  const t = tAll('adminInventory');

  // Track the active warehouse locally so the form rebinds when the
  // user changes selection. Falls back to currentWarehouse, then to
  // the first warehouse in the list, then to the legacy 'main' doc.
  const [warehouseId, setWarehouseId] = useState(
    currentWarehouse?.id || warehouses[0]?.id || 'main'
  );
  const [contents, setContents] = useState({});
  const [busy, setBusy] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Reset the contents when the active warehouse changes. The snapshot
  // below will re-hydrate.
  useEffect(() => {
    // Intentional synchronous setState to clear form on warehouse change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContents({});
  }, [warehouseId]);

  useEffect(() => {
    const ref = doc(db, 'inventory', warehouseId);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const next = {};
        if (!snap.exists()) {
          setContents(next);
          return;
        }

        const data = snap.data();
        for (const c of commodities) {
          const v = data[c.id];
          if (typeof v === 'number') {
            next[c.id] = String(v);
            continue;
          }
          if (c.id === 'commodity_rice' && data.rice != null) next[c.id] = String(data.rice);
          else if (c.id === 'commodity_dal' && data.dal != null) next[c.id] = String(data.dal);
          else if (c.id === 'commodity_sachets' && data.sachets != null) next[c.id] = String(data.sachets);
        }
        setContents(next);
      },
      (err) => {
        logger.logWarning('AdminInventory/snapshot', err.message);
      }
    );
    return () => unsubscribe();
  }, [warehouseId, commodities]);

  // If the user has no current warehouse selected (e.g. navigated here
  // directly), pick the first one once warehouses hydrate. This is an
  // intentional sync of local form state to the active warehouse; the
  // `if (warehouseId !== 'main') return` guard prevents re-firing once
  // the user picks a real warehouse.
  useEffect(() => {
    if (warehouseId !== 'main') return;
    if (currentWarehouse?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWarehouseId(currentWarehouse.id);
    } else if (warehouses[0]?.id) {
      setWarehouseId(warehouses[0].id);
    }
  }, [currentWarehouse, warehouses, warehouseId]);

  const warehouseOptions = useMemo(
    () => warehouses.map((wh) => ({ key: wh.id, label: wh.name })),
    [warehouses]
  );

  const handleLineChange = (commodityId, raw) => {
    setContents((prev) => {
      const next = { ...prev };
      if (raw === '' || raw == null) {
        delete next[commodityId];
      } else {
        next[commodityId] = raw;
      }
      return next;
    });
  };

  const handleUpdate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Build the flat contents map. Preserve unknown legacy fields if
      // any (so we don't drop data) by merging on top of the existing
      // doc via setDoc(merge:true).
      const payload = { updatedAt: serverTimestamp() };
      for (const [k, v] of Object.entries(contents)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) payload[k] = n;
      }
      await setDoc(doc(db, 'inventory', warehouseId), payload, { merge: true });
      snackbar.success(t.success);
    } catch (err) {
      logger.logError('AdminInventory/update', err, { warehouseId });
      snackbar.error(t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AmbientGlow variant="topLeft" opacity={0.5} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.contentWrap}>
          <FadeInUp delay={0}>
            <ScreenHeader eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />
          </FadeInUp>
          <FadeInUp delay={80}>
            <SurfaceCard>
              {warehouses.length > 1 ? (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.muted }]}>Warehouse</Text>
                  <ChipGroup
                    options={warehouseOptions as ChipOption[]}
                    value={warehouseId}
                    onChange={setWarehouseId}
                    scrollable={false}
                  />
                </View>
              ) : null}

              {!commoditiesLoading && commodities.length === 0 ? (
                <Text style={[styles.empty, { color: theme.muted }]}>
                  No commodities configured. Add commodities before adjusting inventory.
                </Text>
              ) : null}

              {commodities.map((c) => (
                <View key={c.id} style={styles.row}>
                  <View style={[styles.iconDot, { backgroundColor: c.color || theme.muted }]}>
                    <MaterialCommunityIcons
                      name={safeIcon(c.icon) as any}
                      size={16}
                      color={theme.primaryText}
                    />
                  </View>
                  <View style={styles.qtyCol}>
                    <ThemedTextInput
                      label={`${c.name} (${c.unit})`}
                      value={contents[c.id] ?? ''}
                      onChangeText={(v) => handleLineChange(c.id, v)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              ))}

              <Pressable
                onPress={handleUpdate}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t.update}
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: theme.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="content-save-outline" size={18} color={theme.primaryText} />
                <Text style={[styles.ctaText, { color: theme.primaryText }]}>{t.update}</Text>
              </Pressable>
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
    field: { marginBottom: spacing.md },
    label: { ...type.eyebrow, marginBottom: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyCol: { flex: 1 },
    empty: { ...type.body, paddingVertical: spacing.md },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      minHeight: 52,
      marginTop: spacing.md,
    },
    ctaText: { ...type.bodyStrong, textTransform: 'uppercase', letterSpacing: 1.5 },
  });
}
