import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/AppThemeContext';

// Small wrapper that picks the right color from the theme for tab bar
// icons. Centralizes the color logic so the custom tabBar can stay tiny.
export default function TabIcon({ name, color, size = 24, focused }) {
  const { theme } = useAppTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color || (focused ? theme.tabBarActive : theme.tabBarInactive)}
    />
  );
}
