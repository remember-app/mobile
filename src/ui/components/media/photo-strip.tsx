import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  type AnimatedRef,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Image } from '@/ui/kit/primitives/image';
import { useTheme } from '@/ui/theme';

import { clamp } from './viewer/geometry';
import { STRIP_BREADTH, type ViewerLayout } from './viewer/layout';
import type { ViewerPhoto } from './viewer/types';

const SELECTED = 40;
const UNSELECTED = 30;
const GAP = 12;
const RADIUS = 4;
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
    const width = UNSELECTED + (SELECTED - UNSELECTED) * (1 - distance);
    return {
      left: lead + index * STRIP_PITCH - (width - UNSELECTED) / 2,
      width,
    };
  });

  return (
    <Animated.View style={[styles.item, style]}>
      <Pressable onPress={() => onSelect(index)} style={styles.press}>
        <View style={styles.reveal}>
          {(photo.thumb ?? photo.source) ? (
            <Image
              source={photo.thumb ?? photo.source}
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
      </Pressable>
    </Animated.View>
  );
}

type Props = {
  photos: readonly ViewerPhoto[];
  index: number;
  layout: ViewerLayout;
  scroller: AnimatedRef<ScrollViewInstance>;
  active: SharedValue<number>;
  scrollX: SharedValue<number>;
  onScrolling: (value: boolean) => void;
  onSettle: (index: number) => void;
};

export function PhotoStrip({
  photos,
  index,
  layout,
  scroller,
  active,
  scrollX,
  onScrolling,
  onSettle,
}: Props) {
  const viewWidth = layout.stripWidth;
  const count = photos.length;
  const lead = (viewWidth - UNSELECTED) / 2;
  const [center, setCenter] = useState(index);
  const initialOffset = useRef({ x: index * STRIP_PITCH, y: 0 });
  const dragging = useRef(false);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  // Лента ведёт экран по кадрам, а не тянет его полотном: кадр меняется, только
  // когда лента проходит середину очередной миниатюры.
  useAnimatedReaction(
    () => clamp(Math.round(scrollX.value / STRIP_PITCH), 0, count - 1),
    (next) => {
      scheduleOnRN(setCenter, next);
      if (active.value === 1) scheduleOnRN(onSettle, next);
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
    onScrolling(false);
    active.value = 0;
  };

  useEffect(() => {
    scroller.current?.scrollTo({ x: index * STRIP_PITCH, y: 0, animated: false });
  }, []);

  const select = (next: number) => {
    active.value = 0;
    setCenter(next);
    scroller.current?.scrollTo({ x: next * STRIP_PITCH, y: 0, animated: true });
    onScrolling(false);
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
      style={{
        width: viewWidth,
        height: layout.stripHitHeight,
        alignSelf: 'center',
        overflow: 'hidden',
      }}
      contentOffset={initialOffset.current}
      onScrollBeginDrag={() => {
        dragging.current = true;
        active.value = 1;
        onScrolling(true);
      }}
      onMomentumScrollEnd={stop}
    >
      <View style={{ width: viewWidth + (count - 1) * STRIP_PITCH, height: layout.stripHitHeight }}>
        {items}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  item: {
    position: 'absolute',
    top: 0,
    height: STRIP_BREADTH,
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
    height: STRIP_BREADTH,
  },
  fill: {
    flex: 1,
  },
});
