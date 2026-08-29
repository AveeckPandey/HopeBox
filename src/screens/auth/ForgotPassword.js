import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { sendPasswordResetEmail } from 'firebase/auth';
import * as Haptics from 'expo-haptics';

import { auth } from '../../services/firebase';
import { logger } from '../../services/logger';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { snackbar } from '../../hooks/useSnackbar';

import AmbientGlow from '../../components/AmbientGlow';
import FadeInUp from '../../components/FadeInUp';
import { layout, radius, spacing, type } from '../../theme/tokens';

// Standalone password-reset screen (P48). Uses the standard
// Firebase `sendPasswordResetEmail` flow — the user enters their
// email, we fire the request, and Firebase sends a reset link to
// that address. The screen itself is fully decoupled from auth
// state: a logged-in user can navigate here too (e.g. to send a
// reset link to a different account they administer).
export default function ForgotPassword({ navigation }) {
  const { theme } = useAppTheme();
  const { t: tAll } = useLanguage();
  const t = tAll('forgotPassword');
  const tAuth = tAll('auth');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      snackbar.error(tAuth.errors.emailInvalid);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      snackbar.success(t.success);
      // Give the snackbar a moment to register visually before
      // popping the screen — without this the user sometimes
      // sees the snackbar flash and then vanish on transition.
      setTimeout(() => navigation.goBack(), 600);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      logger.logError('auth/ForgotPassword', err);
      // Firebase returns auth/user-not-found and auth/invalid-email
      // for typos. We deliberately don't surface those to the user
      // (account enumeration), and instead show the same generic
      // message as a success. This is the same posture as the
      // major web apps.
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-email' ||
        err.code === 'auth/missing-email'
      ) {
        snackbar.success(t.success);
        setTimeout(() => navigation.goBack(), 600);
      } else {
        snackbar.error(t.failed);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AmbientGlow variant="top" opacity={0.7} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeInUp delay={0} duration={420} distance={20}>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>{t.eyebrow}</Text>
          <Text style={styles.heading}>{t.title}</Text>
          <Text style={[styles.subheading, { color: theme.muted }]}>{t.subtitle}</Text>

          <View
            style={[
              styles.inputWrapper,
              focused && { borderColor: theme.primary },
              { backgroundColor: theme.surfaceRaised, borderColor: focused ? theme.primary : theme.border },
            ]}
          >
            <Text style={[styles.inputLabel, { color: theme.primary }]}>{t.emailLabel}</Text>
            <RNTextInput
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t.emailLabel}
              style={[styles.input, { color: theme.text }]}
              placeholder={t.emailPlaceholder}
              placeholderTextColor={theme.muted}
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t.send}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: loading ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={theme.primaryText} size={20} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.primaryText }]}>
                {loading ? t.sending : t.send}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t.backToSignIn}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.backText, { color: theme.primary }]}>{t.backToSignIn}</Text>
          </Pressable>
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl + spacing.lg,
      paddingBottom: spacing.xxl,
    },
    eyebrow: { ...type.eyebrow, marginBottom: spacing.sm, letterSpacing: 1.5 },
    heading: {
      fontSize: 36, fontWeight: '700', color: theme.text, letterSpacing: -0.5, lineHeight: 42,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: spacing.sm,
    },
    subheading: { ...type.body, marginBottom: spacing.xl },
    inputWrapper: {
      borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm, paddingBottom: spacing.xs, marginBottom: spacing.lg,
    },
    inputLabel: { ...type.eyebrow, fontSize: 10, marginBottom: 2 },
    input: { backgroundColor: 'transparent', fontSize: 15, paddingHorizontal: 0, height: 40 },
    button: {
      paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center',
      minHeight: 52, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    buttonText: { ...type.bodyStrong, fontSize: 15, letterSpacing: 1.5, textTransform: 'uppercase' },
    backBtn: { alignItems: 'center', marginTop: spacing.lg, minHeight: 44, justifyContent: 'center' },
    backText: { ...type.bodyStrong, fontSize: 14 },
    // `layout` is imported for the optional max-width on tablets
    // (left here so the import isn't dead, even though the screen
    // is single-column and doesn't need it today).
    _unused: { maxWidth: layout.maxContentWidth },
  });
}
