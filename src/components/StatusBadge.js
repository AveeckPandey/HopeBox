import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/AppThemeContext';
import { radius, spacing, type } from '../theme/tokens';
import { statusTone } from '../theme/StatusContext';

// Colored pill that conveys a box's status with both an icon and color
// (so it's not color-only, addressing the accessibility gap).
export default function StatusBadge({ status, size = 'md', style }) {
  const { theme } = useAppTheme();
  const tone = statusTone(status, theme);
  const styles = createStyles(theme);

  const sizing = size === 'sm' ? styles.sm : styles.md;

  return (
    <View
      style={[
        styles.badge,
        sizing,
        { borderColor: tone.resolvedColor },
        style,
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status: ${tone.label}`}
    >
      <MaterialCommunityIcons
        name={tone.icon}
        size={size === 'sm' ? 12 : 14}
        color={tone.resolvedColor}
      />
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: tone.resolvedColor }]}>
        {tone.label}
      </Text>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.surfaceRaised,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    sm: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
    md: { paddingHorizontal: spacing.md, paddingVertical: 6 },
    label: { ...type.caption, fontWeight: '700' },
    labelSm: { fontSize: 11 },
  });
}
