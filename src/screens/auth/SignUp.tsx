import { useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';

import { auth, db } from '../../services/firebase';
import { logger } from '../../services/logger';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSimpleMode } from '../../contexts/SimpleModeContext';
import { snackbar } from '../../hooks/useSnackbar';

import AmbientGlow from '../../components/AmbientGlow';
import FadeInUp from '../../components/FadeInUp';
import { layout, radius, spacing, type } from '../../theme/tokens';

export default function SignUp({ navigation }) {
  const { theme } = useAppTheme();
  const { t: tAll, language } = useLanguage();
  const { scale: simpleScale } = useSimpleMode();
  const t = tAll('auth');
  const tApp = tAll('app');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  // The screen-level fade/slide is handled by the single FadeInUp
  // wrapper below. The previous implementation nested RN's
  // `Animated.View` outside a Reanimated `FadeInUp`, which left the
  // inner content invisible when the worklet runtime and RN Animated
  // competed for the same node. One FadeInUp = one animation system.
  // `language` is read so the component re-renders on locale change.
  void language;

  const validate = () => {
    if (!name.trim()) return t.errors.nameRequired;
    if (!email.includes('@')) return t.errors.emailInvalid;
    if (password.length < 8) return t.errors.passwordShort;
    return null;
  };

  // P10: policy destinations are release configuration, never
  // placeholder URLs embedded in the app. This lets each NGO point
  // the app at its own approved Terms and Privacy pages.
  const openExternalLink = async (url: string | undefined, label: string) => {
    if (!url) {
      logger.logWarning('auth/SignUp', 'Legal policy URL is not configured', { label });
      snackbar.info(t.legalLinkUnavailable);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('Unsupported legal policy URL');
      await Linking.openURL(url);
    } catch (err) {
      logger.logWarning('auth/SignUp', 'openExternalLink failed', {
        url,
        message: err instanceof Error ? err.message : String(err),
      });
      snackbar.info(t.legalLinkUnavailable);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const handleSignUp = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // The `role` field is intentionally NOT written here.
      // Firestore security rules (firestore.rules) deny any client
      // write that includes `role` on /users/{uid}. An admin must
      // promote the user via the admin flow. Until then the user is
      // a `viewer` (read-only). This prevents a self-signup from
      // granting itself `staff` or `admin` privileges.
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: name.trim(),
        email: email.toLowerCase(),
        createdAt: new Date().toISOString(),
      }, { merge: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      snackbar.success(`Welcome to ${tApp.name}`);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      logger.logError('auth/SignUp', err);
      if (err.code === 'auth/email-already-in-use') setError(t.errors.emailInUse);
      else if (err.code === 'auth/invalid-email') setError(t.errors.invalidEmail);
      else if (err.code === 'auth/weak-password') setError(t.errors.weakPassword);
      else setError(err.message || t.errors.accountFailed);
    } finally {
      setLoading(false);
    }
  };

  const inputField = (label, value, onChange, field, extra = {}) => (
    <View
      style={[
        styles.inputWrapper,
        focusedField === field && styles.inputWrapperFocused,
        { backgroundColor: theme.surfaceRaised, borderColor: focusedField === field ? theme.primary : theme.border },
      ]}
    >
      <Text style={[styles.inputLabel, { color: theme.primary }]}>{label}</Text>
      <RNTextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocusedField(field)}
        onBlur={() => setFocusedField(null)}
        style={[styles.input, { color: theme.text }]}
        placeholderTextColor={theme.muted}
        accessibilityLabel={label}
        {...extra}
      />
    </View>
  );

  // P32: simpleScale is in the dep array so toggling the Setting
  // immediately re-creates the styles. The React Compiler can't
  // preserve the memoization it inferred when the styles were
  // cached via a WeakMap, so we accept the disable — same pattern
  // the rest of the codebase uses for compiler-shaky memoization.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const styles = useMemo(() => createStyles(theme, simpleScale), [theme, simpleScale]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AmbientGlow variant="top" opacity={0.8} />
      <AmbientGlow variant="bottomRight" opacity={0.6} />

      <Pressable
        style={styles.dismissLayer}
        onPress={() => Keyboard.dismiss()}
        accessible={false}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeInUp delay={0} duration={420} distance={20}>
          <View style={styles.brandMark}>
            <View style={[styles.brandSquare, { borderColor: theme.primary }]} />
            <View style={[styles.brandSquareInner, { backgroundColor: theme.primary }]} />
          </View>

          <Text style={styles.heading}>{t.createHeading}</Text>
          <Text style={styles.subheading}>{t.createSub}</Text>

          <View style={styles.stepRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <View style={[styles.stepBadge, { borderColor: theme.primary }]}>
              <Text style={[styles.stepText, { color: theme.primary }]}>NEW</Text>
            </View>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <View>
            {inputField(t.fullName, name, setName, 'name', { placeholder: t.namePlaceholder, autoCapitalize: 'words' })}
            {inputField(t.email, email, setEmail, 'email', { placeholder: t.emailPlaceholder, keyboardType: 'email-address', autoCapitalize: 'none' })}
            {inputField(t.password, password, setPassword, 'password', { placeholder: t.passwordPlaceholder, secureTextEntry: true })}
          </View>

          <View style={styles.strengthRow}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthBar,
                  { backgroundColor: password.length >= i * 2 ? theme.primary : theme.border },
                ]}
              />
            ))}
            <Text style={[styles.strengthLabel, { color: theme.muted }]}>
              {password.length === 0 ? t.strengthLabels.empty :
                password.length < 6 ? t.strengthLabels.tooShort :
                password.length < 10 ? t.strengthLabels.fair : t.strengthLabels.strong}
            </Text>
          </View>

          {error ? (
            <View
              style={[styles.errorBox, { backgroundColor: theme.dangerSoft, borderLeftColor: theme.danger }]}
              accessibilityLiveRegion="polite"
            >
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          <View>
            <Pressable
              onPress={handleSignUp}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={t.signUp}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.primary, opacity: loading ? 0.6 : pressed ? 0.85 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={theme.primaryText} size={20} />
              ) : (
                <Text style={[styles.buttonText, { color: theme.primaryText }]}>{t.signUp}</Text>
              )}
            </Pressable>

            <Text style={[styles.terms, { color: theme.muted }]}>
              {t.termsPrefix}
              <Text
                style={[styles.termsLink, { color: theme.primary }]}
                onPress={() => openExternalLink(process.env.EXPO_PUBLIC_TERMS_URL, t.termsOfService)}
                accessibilityRole="link"
                accessibilityLabel={t.termsOfService}
                accessibilityHint={t.legalLinkHint}
                suppressHighlighting={false}
              >
                {t.termsOfService}
              </Text>
              {t.termsSuffix}
              <Text
                style={[styles.termsLink, { color: theme.primary }]}
                onPress={() => openExternalLink(process.env.EXPO_PUBLIC_PRIVACY_URL, t.privacyPolicy)}
                accessibilityRole="link"
                accessibilityLabel={t.privacyPolicy}
                accessibilityHint={t.legalLinkHint}
                suppressHighlighting={false}
              >
                {t.privacyPolicy}
              </Text>
            </Text>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.muted }]}>{t.haveAccount} </Text>
              <Pressable
                onPress={() => navigation.navigate('SignIn')}
                accessibilityRole="button"
                accessibilityLabel={t.signIn}
              >
                <Text style={[styles.footerLink, { color: theme.primary }]}>{t.signIn}</Text>
              </Pressable>
            </View>
          </View>
        </FadeInUp>
      </ScrollView>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme, simpleScale = 1) {
  // P32: simple mode scales the primary CTA's minHeight and font so
  // low-literacy field staff can hit it reliably.
  const buttonMinHeight = Math.round(52 * simpleScale);
  const buttonFontSize = Math.round(15 * simpleScale);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    // P28: tap-to-dismiss keyboard layer (see SignIn for the
    // rationale).
    dismissLayer: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xxl, paddingTop: spacing.xxl + 24 },
    container: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: spacing.xl,
    },
    brandMark: { alignItems: 'flex-start', marginBottom: spacing.xl, position: 'relative', width: 24, height: 24 },
    brandSquare: { position: 'absolute', width: 18, height: 18, borderWidth: 2, borderRadius: 3 },
    brandSquareInner: { position: 'absolute', top: 6, left: 6, width: 10, height: 10, borderRadius: 2 },
    heading: {
      fontSize: 44, fontWeight: '700', color: theme.text, letterSpacing: -1, lineHeight: 50,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    subheading: { ...type.eyebrow, fontSize: 13, color: theme.muted, marginTop: spacing.sm, letterSpacing: 1.5 },
    stepRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl, gap: spacing.sm },
    dividerLine: { flex: 1, height: 1 },
    stepBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 3 },
    stepText: { ...type.eyebrow, fontSize: 10 },
    inputWrapper: {
      borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm, paddingBottom: spacing.xs, marginBottom: spacing.md,
    },
    inputWrapperFocused: {},
    inputLabel: { ...type.eyebrow, fontSize: 10, marginBottom: 2 },
    input: { backgroundColor: 'transparent', fontSize: 15, paddingHorizontal: 0, height: 40 },
    strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -spacing.xs, marginBottom: spacing.md },
    strengthBar: { flex: 1, height: 3, borderRadius: 2 },
    strengthLabel: { fontSize: 11, marginLeft: spacing.xs, minWidth: 80 },
    errorBox: { borderRadius: radius.sm, borderLeftWidth: 3, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
    errorText: { fontSize: 13 },
    button: {
      paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center',
      minHeight: buttonMinHeight, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    buttonText: { ...type.bodyStrong, fontSize: buttonFontSize, letterSpacing: 1.5, textTransform: 'uppercase' },
    terms: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: spacing.xs },
    termsLink: { fontWeight: '600' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xs, paddingBottom: spacing.sm },
    footerText: { fontSize: 14 },
    footerLink: { fontSize: 14, fontWeight: '600' },
  });
}
