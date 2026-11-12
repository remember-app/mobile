import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/ui/theme';

const WALLPAPER = require('../../../assets/wallpaper/background.png');

export function Backdrop() {
  const { name } = useTheme();
  if (name !== 'dark') return null;
  return (
    <Image
      source={WALLPAPER}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      cachePolicy="memory"
      pointerEvents="none"
    />
  );
}
