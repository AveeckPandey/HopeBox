import { memo, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';

import { db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useUser } from '../../contexts/UserContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { firestoreOnError } from '../../hooks/useFirestoreSubscription';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import EmptyState from '../../components/EmptyState';
import FadeInUp from '../../components/FadeInUp';
import AmbientGlow from '../../components/AmbientGlow';
import { layout, spacing, type } from '../../theme/tokens';

function getActionColor(action, theme) {
  if (!action) return theme.muted;
  if (action.includes('created')) return theme.success;
  if (action.includes('deleted')) return theme.danger;
  if (action.includes('dispatched')) return theme.warning;
  if (action.includes('returned')) return theme.primary;
  if (action.includes('scanned')) return theme.primary;
  if (action.includes('export')) return theme.muted;
  if (action.includes('sign')) return theme.muted;
  return theme.muted;
}

// Build a display label for a log row's `userId` using a local cache
// of /users. Falls back gracefully when the user doc is missing,
// the cache is empty, or the userId is the literal "system".
function userLabel(userId, usersById, fallback) {
  if (!userId || userId === 'system') return fallback;
  const u = usersById[userId];
  if (!u) return fallback;
  return u.name || u.email || fallback;
}

export default function AuditLog({ navigation }) {
  const { theme } = useAppTheme();
  const { isAdmin, loading: userLoading } = useUser();
  const { t: tAll } = useLanguage();
  const t = tAll('auditLog');
  const [logs, setLogs] = useState([]);
  // Map of uid -> {name, email}. Live subscription so newly created
  // users show up in the audit log immediately.
  const [usersById, setUsersById] = useState({});
  const styles = useMemo(() => createStyles(theme), [theme]);

  // P26: pull-to-refresh. The /auditLogs and /users listeners
  // are already live, so this is a UX spinner only.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  // Always call hooks in the same order. Subscribe for admins only.
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => firestoreOnError('AuditLog/logs', err)
    );
    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const next = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          next[d.id] = { name: data.name, email: data.email };
        });
        setUsersById(next);
      },
      (err) => firestoreOnError('AuditLog/users', err)
    );
    return () => unsubscribe();
  }, [isAdmin]);

  // Defense-in-depth: non-admins see the "admin only" screen.
  if (!userLoading && !isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center' }}>
        <EmptyState
          icon="shield-lock-outline"
          title="Admin only"
          message="The audit log is restricted to administrators."
          actionLabel="Back"
          onAction={() => navigation?.goBack?.()}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AmbientGlow variant="topLeft" opacity={0.4} />
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        // P36: FlatList tuning. Defaults to rendering 10 rows then
        // gradually the rest on a 21-item window. The first paint
        // of an org with thousands of audit rows would otherwise
        // tear through the whole doc list. 10/2/7 is enough that
        // the visible card row + the next screenful are always
        // mounted without paying for the full list.
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
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
            <FadeInUp delay={0}>
              <ScreenHeader eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />
            </FadeInUp>
          </View>
        }
        renderItem={({ item }) => (
          <LogRow
            item={item}
            theme={theme}
            actor={userLabel(item.userId, usersById, t.unknownUser)}
            userLabel={t.userLabel}
            styles={styles}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="file-search-outline"
            title={t.emptyTitle}
            message={t.emptyMessage}
          />
        }
      />
    </View>
  );
}

// Single log row. P36: memoised so unrelated state changes (the
// live `usersById` map updating for a different row, the
// `refreshing` flag flipping, etc.) don't re-render every card in
// the list. Without this the FlatList re-renders all visible rows
// any time the Firestore snapshot fires.
//
// P37: no per-item FadeInUp. Animating 100+ log entries in
// sequence makes the screen feel laggy on first paint and the
// per-item delay is imperceptible at this density. The header
// still animates.
const LogRow = memo(function LogRow({ item, theme, actor, userLabel: userLabelText, styles }: { item: any; theme: any; actor: any; userLabel: any; styles: any }) {
  const color = getActionColor(item.action, theme);
  return (
    <View style={styles.cardWrap}>
      <SurfaceCard tone="default" padding={spacing.md}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <View style={styles.cardContent}>
            <Text style={[styles.actionText, { color: theme.text }]}>
              {item.action?.replace(/_/g, ' ')}
            </Text>
            <Text style={[styles.timeText, { color: theme.muted }]}>
              {item.timestamp?.toDate?.()?.toLocaleString() || 'Unknown time'}
            </Text>
            {item.userId ? (
              <Text style={[styles.userText, { color: theme.muted }]}>
                {userLabelText}: {actor}
              </Text>
            ) : null}
            {item.details && Object.keys(item.details).length > 0 ? (
              <View style={[styles.details, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                {Object.entries(item.details).map(([key, val]) => (
                  <Text key={key} style={[styles.detailText, { color: theme.muted }]}>
                    {key}: {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </SurfaceCard>
    </View>
  );
});

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    list: { paddingBottom: spacing.xxl, paddingTop: spacing.sm },
    contentWrap: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    cardWrap: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
    cardContent: { flex: 1 },
    actionText: { ...type.bodyStrong, textTransform: 'capitalize' },
    timeText: { ...type.caption, fontSize: 11, marginTop: spacing.xs },
    userText: { ...type.caption, fontSize: 11, marginTop: 2 },
    details: { marginTop: spacing.sm, borderRadius: 8, padding: spacing.sm, borderWidth: 1 },
    detailText: { ...type.caption, fontSize: 11, lineHeight: 16 },
  });
}
