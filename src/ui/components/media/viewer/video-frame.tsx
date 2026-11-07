import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { resolveDeviceAsset } from '@/functionality';

import { boxFor, mediaSize } from './geometry';
import { verticalGestures } from './gestures';
import { viewerStyles } from './styles';
import type { Box, ViewerPhoto } from './types';

export function VideoFrame({
  photo,
  width,
  height,
  dragY,
  lift,
  info,
  onInfo,
  onDismiss,
}: {
  photo: ViewerPhoto;
  width: number;
  height: number;
  dragY: SharedValue<number>;
  lift: SharedValue<number>;
  info: boolean;
  onInfo: (value: boolean) => void;
  onDismiss: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const videoBox = boxFor(mediaSize(photo), width, height);

  useEffect(() => {
    if (!photo.assetId) return;
    let live = true;
    resolveDeviceAsset(photo.assetId).then(
      (local) => {
        if (live) setUri(local.uri);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [photo.assetId]);

  const { openInfo, closeInfo, dismiss } = verticalGestures({
    height,
    info,
    zoomed: false,
    lift,
    dragY,
    onInfo,
    onDismiss,
  });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: 1 - Math.min(Math.abs(dragY.value) / 2000, 0.15) },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(openInfo, closeInfo, dismiss)}>
      <Animated.View style={[viewerStyles.page, style]}>
        {uri ? (
          <Video uri={uri} box={videoBox} />
        ) : photo.source ? (
          <Image
            source={photo.source}
            style={videoBox}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={videoBox} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

function Video({ uri, box }: { uri: string; box: Box }) {
  const player = useVideoPlayer(uri, (entry) => {
    entry.loop = false;
  });
  return <VideoView player={player} style={box} contentFit="contain" nativeControls />;
}
