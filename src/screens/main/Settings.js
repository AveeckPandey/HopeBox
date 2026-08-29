import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import * as Haptics from 'expo-haptics';
import { auth } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useUser } from '../../contexts/UserContext';
import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import ChipGroup from '../../components/ChipGroup';
import { useLanguage } from '../../contexts/LanguageContext';
import { snackbar } from '../../hooks/useSnackbar';
import { layout, radius, spacing, type } from '../../theme/tokens';

export default function Settings({ navigation }) {
  const { theme, themeName, toggleTheme } = useAppTheme();
  const { userData, isAdmin, canEdit } = useUser();
  const { t: tAll, language, setLanguage } = useLanguage();
  const t = tAll('settings');
  const tCommon = tAll('common');
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Defense in depth: even though Firestore rules gate the underlying
  // reads/writes (auditLogs is admin-only, commodities is admin-only,
  // inventory is staff+), we hide the menu items from users who
  // can't use them. A viewer tapping "AuditLog" would otherwise see
  // an empty list with no obvious reason why — this is a UX win on
  // top of the security boundary.
  const showInventory = canEdit;
  const showCommodities = isAdmin;
  const showAuditLog = isAdmin;

  // P51: language picker. Both English and Hindi are wired into
  // the loader table in LanguageContext; missing Hindi keys fall
  // back to English via the deep merge in `strings.hi.js`. No
  // "coming soon" snackbar — the switch is a real, working toggle.
  const handleLanguageChange = (next) => {
    if (next === language) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLanguage(next);
  };

  const handleSignOut = () => {
    Alert.alert(
      t.signOut,
      'Sign out of your account?',
      [
        { text: tCommon.cancel, style: 'cancel' },
        {
          text: t.signOut,
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              snackbar.info('Signed out');
            } catch (_e) {
              snackbar.error('Could not sign out');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.contentWrap}>
        <ScreenHeader title={t.title} />

        <SurfaceCard style={styles.section}>
          <Text style={styles.sectionLabel}>{t.appearance}</Text>
          <SettingRow
            theme={theme}
            icon={themeName === 'dark' ? 'weather-night' : 'white-balance-sunny'}
            label={t.themeLabel}
            value={themeName === 'dark' ? t.themeDark : t.themeLight}
            onPress={toggleTheme}
            accessibilityLabel={`${t.themeLabel}: ${themeName === 'dark' ? t.themeDark : t.themeLight}. Tap to switch.`}
          />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.language}</Text>
            <ChipGroup
              options={[
                { key: 'en', label: t.languageEnglish },
                { key: 'hi', label: t.languageHindi },
              ]}
              value={language}
              onChange={handleLanguageChange}
              scrollable={false}
            />
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.section}>
          <Text style={styles.sectionLabel}>{t.account}</Text>
          <SettingRow
            theme={theme}
            icon="account-circle-outline"
            label={t.signedInAs}
            value={userData?.name || userData?.email || '—'}
          />
          <SettingRow
            theme={theme}
            icon="shield-account-outline"
            label={t.role}
            value={
              userData?.role === 'admin' ? t.admin :
              userData?.role === 'staff' ? t.staff :
              t.viewer
            }
          />
        </SurfaceCard>

        <SurfaceCard style={styles.section}>
          <Text style={styles.sectionLabel}>{t.actions}</Text>
          {showInventory ? (
            <SettingRow
              theme={theme}
              icon="warehouse"
              label={t.adminInventory}
              onPress={() => navigation.navigate('AdminInventory')}
              showChevron
            />
          ) : null}
          {showCommodities ? (
            <SettingRow
              theme={theme}
              icon="package-variant-closed"
              label={t.commodities}
              onPress={() => navigation.navigate('Commodities')}
              showChevron
            />
          ) : null}
          {showCommodities ? (
            <SettingRow
              theme={theme}
              icon="file-document-outline"
              label={t.templates}
              onPress={() => navigation.navigate('Templates')}
              showChevron
            />
          ) : null}
          {showAuditLog ? (
            <SettingRow
              theme={theme}
              icon="history"
              label={t.auditLog}
              onPress={() => navigation.navigate('AuditLog')}
              showChevron
            />
          ) : null}
        </SurfaceCard>

        <Pressable
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel={t.signOut}
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.85 }]}
        >
          <MaterialCommunityIcons name="logout" size={20} color={theme.danger} />
          <Text style={styles.signOutText}>{t.signOut}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SettingRow({ theme, icon, label, value, onPress, showChevron, accessibilityLabel }) {
  const interactive = !!onPress;
  const Wrap = interactive ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      accessibilityRole={interactive ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel || (value ? `${label}: ${value}` : label)}
      style={({ pressed }) => [
        rowStyles.row,
        pressed && { opacity: 0.7 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={theme.primary} />
      <View style={rowStyles.textWrap}>
        <Text style={[rowStyles.label, { color: theme.muted }]}>{label}</Text>
        {value ? <Text style={[rowStyles.value, { color: theme.text }]}>{value}</Text> : null}
      </View>
      {showChevron ? (
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.muted} />
      ) : null}
    </Wrap>
  );
}

const rowStyles = {
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  textWrap: { flex: 1 },
  label: { ...type.caption, marginBottom: 2 },
  value: { ...type.bodyStrong },
};

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flexGrow: 1, backgroundColor: theme.background, paddingBottom: spacing.xxl },
    contentWrap: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: spacing.md },
    section: { marginBottom: spacing.lg, padding: spacing.lg },
    sectionLabel: {
      ...type.eyebrow,
      color: theme.primary,
      marginBottom: spacing.sm,
    },
    // P51: language picker field. The label mirrors the
    // eyebrow style used by the rest of the surface cards, and
    // the ChipGroup is given extra top spacing to breathe.
    field: { marginTop: spacing.md },
    fieldLabel: {
      ...type.eyebrow,
      color: theme.muted,
      marginBottom: spacing.sm,
    },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerSoft,
      minHeight: 48,
    },
    signOutText: {
      ...type.bodyStrong,
      color: theme.danger,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
  });
}
