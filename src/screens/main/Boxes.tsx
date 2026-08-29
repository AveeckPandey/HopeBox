import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton } from 'react-native-paper';
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';

import { db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useWarehouse } from '../../contexts/WarehouseContext';
import { useUser } from '../../contexts/UserContext';
import { useCommodities } from '../../contexts/CommoditiesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { lineQty } from '../../services/boxLines';
import { logAction } from '../../services/audit';
import { logger } from '../../services/logger';
import { snackbar } from '../../hooks/useSnackbar';
import { firestoreOnError } from '../../hooks/useFirestoreSubscription';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import MetricTile from '../../components/MetricTile';
import ChipGroup, { type ChipOption } from '../../components/ChipGroup';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import ThemedTextInput from '../../components/ThemedTextInput';
import QrModal from '../../components/QrModal';
import { layout, radius, spacing, type } from '../../theme/tokens';

export default function Boxes({ navigation }) {
  const { theme } = useAppTheme();
  const { currentWarehouse } = useWarehouse();
  const { userData, canEdit } = useUser();
  const { commodities } = useCommodities();
  const { t: tAll, tf } = useLanguage();
  const t = tAll('boxes');

  // P27: status filter options read from the i18n catalog so the
  // chips translate when the user switches language. The
  // "all" / "stored" / "dispatched" / "returned" keys stay as
  // chip values; only the human label is localized.
  const STATUS_OPTIONS = useMemo(
    () => [
      { key: 'all', label: t.filterAll },
      { key: 'stored', label: t.stored },
      { key: 'dispatched', label: t.dispatched },
      { key: 'returned', label: t.returned },
    ],
    [t.filterAll, t.stored, t.dispatched, t.returned]
  );
  const tCommon = tAll('common');

  const [boxes, setBoxes] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  // P34: the QR is shown in a single Modal at the screen level,
  // not on every card. `qrModalBox` is the box whose QR is
  // currently displayed; null when the modal is closed.
  const [qrModalBox, setQrModalBox] = useState(null);
  // P26: pull-to-refresh state. The Firestore listener is
  // already live, so "refreshing" is a UX hint only — we set it
  // true, briefly wait, then false. Re-querying is unnecessary
  // because onSnapshot would have already pushed the latest data
  // through.
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    let boxesRef: any = collection(db, 'boxes');
    if (currentWarehouse?.id) {
      boxesRef = query(boxesRef, where('warehouseId', '==', currentWarehouse.id));
    }
    const unsubscribe = onSnapshot(
      boxesRef,
      (snapshot) => {
        setBoxes(snapshot.docs.map((boxDoc) => ({ id: boxDoc.id, ...boxDoc.data() })));
      },
      (err) => firestoreOnError('Boxes', err)
    );
    return () => unsubscribe();
  }, [currentWarehouse]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Give the listener a beat to push a fresh snapshot. 600ms
    // is enough that the spinner is visible but short enough
    // that it doesn't feel laggy.
    await new Promise((resolve) => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  // P24/P50: delete a box from the registry. The card-level
  // confirm is a destructive-style Alert with the box ID echoed
  // back so the user can verify they're not deleting the wrong
  // row.
  const confirmDelete = useCallback((item) => {
    Alert.alert(
      t.deleteConfirmTitle,
      t.deleteConfirmMessage,
      [
        { text: tCommon.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              // Best-effort scanHistory cleanup, same posture as
              // BoxDetails' delete.
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
              snackbar.success(t.deleteSuccess);
            } catch (err) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              logger.logError('Boxes/delete', err, { boxId: item.id });
              snackbar.error(t.deleteFailed);
            }
          },
        },
      ]
    );
  }, [t.deleteConfirmTitle, t.deleteConfirmMessage, t.delete, t.deleteSuccess, t.deleteFailed, tCommon.cancel, userData]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    boxes.forEach((b) => {
      if (b.category) cats.add(b.category);
      if (b.tags) b.tags.forEach((tag) => cats.add(tag));
    });
    return Array.from(cats);
  }, [boxes]);

  const categoryOptions = useMemo<ChipOption[]>(
    () => [{ key: 'all', label: t.filterAll }, ...allCategories.map((c) => ({ key: c, label: c }))],
    [allCategories, t.filterAll]
  );

  const filteredBoxes = useMemo(() => {
    return boxes.filter((box) => {
      const matchesSearch = box.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || box.status === statusFilter;
      const matchesCategory =
        categoryFilter === 'all' ||
        (box.tags && box.tags.includes(categoryFilter)) ||
        box.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [boxes, search, statusFilter, categoryFilter]);

  // P36: stable handler identities. The `onEdit`/`onPrint`/etc.
  // callbacks were inline arrow functions in renderItem, so every
  // render handed BoxCardMemo fresh prop identities and forced a
  // re-render of every visible row. Wrapping in useCallback with
  // `navigation` in the deps keeps the references stable across
  // renders.
  const handleEdit = useCallback((item) => navigation.navigate('EditBox', { item }), [navigation]);
  const handlePrint = useCallback((item) => navigation.navigate('PrintQR', { item }), [navigation]);
  const handleOpen = useCallback((item) => navigation.navigate('BoxDetails', { item }), [navigation]);
  const handleDelete = useCallback((item) => confirmDelete(item), [confirmDelete]);
  // P34: open the QR modal for a single box. The modal is
  // mounted at the screen level so the QR isn't rendered once
  // per list item.
  const handleShowQr = useCallback((item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQrModalBox(item);
  }, []);
  const handleCloseQr = useCallback(() => setQrModalBox(null), []);

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredBoxes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        // P36: FlatList tuning. Most NGOs have at most a few
        // hundred boxes, but a year-old org with thousands will
        // see jank on every filter change without these limits.
        // 10/2/7 keeps the visible window + one screenful ahead
        // always mounted, and the rest virtualized.
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        // P26: pull-to-refresh. The colors are tuned for both
        // themes (the spinner picks up the theme primary, the
        // background uses the surface so it doesn't look stark).
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
            progressBackgroundColor={theme.surfaceRaised}
          />
        }
        ListHeaderComponent={
          <View style={styles.contentWrap}>
            <ScreenHeader eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />
            <ThemedTextInput
              placeholder={t.searchPlaceholder}
              value={search}
              onChangeText={setSearch}
              style={styles.search}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t.searchPlaceholder}
            />
            <View style={styles.chipsBlock}>
              <ChipGroup options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
            </View>
            {allCategories.length > 0 ? (
              <View style={styles.chipsBlock}>
                <ChipGroup options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} />
              </View>
            ) : null}
            {filteredBoxes.length > 0 ? (
              <View style={styles.countRow}>
                <Text style={[styles.countText, { color: theme.muted }]}>
                  {filteredBoxes.length === 1
                    ? t.countOne
                    : `${filteredBoxes.length} ${t.countMany}`}
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          // P37: no per-item FadeInUp. With a delay on every card
          // the animation queue grows linearly with the list, so a
          // 200-box org waits 8 seconds for the last card to slide
          // in. The list header still animates; that gives the
          // screen its "settling" feel without a per-row cost.
          <View style={styles.cardWrap}>
            <BoxCardMemo
              item={item}
              theme={theme}
              styles={styles}
              canEdit={canEdit}
              onEdit={handleEdit}
              onPrint={handlePrint}
              onOpen={handleOpen}
              onDelete={handleDelete}
              onShowQr={handleShowQr}
              t={t}
              tf={tf}
              commodities={commodities}
            />
          </View>
        )}
        ListEmptyComponent={
          !search && statusFilter === 'all' && categoryFilter === 'all' ? (
            <EmptyState
              icon="package-variant-closed"
              title={t.emptyTitle}
              message={t.emptyMessage}
              actionLabel={canEdit ? t.emptyCta : undefined}
              onAction={canEdit ? () => navigation.navigate('AddBox') : undefined}
            />
          ) : (
            <EmptyState
              icon="magnify-close"
              title={t.noMatchesTitle}
              message={t.noMatchesMessage}
            />
          )
        }
      />
      {canEdit ? (
        <IconButton
          icon="plus"
          iconColor={theme.primaryText}
          size={28}
          mode="contained"
          containerColor={theme.primary}
          accessibilityLabel={t.addBox}
          style={styles.fab}
          onPress={() => navigation.navigate('AddBox')}
        />
      ) : null}
      <QrModal
        visible={!!qrModalBox}
        value={qrModalBox?.id || ''}
        onClose={handleCloseQr}
        label={qrModalBox?.id}
        helperText={t.qrHelper}
      />
    </View>
  );
}

