import { Play } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Image } from '@/ui/kit/image';
import { useTheme } from '@/ui/theme';

import { clamp, mediaSize } from './viewer/geometry';
import type { ViewerPhoto } from './viewer/types';

const HEIGHT = 34;
const MIN_WIDTH = 19;
const MAX_WIDTH = 37;
const GROW = 6;
const GAP = 6;
const PUSH = 10;
const STRIP_HEIGHT = 48;
const SIDE_RADIUS = 4;
const FOCUS_RADIUS = 6;
const SHARE = 0.9;
const FADE = 40;
const WINDOW = 14;

/** Дробный индекс кадра под точкой прокрутки. */
function progressAt(x: number, offsets: number[]): number {
  'worklet';
  const last = offsets.length - 1;
  if (last < 0) return 0;
  if (x <= offsets[0]) return 0;
  if (x >= offsets[last]) return last;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= x) lo = mid;
    else hi = mid;
  }
  const span = offsets[hi] - offsets[lo];
  return span > 0 ? lo + (x - offsets[lo]) / span : lo;
}

function offsetAt(progress: number, offsets: number[]): number {
  'worklet';
  const last = offsets.length - 1;
  if (last < 0) return 0;
  const p = Math.min(Math.max(progress, 0), last);
  const at = Math.floor(p);
  if (at >= last) return offsets[last];
  return offsets[at] + (offsets[at + 1] - offsets[at]) * (p - at);
}

type ItemProps = {
  index: number;
  photo: ViewerPhoto;
  left: number;
  width: number;
  offsets: number[];
  inset: number;
  viewWidth: number;
  scrollX: SharedValue<number>;
  onSelect: (index: number) => void;
};

function StripItem({
  index,
  photo,
  left,
  width,
  offsets,
  inset,
  viewWidth,
  scrollX,
  onSelect,
}: ItemProps) {
  const { color } = useTheme();
  const style = useAnimatedStyle(() => {
    const progress = progressAt(scrollX.value, offsets);
    const d = index - progress;
    const near = Math.min(1, Math.abs(d));
    const bonus = GROW * (1 - near);
    const push = PUSH * Math.max(0, 1 - Math.abs(Math.abs(d) - 1));
    const centre = inset + left + width / 2 - scrollX.value;
    const edge = Math.min(centre - inset, inset + viewWidth - centre);
    return {
      left: left - bonus / 2 + Math.sign(d) * push,
      width: width + bonus,
      borderRadius: SIDE_RADIUS + (FOCUS_RADIUS - SIDE_RADIUS) * (1 - near),
      opacity: clamp(edge / FADE, 0, 1),
    };
  });

  return (
    <Animated.View style={[styles.item, style]}>
      <Pressable onPress={() => onSelect(index)} style={styles.press}>
        <View style={[styles.layer, { width: width + GROW }]}>
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
  mainX: SharedValue<number>;
  active: SharedValue<number>;
  onDrive: (driving: boolean) => void;
  onSettle: (index: number) => void;
};

export function PhotoStrip({
  photos,
  index,
  scroller,
  main,
  mainX,
  active,
  onDrive,
  onSettle,
}: Props) {
  const { width: screen } = useWindowDimensions();
  const viewWidth = screen * SHARE;
  const inset = (screen - viewWidth) / 2;
  const count = photos.length;

  const layout = useMemo(() => {
    const widths = photos.map((photo) => {
      const size = mediaSize(photo);
      const aspect = size ? size.width / size.height : 1;
      return clamp(HEIGHT * aspect, MIN_WIDTH, MAX_WIDTH);
    });
    const lefts: number[] = [];
    let cursor = 0;
    for (const width of widths) {
      lefts.push(cursor);
      cursor += width + GAP;
    }
    const pad = (viewWidth - MIN_WIDTH) / 2;
    const offsets = widths.map((width, at) => pad + lefts[at] + width / 2 - viewWidth / 2);
    const last = widths.length - 1;
    return {
      widths,
      lefts,
      offsets,
      pad,
      content: pad * 2 + (last >= 0 ? lefts[last] + widths[last] : 0),
    };
  }, [photos, viewWidth]);

  const { widths, lefts, offsets, pad, content } = layout;
  const scrollX = useSharedValue(offsets[index] ?? 0);
  const [center, setCenter] = useState(index);
  const initialOffset = useRef({ x: offsets[index] ?? 0, y: 0 });
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      if (active.value === 1) {
        scrollTo(main, progressAt(event.contentOffset.x, offsets) * screen, 0, false);
      }
    },
  });

  // большой кадр листают — лента едет за ним
  useAnimatedReaction(
    () => mainX.value / screen,
    (progress) => {
      if (active.value === 1) return;
      const x = offsetAt(progress, offsets);
      scrollX.value = x;
      scrollTo(scroller, x, 0, false);
    },
  );

  useAnimatedReaction(
    () => Math.round(progressAt(scrollX.value, offsets)),
    (next) => {
      scheduleOnRN(setCenter, next);
    },
  );

  const stop = () => {
    const settled = clamp(Math.round(progressAt(scrollX.value, offsets)), 0, count - 1);
    setCenter(settled);
    onSettle(settled);
    active.value = 0;
    onDrive(false);
  };

  useEffect(() => {
    scrollTo(scroller, offsets[index] ?? 0, 0, false);
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const select = (next: number) => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    active.value = 1;
    onDrive(true);
    setCenter(next);
    scrollTo(scroller, offsets[next] ?? 0, 0, true);
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
          left={pad + lefts[at]}
          width={widths[at]}
          offsets={offsets}
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
      snapToOffsets={offsets}
      style={[styles.scroll, { width: viewWidth, alignSelf: 'center' }]}
      contentOffset={initialOffset.current}
      onScrollBeginDrag={() => {
        if (tapTimer.current) clearTimeout(tapTimer.current);
        active.value = 1;
        onDrive(true);
      }}
      onMomentumScrollEnd={stop}
    >
      <View style={{ width: content, height: STRIP_HEIGHT }}>{items}</View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    height: STRIP_HEIGHT,
  },
  item: {
    position: 'absolute',
    top: (STRIP_HEIGHT - HEIGHT) / 2,
    height: HEIGHT,
    overflow: 'hidden',
  },
  press: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    height: HEIGHT,
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
