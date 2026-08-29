import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/AppThemeContext';
import { radius, spacing, type } from '../theme/tokens';
import { logger } from '../services/logger';

// React error boundary. Class component by necessity — only class
// components can catch render-phase errors in descendants. Wrap the
// root of any subtree whose failure shouldn't take down the entire
// app.
//
// Usage:
//   <ErrorBoundary>
//     <NavigationContainer>...</NavigationContainer>
//   </ErrorBoundary>
//
// The boundary re-mounts its children when the user taps "Reload",
// so a transient error (e.g. a failed fetch) doesn't permanently
// brick the screen.

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // P42: report uncaught errors to Sentry directly (not via
    // logger) so the boundary still reports when the logger
    // itself is in a broken state. Dynamic require keeps the
    // module optional in test/CI/web environments.
    try {
      const Sentry = require('@sentry/react-native');
      if (Sentry && typeof Sentry.captureException === 'function') {
        Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
      }
    } catch {
      // Sentry unavailable — fall through to local logger.
    }
    // Always log locally too — useful in dev, and the only
    // signal in environments where Sentry isn't installed.
    logger.logError('ErrorBoundary', error, { componentStack: info?.componentStack });
  }

  reload = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return <ErrorScreen error={this.state.error} onReload={this.reload} />;
  }
}

function ErrorScreen({ error, onReload }: { error: Error; onReload: () => void }) {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.root} accessible accessibilityLabel="Application error">
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.danger} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        The app hit an unexpected error. You can try reloading this screen.
      </Text>
      {error?.message ? (
        <View style={[styles.detail, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          <Text style={[styles.detailText, { color: theme.muted }]} numberOfLines={4}>
            {String(error.message)}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onReload}
        accessibilityRole="button"
        accessibilityLabel="Reload"
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.dangerSoft,
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
    detail: {
      marginTop: spacing.lg,
      borderRadius: radius.sm,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      maxWidth: 360,
      alignSelf: 'stretch',
    },
    detailText: {
      ...type.caption,
      fontFamily: 'monospace',
    },
    button: {
      marginTop: spacing.xl,
      backgroundColor: theme.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      minHeight: 48,
      justifyContent: 'center',
    },
    buttonText: {
      ...type.bodyStrong,
      color: theme.primaryText,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
  });
}