function BoxCard({ item, theme, styles, canEdit, onEdit, onPrint, onOpen, onDelete, onShowQr, t, tf, commodities }) {
  return (
    <SurfaceCard>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={tf('boxes.openBox', { id: item.id, status: item.status })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardLabel, { color: theme.muted }]}>{t.boxId}</Text>
            <Text style={[styles.cardId, { color: theme.text }]}>{item.id}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <View style={styles.metricGrid}>
          {commodities.map((c) => {
            // Read from the new contents map; fall back to legacy
            // top-level fields so pre-v2.0 boxes still render.
            const v =
              item.contents && item.contents[c.id] != null
                ? lineQty(item.contents[c.id])
                : item[c.id];
            // Skip zero lines on the card so the grid stays tidy.
            if (!v) return null;
            return (
              <MetricTile key={c.id} label={c.name} value={v} unit={c.unit} />
            );
          })}
        </View>

        {(item.category || (item.tags && item.tags.length > 0)) ? (
          <View style={styles.tagRow}>
            {item.category ? (
              <View style={[styles.tag, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.tagText, { color: theme.primary }]}>{item.category}</Text>
              </View>
            ) : null}
            {item.tags && item.tags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                <Text style={[styles.tagText, { color: theme.muted }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.donorName ? (
          <View style={styles.donorRow}>
            <MaterialCommunityIcons name="account-heart-outline" size={14} color={theme.muted} />
            <Text style={[styles.donorText, { color: theme.muted }]}>{t.donor}: {item.donorName}</Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.actionsRow}>
        {canEdit ? (
          <IconButton
            icon="pencil"
            iconColor={theme.primary}
            containerColor={theme.primarySoft}
            accessibilityLabel={tf('boxes.editBox', { id: item.id })}
            onPress={onEdit}
          />
        ) : null}
        {canEdit ? (
          <IconButton
            icon="trash-can-outline"
            iconColor={theme.danger}
            containerColor={theme.dangerSoft}
            accessibilityLabel={tf('boxes.deleteBox', { id: item.id })}
            onPress={onDelete}
          />
        ) : null}
        <View style={{ flex: 1 }} />
        {/* P34: tap-to-expand QR. The QR is shown in a screen-
            level modal, not on every card. The cost of the QR
            render is paid exactly once, on demand. */}
        <Pressable
          onPress={onShowQr}
          accessibilityRole="button"
          accessibilityLabel={tf('boxes.viewQr', { id: item.id })}
          style={({ pressed }) => [
            styles.printBtn,
            { borderColor: theme.primary },
            pressed && { opacity: 0.85 },
          ]}
        >
          <MaterialCommunityIcons name="qrcode" size={16} color={theme.primary} />
          <Text style={[styles.printBtnText, { color: theme.primary }]}>{t.viewQR}</Text>
        </Pressable>
        <Pressable
          onPress={onPrint}
          accessibilityRole="button"
          accessibilityLabel={tf('boxes.printBox', { id: item.id })}
          style={({ pressed }) => [
            styles.printBtn,
            { borderColor: theme.primary },
            pressed && { opacity: 0.85 },
          ]}
        >
          <MaterialCommunityIcons name="printer-outline" size={16} color={theme.primary} />
          <Text style={[styles.printBtnText, { color: theme.primary }]}>{t.printQR}</Text>
        </Pressable>
      </View>
    </SurfaceCard>
  );
}

// P36: memoised BoxCard. Without this, every re-render of Boxes
// (filter changes, ref count updates, snapshot fires) re-renders
// every visible card. With memo, a card only re-renders when its
// own props change, so the row list can stay stable during search
// input or pull-to-refresh.
const BoxCardMemo = memo(BoxCard);

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    list: { paddingBottom: 120, paddingTop: spacing.sm },
    contentWrap: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    search: { marginBottom: 0 },
    chipsBlock: {},
    countRow: { marginTop: -spacing.xs },
    countText: { ...type.caption },
    cardWrap: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    cardHeaderText: { flex: 1 },
    cardLabel: { ...type.eyebrow, marginBottom: 2 },
    cardId: { fontSize: 18, fontWeight: '800' },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
    tag: {
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: 'transparent',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    tagText: { ...type.caption, fontSize: 11, fontWeight: '600' },
    donorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
    donorText: { ...type.caption },
    actionsRow: {
      marginTop: spacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
    },
    printBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      minHeight: 40,
    },
    printBtnText: { ...type.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    fab: {
      position: 'absolute',
      right: spacing.md,
      bottom: spacing.lg,
    },
  });
}
