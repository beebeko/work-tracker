import { useColorScheme } from 'react-native';
import { Colors, ColorToken } from './colors';
import { spacing, SpacingToken } from './spacing';
import { typography } from './typography';

export function useTheme() {
  const scheme = useColorScheme() ?? 'dark';
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  return {
    colors: Colors[colorScheme],
    spacing,
    typography,
    scheme: colorScheme,
  };
}

export { Colors, spacing, typography };
export type { ColorToken, SpacingToken };

