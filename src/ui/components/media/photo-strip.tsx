import { Image } from 'expo-image';
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

import { useTheme } from '@/ui/theme';

import type { ViewerPhoto } from './photo-viewer';

const SELECTED = 48;
const UNSELECTED = 30;
const GAP = 3;
const PADDING = 10;
const BREADTH = 48;
export const STRIP_HEIGHT = 82;
export const STRIP_PITCH = UNSELECTED + GAP;
const WINDOW = 14;

const clamp = (value: number, low: number, high: number) => {
  'worklet';
  return Math.min(Math.max(value, low), high);
};

type ItemProps = {
  index: number;
  photo: ViewerPhoto;
  lead: number;
  count: number;
  scrollX: SharedValue<number>;
  onSelect: (index: number) => void;
};

function StripItem({ index, photo, lead, count, scrollX, onSelect }: ItemProps) {
  const { color } = useTheme();
  const style = useAnimatedStyle(() => {
    const progress = clamp(scrollX.value / STRIP_PITCH, 0, count - 1);
    const length =
      UNSELECTED + (SELECTED - UNSELECTED) * Math.max(0, 1 - Math.abs(index - progress));
    const base = Math.floor(progress);
    let delta = 0;
    for (let j = base - 1; j <= base + 2; j += 1) {
      if (j >= 0 && j < index) {
        delta += (SELECTED - UNSELECTED) * Math.max(0, 1 - Math.abs(j - progress));
        delta += PADDING * Math.max(0, 1 - Math.abs(j + 0.5 - progress));
      }
    }
    return { left: lead + index * STRIP_PITCH + delta, width: length };
  });

  return (
    <Animated.View style={[styles.item, style]}>
      <Pressable onPress={() => onSelect(index)} style={styles.fill}>
        {photo.source ? (
          <Image
            source={photo.source}
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
  const lead = (width - SELECTED) / 2;
  const [center, setCenter] = useState(index);
  const initialOffset = useRef({ x: index * STRIP_PITCH, y: 0 });
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    scrollTo(scroller, index * STRIP_PITCH, 0, false);
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (snapTimer.current) clearTimeout(snapTimer.current);
    };
  }, []);

  const snap = () => {
    const settled = clamp(Math.round(scrollX.value / STRIP_PITCH), 0, count - 1);
    setCenter(settled);
    onSettle(settled);
    scrollTo(scroller, settled * STRIP_PITCH, 0, true);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      active.value = 0;
      onDrive(false);
    }, 260);
  };

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
          count={count}
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
      decelerationRate="fast"
      style={styles.scroll}
      contentOffset={initialOffset.current}
      onScrollBeginDrag={() => {
        if (tapTimer.current) clearTimeout(tapTimer.current);
        if (snapTimer.current) clearTimeout(snapTimer.current);
        active.value = 1;
        onDrive(true);
      }}
      onScrollEndDrag={() => {
        if (snapTimer.current) clearTimeout(snapTimer.current);
        snapTimer.current = setTimeout(snap, 120);
      }}
      onMomentumScrollBegin={() => {
        if (snapTimer.current) clearTimeout(snapTimer.current);
      }}
      onMomentumScrollEnd={() => {
        if (snapTimer.current) clearTimeout(snapTimer.current);
        snap();
      }}
    >
      <View
        style={{
          width: 2 * lead + SELECTED + (count - 1) * STRIP_PITCH + PADDING,
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
