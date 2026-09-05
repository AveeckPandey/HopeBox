// P33: Recipient capture at dispatch. The modal appears between
// the user's "Dispatch" tap and the destructive confirmation
// dialog, so the recipient is captured *before* inventory is
// decremented. Both fields are optional — a user can skip
// capture and still dispatch the box; donor reports will then
// show "unknown recipient" for that row, which the ECHO/USAID
// writers already handle gracefully.
//
// The modal is uncontrolled internally: the parent passes the
// current `defaultName` / `defaultContact` and the modal owns
// its own draft state until "Continue" is tapped. The parent's
// onConfirm receives the trimmed values.

import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '../theme/AppThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSimpleMode } from '../contexts/SimpleModeContext';
import { layout, radius, spacing, type } from '../theme/tokens';

import SurfaceCard from './SurfaceCard';
import ThemedTextInput from './ThemedTextInput';

export type RecipientValue = {
  name: string;
  contact: string;
};

type Props = {
  visible: boolean;
  defaultName?: string;
  defaultContact?: string;
  onCancel: () => void;
  onConfirm: (value: RecipientValue) => void;
};

export default function RecipientModal({
  visible,
  defaultName = '',
  defaultContact = '',
  onCancel,
  onConfirm,
}: Props) {
  const { theme } = useAppTheme();
  const { t: tAll } = useLanguage();
  const { scale } = useSimpleMode();
  const t = tAll('boxDetails');
  const [name, setName] = useState(defaultName);
  const [contact, setContact] = useState(defaultContact);
  // Track the last `visible` value we acted on so we only reset the
  // draft on the *transition* from hidden to shown, not on every
  // re-render while the modal is open (which would clobber what
  // the user is currently typing). The previous implementation
  // compared the defaults instead, which left stale draft text on
  // the screen when a modal was cancelled and reopened with the
  // same defaults.
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      setName(defaultName);
      setContact(defaultContact);
    }
    wasVisible.current = visible;
  }, [visible, defaultName, defaultContact]);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onConfirm({
      name: name.trim(),
      contact: contact.trim(),
    });
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onConfirm({ name: '', contact: '' });
  };

  // The button heights scale with simple mode for low-literacy users.
  const buttonMinHeight = Math.round(52 * scale);
  const inputMinHeight = Math.round(48 * scale);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        {/* Stop the tap from bubbling to the backdrop when the user
            taps inside the card. */}
        <Pressable onPress={() => undefined} style={styles.sheetWrap}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          >
            <SurfaceCard style={[styles.sheet, { backgroundColor: theme.surface }]}>
              <View style={styles.handle}>
                <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
              </View>

              <View style={styles.headerRow}>
                <MaterialCommunityIcons
                  name="account-heart-outline"
                  size={24}
                  color={theme.primary}
                />
                <Text style={[styles.title, { color: theme.text }]}>{t.recipientTitle}</Text>
              </View>
              <Text style={[styles.helper, { color: theme.muted }]}>{t.recipientHelper}</Text>

              <ThemedTextInput
                label={t.recipientName}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                accessibilityLabel={t.recipientName}
                minHeight={inputMinHeight}
              />
              <ThemedTextInput
                label={t.recipientContact}
                value={contact}
                onChangeText={setContact}
                keyboardType="phone-pad"
                autoCapitalize="none"
                accessibilityLabel={t.recipientContact}
                minHeight={inputMinHeight}
              />

              <View style={styles.actions}>
                <Pressable
                  onPress={handleSkip}
                  accessibilityRole="button"
                  accessibilityLabel={t.recipientSkip}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    {
                      borderColor: theme.border,
                      minHeight: buttonMinHeight,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                    {t.recipientSkip}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleContinue}
                  accessibilityRole="button"
                  accessibilityLabel={t.recipientDispatch}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: theme.primary,
                      minHeight: buttonMinHeight,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="truck-fast-outline"
                    size={18}
                    color={theme.primaryText}
                  />
                  <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                    {t.recipientDispatch}
                  </Text>
                </Pressable>
              </View>
            </SurfaceCard>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  handle: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  title: {
    ...type.subtitle,
    flex: 1,
  },
  helper: {
    ...type.body,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  secondaryBtnText: {
    ...type.bodyStrong,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  primaryBtnText: {
    ...type.bodyStrong,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});
