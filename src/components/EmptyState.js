import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/AppThemeContext';
import { radius, spacing, type } from '../theme/tokens';

// Friendly empty-state placeholder. Replaces bare "No logs yet" text
// and gives a clear CTA when one is relevant.
export default function EmptyState({
  icon = 'inbox-outline',
  title = 'Nothing here yet',
  message,
  actionLabel,
  onAction,
  style,
}) {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View
      style={[styles.wrap, style]}
      accessible
      accessibilityLabel={title + (message ? `. ${message}` : '')}
    >
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={icon} size={36} color={theme.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.xl,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      ...type.subtitle,
      color: theme.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    message: {
      ...type.body,
      color: theme.muted,
      textAlign: 'center',
      maxWidth: 320,
    },
    cta: {
      marginTop: spacing.xl,
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    ctaPressed: { opacity: 0.85 },
    ctaLabel: {
      ...type.bodyStrong,
      color: theme.primaryText,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
  });
}
