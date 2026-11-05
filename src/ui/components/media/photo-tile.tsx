import { Image, type ImageSource } from 'expo-image';
import { Pressable, View } from 'react-native';

import { radius, useTheme } from '@/ui/theme';

type Props = {
  id: string;
  source: ImageSource | null;
  onPress: () => void;
};

export function PhotoTile({ id, source, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, borderRadius: radius.tile, overflow: 'hidden' }}>
      {source ? (
        <Image
          source={source}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={id}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.color.raise }} />
      )}
    </Pressable>
  );
}
