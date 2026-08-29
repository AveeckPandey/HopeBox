import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useAppTheme } from '../theme/AppThemeContext';
import { radius, spacing } from '../theme/tokens';

// Drop-in replacement for Paper's TextInput that bakes in our theme
// props. Eliminates the 5-line `theme={{ colors: {...} }}` block that
// was repeated 20+ times across AddBox/AdminInventory/Dashboard/etc.
const ThemedTextInput = forwardRef(function ThemedTextInput(
  {
    label,
    value,
    onChangeText,
    mode = 'outlined',
    error,
    helperText,
    style,
    contentStyle,
    right,
    left,
    ...rest
  },
  ref
) {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.wrap, style]}>
      <TextInput
        ref={ref}
        mode={mode}
        label={label}
        value={value}
        onChangeText={onChangeText}
        error={!!error}
        outlineColor={theme.border}
        activeOutlineColor={theme.primary}
        textColor={theme.text}
        placeholderTextColor={theme.muted}
        right={right}
        left={left}
        style={styles.input}
        contentStyle={contentStyle}
        theme={{
          colors: {
            background: theme.surfaceRaised,
            primary: theme.primary,
            outline: theme.border,
            error: theme.danger,
            onSurfaceVariant: theme.muted,
            placeholder: theme.muted,
            text: theme.text,
          },
        }}
        {...rest}
      />
      {helperText ? (
        <Text
          style={[
            styles.helper,
            { color: error ? theme.danger : theme.muted },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});

function createStyles(theme) {
  return StyleSheet.create({
    wrap: { marginBottom: spacing.md },
    input: {
      backgroundColor: theme.surfaceRaised,
      borderRadius: radius.md,
    },
    helper: {
      fontSize: 12,
      marginTop: 4,
      paddingHorizontal: spacing.xs,
    },
  });
}

export default ThemedTextInput;
