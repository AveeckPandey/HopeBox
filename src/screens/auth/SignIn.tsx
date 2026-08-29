import { useState } from 'react';
import { useMemo } from 'react';
import {
  Keyboard,
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
import { signInWithEmailAndPassword } from 'firebase/auth';
import * as Haptics from 'expo-haptics';

import { auth } from '../../services/firebase';
import { logger } from '../../services/logger';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { snackbar } from '../../hooks/useSnackbar';

import AmbientGlow from '../../components/AmbientGlow';
import FadeInUp from '../../components/FadeInUp';
import { layout, radius, spacing, type } from '../../theme/tokens';

export default function SignIn({ navigation }) {
  const { theme } = useAppTheme();
  const { t: tAll, language } = useLanguage();
  const t = tAll('auth');
  const tApp = tAll('app');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  // The screen-level entrance is a single FadeInUp wrapper. The
  // prior implementation nested RN's `Animated.View` outside a
  // Reanimated `FadeInUp`, and on a cold start the worklet
  // runtime occasionally failed to deliver the animated value,
  // leaving the screen at `opacity: 0` for the lifetime of the
  // component. The fix lives in `FadeInUp.js` (useLayoutEffect
  // instead of useEffect) plus this ScrollView, which prevents
  // the content from being clipped on short viewports.
  // `language` is read so the component re-renders on locale change.
  void language;

  const validate = () => {
    if (!email.includes('@')) return t.errors.emailInvalid;
    if (password.length < 8) return t.errors.passwordShort;
    return null;
  };

  const handleSignIn = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const authPromise = signInWithEmailAndPassword(auth, email, password);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000)
      );
      await Promise.race([authPromise, timeoutPromise]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      snackbar.success(`Welcome back to ${tApp.name}`);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      logger.logError('auth/SignIn', err);
      if (err.message === 'timeout') setError(t.errors.timeout);
      else if (err.code === 'auth/user-not-found') setError(t.errors.noUser);
      else if (err.code === 'auth/wrong-password') setError(t.errors.wrongPassword);
      else if (err.code === 'auth/invalid-email') setError(t.errors.invalidEmail);
      else if (err.code === 'auth/too-many-requests') setError(t.errors.tooManyRequests);
      else setError(t.errors.invalidCredentials);
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AmbientGlow variant="top" opacity={0.8} />
      <AmbientGlow variant="bottom" opacity={0.6} />

      <Pressable
        // Tap-to-dismiss keyboard. P28: tapping outside an input on
        // the auth screen used to leave the keyboard up. The
        // ScrollView's `keyboardShouldPersistTaps="handled"` already
        // handles taps *on* tappable children, so this Pressable
        // only fires for background taps.
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
          <View style={styles.brandDiamond} />
        </View>

        <Text style={styles.heading}>{t.welcome}</Text>
        <Text style={styles.subheading}>{t.welcomeSub}</Text>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <View style={[styles.dividerDot, { backgroundColor: theme.primary }]} />
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>

        <FadeInUp delay={100}>
          <View style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused, { backgroundColor: theme.surfaceRaised, borderColor: focusedField === 'email' ? theme.primary : theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.primary }]}>{t.email}</Text>
            <RNTextInput
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel={t.email}
              style={[styles.input, { color: theme.text }]}
              placeholder={t.emailPlaceholder}
              placeholderTextColor={theme.muted}
            />
          </View>
        </FadeInUp>

        <FadeInUp delay={180}>
          <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused, { backgroundColor: theme.surfaceRaised, borderColor: focusedField === 'password' ? theme.primary : theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.primary }]}>{t.password}</Text>
            <RNTextInput
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              secureTextEntry
              accessibilityLabel={t.password}
              style={[styles.input, { color: theme.text }]}
              placeholder={t.passwordPlaceholder}
              placeholderTextColor={theme.muted}
            />
          </View>
        </FadeInUp>

        <Pressable
          onPress={() => navigation.navigate('ForgotPassword')}
          accessibilityRole="link"
          accessibilityLabel={t.forgotPassword}
          hitSlop={8}
          style={({ pressed }) => [styles.forgotWrap, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.forgotText, { color: theme.primary }]}>{t.forgotPassword}</Text>
        </Pressable>

        {error ? (
          <View
            style={[styles.errorBox, { backgroundColor: theme.dangerSoft, borderLeftColor: theme.danger }]}
            accessibilityLiveRegion="polite"
          >
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          </View>
        ) : null}

        <FadeInUp delay={260}>
          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t.signIn}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: loading ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={theme.primaryText} size={20} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.primaryText }]}>{t.signIn}</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.muted }]}>{t.noAccount} </Text>
            <Pressable
              onPress={() => navigation.navigate('SignUp')}
              accessibilityRole="button"
              accessibilityLabel={t.signUp}
            >
              <Text style={[styles.footerLink, { color: theme.primary }]}>{t.signUp}</Text>
            </Pressable>
          </View>
        </FadeInUp>
      </FadeInUp>
      </ScrollView>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    // P28: tap-anywhere-to-dismiss-keyboard layer. Sits between
    // KeyboardAvoidingView and the ScrollView. `accessible={false}`
    // so the screen reader doesn't see two layers.
    dismissLayer: { flex: 1 },
    // ScrollView contentContainerStyle. `flexGrow: 1` lets the
    // content fill the viewport on tall screens and scroll on
    // short ones (small phones with the keyboard open). The old
    // `KeyboardAvoidingView` with `justifyContent: 'center'`
    // clipped content above the fold when the content was taller
    // than the available space — combined with the FadeInUp
    // `translateY` start, the top half stayed off-screen.
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
    },
    forgotWrap: {
      alignSelf: 'flex-end',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      marginTop: -spacing.xs,
      marginBottom: spacing.md,
    },
    forgotText: { ...type.bodyStrong, fontSize: 13 },
    container: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: spacing.xl,
    },
    brandMark: { alignItems: 'flex-start', marginBottom: spacing.xl },
    brandDiamond: {
      width: 18, height: 18, backgroundColor: theme.primary,
      transform: [{ rotate: '45deg' }],
    },
    heading: {
      fontSize: 44, fontWeight: '700', color: theme.text, letterSpacing: -1, lineHeight: 50,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    subheading: { ...type.eyebrow, fontSize: 13, color: theme.muted, marginTop: spacing.sm, letterSpacing: 1.5 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl, gap: spacing.sm },
    dividerLine: { flex: 1, height: 1 },
    dividerDot: { width: 4, height: 4, borderRadius: 2 },
    inputWrapper: {
      borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm, paddingBottom: spacing.xs, marginBottom: spacing.md,
    },
    inputWrapperFocused: {},
    inputLabel: { ...type.eyebrow, fontSize: 10, marginBottom: 2 },
    input: { backgroundColor: 'transparent', fontSize: 15, paddingHorizontal: 0, height: 40 },
    errorBox: { borderRadius: radius.sm, borderLeftWidth: 3, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
    errorText: { fontSize: 13 },
    button: {
      paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center',
      minHeight: 52, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    buttonText: { ...type.bodyStrong, fontSize: 15, letterSpacing: 1.5, textTransform: 'uppercase' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md, paddingBottom: spacing.sm },
    footerText: { fontSize: 14 },
    footerLink: { fontSize: 14, fontWeight: '600' },
  });
}
