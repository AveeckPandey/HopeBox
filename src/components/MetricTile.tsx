import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/AppThemeContext';
import { radius, spacing, type } from '../theme/tokens';

// A small labelled-value tile used across Dashboard, BoxDetails,
// Analytics, PrintQR, etc. Replaces ~15 duplicate `metricTile` style
// definitions. `tone` controls the value color (default | primary |
// success | danger | warning) and `unit` is an optional suffix string
// shown in muted color.
export default function MetricTile({
  label,
  value,
  unit,
  tone = 'default',
  style,
  numberOfLines = 1,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
}) {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const valueColor =
    tone === 'primary' ? theme.primary :
    tone === 'success' ? theme.success :
    tone === 'danger'  ? theme.danger  :
    tone === 'warning' ? theme.warning :
    theme.text;

  return (
    <View
      style={[styles.tile, style]}
      accessible
      accessibilityLabel={unit ? `${label}: ${value} ${unit}` : `${label}: ${value}`}
    >
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <View style={styles.valueRow}>
        <Text
          style={[styles.value, { color: valueColor }]}
          numberOfLines={numberOfLines}
        >
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    tile: {
      minWidth: '30%',
      flexGrow: 1,
      backgroundColor: theme.surfaceRaised,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
    },
    label: {
      ...type.caption,
      color: theme.muted,
      marginBottom: spacing.xs,
    },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' },
    value: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    unit: {
      ...type.caption,
      color: theme.muted,
    },
  });
}
