import { Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
const UNSELECTED = 30;
const GAP = 12;
const BREADTH = 40;
export const STRIP_HEIGHT = 130;
const RADIUS = 4;
const SHARE = 0.8;
const FADE = 36;
export const STRIP_PITCH = UNSELECTED + GAP;
export const STRIP_SHARE = SHARE;
const WINDOW = 14;

type ItemProps = {
  index: number;
  photo: ViewerPhoto;
  lead: number;
  inset: number;
  viewWidth: number;
  scrollX: SharedValue<number>;
  onSelect: (index: number) => void;
};

function StripItem({ index, photo, lead, inset, viewWidth, scrollX, onSelect }: ItemProps) {
  const { color } = useTheme();
  const style = useAnimatedStyle(() => {
    const focus = scrollX.value / STRIP_PITCH;
    const distance = Math.min(1, Math.abs(index - focus));
    const width = UNSELECTED + (SELECTED - UNSELECTED) * (1 - distance);
    const centre = inset + lead + index * STRIP_PITCH + UNSELECTED / 2 - scrollX.value;
    const edge = Math.min(centre - inset, inset + viewWidth - centre);
    return {
      left: lead + index * STRIP_PITCH - (width - UNSELECTED) / 2,
      width,
      opacity: clamp(edge / FADE, 0, 1),
    };
  });

  return (
    <Animated.View style={[styles.item, style]}>
      <Pressable onPress={() => onSelect(index)} style={styles.press}>
        <View style={styles.reveal}>
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
        </View>
        {photo.video ? (
          <View style={styles.play} pointerEvents="none">
            <Play size={8} color="#ffffff" fill="#ffffff" />
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
  onSettle: (index: number) => void;
};

export function PhotoStrip({ photos, index, scroller, main, active, scrollX, onSettle }: Props) {
  const { width: screen } = useWindowDimensions();
  const viewWidth = screen * SHARE;
  const inset = (screen - viewWidth) / 2;
  const count = photos.length;
  const lead = (viewWidth - UNSELECTED) / 2;
  const [center, setCenter] = useState(index);
  const initialOffset = useRef({ x: index * STRIP_PITCH, y: 0 });
  const dragging = useRef(false);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      if (active.value === 1) {
        scrollTo(main, (event.contentOffset.x / STRIP_PITCH) * screen, 0, false);
      }
    },
  });

  useAnimatedReaction(
    () => clamp(Math.round(scrollX.value / STRIP_PITCH), 0, count - 1),
    (next) => {
      scheduleOnRN(setCenter, next);
    },
  );

  const stop = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const settled = clamp(
      Math.round(event.nativeEvent.contentOffset.x / STRIP_PITCH),
      0,
      count - 1,
    );
    setCenter(settled);
    onSettle(settled);
    active.value = 0;
  };

  useEffect(() => {
    scroller.current?.scrollTo({ x: index * STRIP_PITCH, y: 0, animated: false });
  }, []);

  const select = (next: number) => {
    active.value = 0;
    setCenter(next);
    scroller.current?.scrollTo({ x: next * STRIP_PITCH, y: 0, animated: true });
    onSettle(next);
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
          inset={inset}
          viewWidth={viewWidth}
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
      style={[styles.scroll, { width: viewWidth, alignSelf: 'center' }]}
      contentOffset={initialOffset.current}
      onScrollBeginDrag={() => {
        dragging.current = true;
        active.value = 1;
      }}
      onMomentumScrollEnd={stop}
    >
      <View style={{ width: viewWidth + (count - 1) * STRIP_PITCH, height: STRIP_HEIGHT }}>
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
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  press: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reveal: {
    width: SELECTED,
    height: BREADTH,
  },
  fill: {
    flex: 1,
  },
  play: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
