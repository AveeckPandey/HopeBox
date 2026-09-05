import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/AppThemeContext';
import { spacing, type } from '../theme/tokens';

export default function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  right,
  style,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.textWrap}>
        {eyebrow ? <EyebrowText style={styles.eyebrow}>{eyebrow}</EyebrowText> : null}
        {title ? <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

// Renders the eyebrow one word per line (e.g. "NGO CONTROL CENTER"
// -> 3 lines: NGO / CONTROL / CENTER). On narrow phones the words
// stay whole instead of breaking mid-letter, and on wide screens the
// extra height reads as deliberate emphasis.
function EyebrowText({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const words = String(children).split(/\s+/).filter(Boolean);
  if (words.length <= 1) return <Text style={style}>{children}</Text>;
  return (
    <Text style={style}>
      {words.map((word, i) => (
        <Text key={`${word}-${i}`}>{i > 0 ? '\n' : ''}{word}</Text>
      ))}
    </Text>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    // Use flexWrap so the right slot can fall below the text on narrow
    // screens instead of squeezing the title to a single-character column.
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      columnGap: spacing.md,
      rowGap: spacing.md,
      marginBottom: spacing.lg,
    },
    // Text block takes a full row when alone; shares the row with `right`
    // when there is room. `minWidth` ensures at least the whole text is
    // measured before deciding to wrap.
    textWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0 },
    right: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    eyebrow: {
      ...type.eyebrow,
      color: theme.primary,
      marginBottom: spacing.sm,
    },
    title: {
      ...type.display,
      color: theme.text,
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...type.body,
      color: theme.muted,
    },
  });
}
