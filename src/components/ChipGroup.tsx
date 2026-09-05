import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/AppThemeContext';
import { radius, spacing, type } from '../theme/tokens';

// Horizontally-scrollable group of filter chips. Replaces the duplicated
// `filterRow` + Button blocks in Boxes.js, AddBox.js, and similar.
//
// Exported so call sites that build options from untyped data
// (e.g. `t.filterAll` from i18n, which is `any`) can cast to it
// at the boundary without losing shape on the call side.
export type ChipOption = { key: string; label: string };

export default function ChipGroup({
  options,         // [{ key, label }] OR string[]
  value,           // currently selected key
  onChange,        // (key) => void
  scrollable = true,
  style,
  accessibilityLabel,
}: {
  options: (ChipOption | string)[];
  value?: string;
  onChange?: (key: string) => void;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const normalized: ChipOption[] = options.map((o) =>
    typeof o === 'string' ? { key: o, label: o.charAt(0).toUpperCase() + o.slice(1) } : o
  );

  const renderChip = (opt: ChipOption) => {
    const selected = value === opt.key;
    return (
      <Pressable
        key={opt.key}
        onPress={() => onChange?.(opt.key)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={opt.label}
        style={({ pressed }) => [
          styles.chip,
          selected && styles.chipSelected,
          pressed && styles.chipPressed,
        ]}
      >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
          {opt.label}
        </Text>
      </Pressable>
    );
  };

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, style]}
      >
        {normalized.map(renderChip)}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.rowWrap, style]}>
      {normalized.map(renderChip)}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    row: { gap: spacing.sm, paddingVertical: 2 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceRaised,
      minHeight: 36,
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    chipPressed: { opacity: 0.75 },
    chipText: { ...type.caption, color: theme.text, fontWeight: '700' },
    chipTextSelected: { color: theme.primaryText },
  });
}
