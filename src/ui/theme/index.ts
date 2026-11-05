import { useColorScheme } from 'react-native';

import { type Theme, themes } from './colors';

export * from './colors';
export * from './tokens';

export function useTheme(): Theme {
  return themes[useColorScheme() === 'light' ? 'light' : 'dark'];
}
