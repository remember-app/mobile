import { Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  type AnimatedRef,
  type SharedValue,
  scrollTo,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Image } from '@/ui/kit/image';
import { useTheme } from '@/ui/theme';

import { clamp } from './viewer/geometry';
import type { ViewerPhoto } from './viewer/types';

const SELECTED = 40;
const UNSELECTED = 26;
const GAP = 8;
const BREADTH = 40;
const STRIP_HEIGHT = 68;
const GROW = SELECTED / UNSELECTED;
export const STRIP_PITCH = UNSELECTED + GAP;
const WINDOW = 14;

type ItemProps = {
  index: number;
  photo: ViewerPhoto;
  lead: number;
  scrollX: SharedValue<number>;
  onSelect: (index: number) => void;
};

function StripItem({ index, photo, lead, scrollX, onSelect }: ItemProps) {
  const { color } = useTheme();
  const style = useAnimatedStyle(() => {
    const focus = scrollX.value / STRIP_PITCH;
    const distance = Math.min(1, Math.abs(index - focus));
    return { transform: [{ scaleX: 1 + (GROW - 1) * (1 - distance) }] };
  });

  return (
    <Animated.View style={[styles.item, { left: lead + index * STRIP_PITCH }, style]}>
      <Pressable onPress={() => onSelect(index)} style={styles.fill}>
        {photo.source ? (
          <Image
            source={photo.source}
            group={photo.projectId}
            style={styles.fill}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={photo.id}
          />
        ) : (
          <View style={[styles.fill, { backgroundColor: color.raise }]} />
        )}
        {photo.video ? (
          <View style={styles.play} pointerEvents="none">
            <Play size={10} color="#ffffff" fill="#ffffff" />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

type Props = {
  photos: readonly ViewerPhoto[];
  index: number;
  scroller: AnimatedRef<ScrollViewInstance>;
  main: AnimatedRef<ScrollViewInstance>;
  active: SharedValue<number>;
  scrollX: SharedValue<number>;
  onDrive: (driving: boolean) => void;
  onSettle: (index: number) => void;
};

export function PhotoStrip({
  photos,
  index,
  scroller,
  main,
  active,
  scrollX,
  onDrive,
  onSettle,
}: Props) {
  const { width } = useWindowDimensions();
  const count = photos.length;
  const lead = (width - UNSELECTED) / 2;
  const [center, setCenter] = useState(index);
  const initialOffset = useRef({ x: index * STRIP_PITCH, y: 0 });
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      if (active.value === 1) {
        scrollTo(main, (event.contentOffset.x / STRIP_PITCH) * width, 0, false);
      }
    },
  });

  useAnimatedReaction(
    () => clamp(Math.round(scrollX.value / STRIP_PITCH), 0, count - 1),
    (next) => {
      scheduleOnRN(setCenter, next);
    },
  );

  const settledIndex = () => clamp(Math.round(scrollX.value / STRIP_PITCH), 0, count - 1);

  const stop = () => {
    const settled = settledIndex();
    setCenter(settled);
    onSettle(settled);
    active.value = 0;
    onDrive(false);
  };

  useEffect(() => {
    scrollTo(scroller, index * STRIP_PITCH, 0, false);
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const select = (next: number) => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    active.value = 1;
    onDrive(true);
    setCenter(next);
    scrollTo(scroller, next * STRIP_PITCH, 0, true);
    onSettle(next);
    tapTimer.current = setTimeout(() => {
      active.value = 0;
      onDrive(false);
    }, 400);
  };

  const from = Math.max(0, center - WINDOW);
  const to = Math.min(count - 1, center + WINDOW);
  const items = [];
  for (let at = from; at <= to; at += 1) {
    const photo = photos[at];
    if (photo) {
      items.push(
        <StripItem
          key={photo.id}
          index={at}
          photo={photo}
          lead={lead}
          scrollX={scrollX}
          onSelect={select}
        />,
      );
    }
  }

  return (
    <Animated.ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      snapToInterval={STRIP_PITCH}
      style={styles.scroll}
      contentOffset={initialOffset.current}
      onScrollBeginDrag={() => {
        if (tapTimer.current) clearTimeout(tapTimer.current);
        active.value = 1;
        onDrive(true);
      }}
      onMomentumScrollEnd={stop}
    >
      <View
        style={{
          width: 2 * lead + (count - 1) * STRIP_PITCH + UNSELECTED,
          height: STRIP_HEIGHT,
        }}
      >
        {items}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    height: STRIP_HEIGHT,
  },
  item: {
    position: 'absolute',
    top: (STRIP_HEIGHT - BREADTH) / 2,
    width: UNSELECTED,
    height: BREADTH,
    borderRadius: 7,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  play: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
