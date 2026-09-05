import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Switch } from 'react-native-paper';
import { signOut } from 'firebase/auth';
import * as Haptics from 'expo-haptics';
import { auth } from '../../services/firebase';
import { useAppTheme, type BrandPreset } from '../../theme/AppThemeContext';
import { useUser } from '../../contexts/UserContext';
import { useSimpleMode } from '../../contexts/SimpleModeContext';
import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import { LANGUAGE_OPTIONS, useLanguage } from '../../contexts/LanguageContext';
import { snackbar } from '../../hooks/useSnackbar';
import { layout, radius, spacing, type } from '../../theme/tokens';

export default function Settings({ navigation }: { navigation: any }) {
  const { theme, themeName, brandPreset, toggleTheme, setBrandPreset } = useAppTheme();
  const { userData, isAdmin, canEdit } = useUser();
  const { t: tAll, tf, language, setLanguage } = useLanguage();
  const { simpleMode, setSimpleMode } = useSimpleMode();
  const t = tAll('settings');
  const tCommon = tAll('common');
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const showInventory = canEdit;
  const showCommodities = isAdmin;
  const showAuditLog = isAdmin;

  const handleLanguageChange = (next: (typeof LANGUAGE_OPTIONS)[number]['key']) => {
    if (next === language) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLanguage(next);
    setLanguageMenuOpen(false);
  };

  const selectedLanguageLabel = LANGUAGE_OPTIONS.find((option) => option.key === language)?.label || 'English';

  const handleSimpleModeToggle = (next: boolean) => {
    if (next === simpleMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSimpleMode(next);
  };

  const handleSignOut = () => {
    Alert.alert(
      t.signOut,
      tCommon.signOutConfirm,
      [
        { text: tCommon.cancel, style: 'cancel' },
        {
          text: t.signOut,
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              snackbar.info(tCommon.signedOut);
            } catch (_e) {
              snackbar.error(tCommon.signOutFailed);
            }
          },
        },
      ]
    );
  };

  const brandOptions: { key: BrandPreset; label: string; color: string }[] = [
    { key: 'orange', label: (t as any).brandOrange || 'Burnt Orange', color: '#EA580C' },
    { key: 'emerald', label: (t as any).brandEmerald || 'Emerald Green', color: '#10B981' },
    { key: 'cobalt', label: (t as any).brandCobalt || 'Cobalt Blue', color: '#2563EB' },
  ];

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
            accessibilityLabel={tf('settings.themeAccessibility', {
              label: t.themeLabel,
              value: themeName === 'dark' ? t.themeDark : t.themeLight,
            })}
          />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{(t as any).brandLabel || 'Accent Color'}</Text>
            <View style={styles.brandRow}>
              {brandOptions.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setBrandPreset(opt.key);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  style={({ pressed }) => [
                    styles.brandChip,
                    {
                      borderColor: brandPreset === opt.key ? theme.primary : theme.border,
                      backgroundColor: brandPreset === opt.key ? theme.primarySoft : theme.surface,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={[styles.colorDot, { backgroundColor: opt.color }]} />
                  <Text
                    style={[
                      styles.brandChipText,
                      { color: brandPreset === opt.key ? theme.primary : theme.text, fontWeight: brandPreset === opt.key ? '700' : '500' },
                    ]}
                  >
                    {opt.key === 'orange' ? 'Orange' : opt.key === 'emerald' ? 'Emerald' : 'Cobalt'}
                  </Text>
                  {brandPreset === opt.key ? (
                    <MaterialCommunityIcons name="check" size={16} color={theme.primary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.language}</Text>
            <Pressable
              onPress={() => setLanguageMenuOpen(true)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.languagePicker,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.languagePickerText, { color: theme.text }]}>{selectedLanguageLabel}</Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={theme.muted} />
            </Pressable>
            <Modal visible={languageMenuOpen} transparent animationType="fade" onRequestClose={() => setLanguageMenuOpen(false)}>
              <Pressable style={styles.languageModalOverlay} onPress={() => setLanguageMenuOpen(false)}>
                <Pressable style={[styles.languageModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.languageModalTitle, { color: theme.text }]}>{t.language}</Text>
                  <ScrollView style={styles.languageList}>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <Pressable
                        key={option.key}
                        onPress={() => handleLanguageChange(option.key)}
                        style={({ pressed }) => [
                          styles.languageOption,
                          {
                            backgroundColor: language === option.key ? theme.primary + '22' : 'transparent',
                            borderColor: language === option.key ? theme.primary : theme.border,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.languageOptionText, { color: theme.text }]}>{option.label}</Text>
                        {language === option.key ? (
                          <MaterialCommunityIcons name="check" size={18} color={theme.primary} />
                        ) : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </Pressable>
              </Pressable>
            </Modal>
          </View>
          <View style={[styles.simpleRow, { borderTopColor: theme.border }]}>
            <View style={styles.simpleText}>
              <Text style={[styles.simpleLabel, { color: theme.text }]}>{t.simpleMode}</Text>
              <Text style={[styles.simpleHelper, { color: theme.muted }]}>{t.simpleModeHelper}</Text>
            </View>
            <Switch
              value={simpleMode}
              onValueChange={handleSimpleModeToggle}
              color={theme.primary}
              accessibilityLabel={t.simpleMode}
            />
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.section}>
          <Text style={styles.sectionLabel}>{t.account}</Text>
          <SettingRow
            theme={theme}
            icon="account-circle-outline"
            label={t.signedInAs}
            value={userData?.name || userData?.email || t.emptyValue}
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

function SettingRow({
  theme,
  icon,
  label,
  value,
  onPress,
  showChevron,
  accessibilityLabel,
}: {
  theme: any;
  icon: any;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  accessibilityLabel?: string;
}) {
  const interactive = !!onPress;
  const Wrap = interactive ? Pressable : View;
  return (
    <Wrap
      onPress={onPress as any}
      accessibilityRole={interactive ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel || (value ? `${label}: ${value}` : label)}
      style={({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => [
        rowStyles.row,
        pressed && { opacity: 0.7 },
      ]}
    >
      <MaterialCommunityIcons name={icon as any} size={22} color={theme.primary} />
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

const rowStyles = StyleSheet.create({
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
});

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
    field: { marginTop: spacing.md },
    fieldLabel: {
      ...type.eyebrow,
      color: theme.muted,
      marginBottom: spacing.sm,
    },
    brandRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    brandChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      minHeight: 40,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    brandChipText: {
      ...type.caption,
      fontSize: 13,
    },
    languagePicker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      minHeight: 48,
    },
    languagePickerText: {
      ...type.bodyStrong,
      flex: 1,
    },
    languageModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    languageModalSheet: {
      width: '100%',
      maxWidth: 420,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      maxHeight: '70%',
    },
    languageModalTitle: {
      ...type.eyebrow,
      marginBottom: spacing.sm,
    },
    languageList: {
      maxHeight: 420,
    },
    languageOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginBottom: spacing.sm,
    },
    languageOptionText: {
      ...type.body,
      flex: 1,
    },
    // P32: simple-mode toggle row. A horizontal flex with the
    // label + helper on the left and the Switch on the right.
    // A 1px top border separates it visually from the language
    // picker above.
    simpleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingTop: spacing.md,
      marginTop: spacing.md,
      borderTopWidth: 1,
    },
    simpleText: { flex: 1 },
    simpleLabel: { ...type.bodyStrong },
    simpleHelper: { ...type.caption, marginTop: 2 },
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
