import { Image, type ImageSource } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PhotoTile } from './photo-tile';

export type Photo = {
  id: string;
  source: ImageSource | null;
};

type Props = {
  photos: readonly Photo[];
  columns: number;
  onColumns: (columns: number) => void;
  onOpen: (index: number) => void;
};

const LEVELS = [1, 3, 5, 7];
const LAST = LEVELS.length - 1;
const GAP = 2;
const SENSITIVITY = 1.35;
const SETTLE = 320;

const clamp = (value: number, low: number, high: number) => {
  'worklet';
  return Math.min(Math.max(value, low), high);
};

const smooth = (t: number) => {
  'worklet';
  return t * t * (3 - 2 * t);
};

type Anchor = {
  index: number;
  u: number;
  v: number;
  startY: number;
  pads: number[];
  sizes: number[];
  pos: { x: number; y: number }[];
};

type PlaneItem = {
  key: string;
  x: number;
  y: number;
  size: number;
  source: ImageSource | null;
};

function planeItems(
  photos: readonly Photo[],
  level: number,
  anchor: Anchor,
  width: number,
  height: number,
  factor: number,
): PlaneItem[] {
  const columns = LEVELS[level] ?? 1;
  const pitch = width / columns;
  const size = pitch - GAP;
  const shift = anchor.pads[level] ?? 0;
  const row = Math.floor((anchor.index + shift) / columns);
  const above = Math.ceil((anchor.startY * factor) / pitch) + 1;
  const below = Math.ceil(((height - anchor.startY) * factor) / pitch) + 1;
  const items: PlaneItem[] = [];
  for (let r = Math.max(0, row - above); r <= row + below; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const index = r * columns + c - shift;
      if (index < 0 || index >= photos.length || index === anchor.index) continue;
      items.push({
        key: `${level}-${index}`,
        x: c * pitch,
        y: r * pitch,
        size,
        source: photos[index]?.source ?? null,
      });
    }
  }
  return items;
}

type PlaneProps = {
  items: readonly PlaneItem[];
  level: number;
  anchor: Anchor;
  from: number;
  to: number;
  zoom: SharedValue<number>;
  pointX: SharedValue<number>;
  pointY: SharedValue<number>;
};

function Plane({ items, level, anchor, from, to, zoom, pointX, pointY }: PlaneProps) {
  const style = useAnimatedStyle(() => {
    const t = from === to ? 0 : clamp(zoom.value - from, 0, 1);
    const size = anchor.sizes[from] + (anchor.sizes[to] - anchor.sizes[from]) * t;
    const scale = size / anchor.sizes[level];
    const x = pointX.value - anchor.u * size;
    const y = pointY.value - anchor.v * size;
    const corner = anchor.pos[level];
    return {
      opacity: from !== to && level === from ? 1 - smooth(t) : 1,
      transform: [
        { translateX: x - corner.x * scale },
        { translateY: y - corner.y * scale },
        { scale },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.plane, style]}>
      {items.map((item) => (
        <View
          key={item.key}
          style={{
            position: 'absolute',
            left: item.x,
            top: item.y,
            width: item.size,
            height: item.size,
          }}
        >
          {item.source ? (
            <Image
              source={item.source}
              style={styles.fill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : null}
        </View>
      ))}
    </Animated.View>
  );
}

type AnchorProps = {
  photos: readonly Photo[];
  anchor: Anchor;
  from: number;
  to: number;
  zoom: SharedValue<number>;
  pointX: SharedValue<number>;
  pointY: SharedValue<number>;
};

function AnchorPhoto({ photos, anchor, from, to, zoom, pointX, pointY }: AnchorProps) {
  const style = useAnimatedStyle(() => {
    const t = from === to ? 0 : clamp(zoom.value - from, 0, 1);
    const size = anchor.sizes[from] + (anchor.sizes[to] - anchor.sizes[from]) * t;
    return {
      left: pointX.value - anchor.u * size,
      top: pointY.value - anchor.v * size,
      width: size,
      height: size,
    };
  });
  const source = photos[anchor.index]?.source ?? null;

  return (
    <Animated.View pointerEvents="none" style={[styles.anchor, style]}>
      {source ? (
        <Image source={source} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" />
      ) : null}
    </Animated.View>
  );
}

export function PhotoGrid({ photos, columns, onColumns, onOpen }: Props) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [pair, setPair] = useState(0);
  const [pinching, setPinching] = useState(false);
  const [commit, setCommit] = useState(0);
  const [pad, setPad] = useState(0);

  const scroller = useRef<ScrollViewInstance>(null);
  const pending = useRef<number | null>(null);
  const anchorRef = useRef<Anchor | null>(null);
  const applied = useRef(false);

  const scroll = useSharedValue(0);
  const zoom = useSharedValue(0);
  const startedAt = useSharedValue(0);
  const pointX = useSharedValue(0);
  const pointY = useSharedValue(0);
  const armed = useSharedValue(false);
  const settled = useSharedValue(false);
  const frozen = useSharedValue(false);

  const width = box.width;
  const height = box.height;
  const level = Math.max(0, LEVELS.indexOf(columns));
  const pitch = width > 0 ? width / columns : 0;

  const begin = useCallback(
    (index: number, u: number, v: number, from: number, startX: number, startY: number) => {
      if (width <= 0) return;
      const sizes = LEVELS.map((count) => width / count - GAP);
      const pads = LEVELS.map((count) => {
        if (count === 1) return 0;
        const p = width / count;
        const s = p - GAP;
        const column = clamp(Math.round((startX - u * s) / p), 0, count - 1);
        return (((column - (index % count)) % count) + count) % count;
      });
      const pos = LEVELS.map((count, levelIndex) => {
        const j = index + (pads[levelIndex] ?? 0);
        return {
          x: (j % count) * (width / count),
          y: Math.floor(j / count) * (width / count),
        };
      });
      const next = { index, u, v, startY, pads, sizes, pos };
      anchorRef.current = next;
      setAnchor(next);
      setPair(from);
      setPinching(true);
    },
    [width],
  );

  const centerOn = useCallback(
    (target: number) => {
      const current = anchorRef.current;
      if (!current) return;
      const count = LEVELS[target] ?? 1;
      const p = width / count;
      const size = p - GAP;
      const column = (current.index + (current.pads[target] ?? 0)) % count;
      pointX.value = withTiming(column * p + current.u * size, {
        duration: SETTLE,
        easing: Easing.out(Easing.cubic),
      });
    },
    [pointX, width],
  );

  const prepare = useCallback(
    (target: number) => {
      const current = anchorRef.current;
      if (!current) return;
      const count = LEVELS[target] ?? 1;
      const shift = current.pads[target] ?? 0;
      const size = width / count - GAP;
      const row = Math.floor((current.index + shift) / count);
      const rows = Math.ceil((photos.length + shift) / count);
      const content = rows * (width / count);
      const y = row * (width / count) + current.v * size - pointY.value;
      pending.current = Math.min(Math.max(y, 0), Math.max(0, content - height));
      const nextPad = y <= 0 ? 0 : shift;
      setTimeout(() => {
        setPad(nextPad);
        onColumns(count);
        setCommit((value) => value + 1);
      }, 80);
    },
    [height, onColumns, photos.length, pointY, width],
  );

  const land = useCallback(
    function settleLayer() {
      if (!applied.current) {
        requestAnimationFrame(settleLayer);
        return;
      }
      applied.current = false;
      frozen.value = false;
      setPinching(false);
    },
    [frozen],
  );

  useEffect(() => {
    if (commit === 0) return;
    const y = pending.current;
    if (y === null) return;
    pending.current = null;
    applied.current = false;
    requestAnimationFrame(() => {
      scroller.current?.scrollTo({ y, animated: false });
      scroll.value = y;
      applied.current = true;
    });
  }, [commit, scroll]);

  useAnimatedReaction(
    () => Math.floor(zoom.value),
    (next) => {
      if (frozen.value) return;
      scheduleOnRN(setPair, clamp(next, 0, LAST));
    },
  );

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      if (width <= 0 || photos.length === 0) return;
      const p = width / columns;
      const s = p - GAP;
      const col = clamp(Math.floor(event.focalX / p), 0, columns - 1);
      const row = Math.floor((event.focalY + scroll.value) / p);
      const index = clamp(row * columns + col, 0, photos.length - 1);
      pointX.value = event.focalX;
      pointY.value = event.focalY;
      startedAt.value = level;
      zoom.value = level;
      armed.value = true;
      settled.value = false;
      frozen.value = false;
      scheduleOnRN(
        begin,
        index,
        clamp((event.focalX - col * p) / s, 0, 1),
        clamp((event.focalY + scroll.value - row * p) / s, 0, 1),
        level,
        event.focalX,
        event.focalY,
      );
    })
    .onUpdate((event) => {
      pointX.value = event.focalX;
      pointY.value = event.focalY;
      zoom.value = clamp(startedAt.value - Math.log2(event.scale) * SENSITIVITY, 0, LAST);
    })
    .onEnd((event) => {
      if (!armed.value) return;
      settled.value = true;
      frozen.value = true;
      const delta = zoom.value - startedAt.value;
      const moved = Math.abs(Math.log2(event.scale)) > 0.04;
      let target = Math.round(zoom.value);
      if (!moved) target = startedAt.value;
      else if (delta > 0) target = Math.max(target, startedAt.value + 1);
      else if (delta < 0) target = Math.min(target, startedAt.value - 1);
      target = clamp(target, 0, LAST);
      scheduleOnRN(prepare, target);
      scheduleOnRN(centerOn, target);
      zoom.value = withTiming(
        target,
        { duration: SETTLE, easing: Easing.out(Easing.cubic) },
        (done) => {
          if (done) scheduleOnRN(land);
        },
      );
    })
    .onFinalize(() => {
      if (!armed.value) return;
      armed.value = false;
      if (!settled.value) {
        frozen.value = true;
        const target = clamp(Math.round(startedAt.value), 0, LAST);
        scheduleOnRN(prepare, target);
        scheduleOnRN(centerOn, target);
        zoom.value = withTiming(
          target,
          { duration: SETTLE, easing: Easing.out(Easing.cubic) },
          (done) => {
            if (done) scheduleOnRN(land);
          },
        );
      }
    });

  const next = Math.min(pair + 1, LAST);
  const shrink =
    next === pair ? 1 : (width / (LEVELS[pair] ?? 1) - GAP) / (width / (LEVELS[next] ?? 1) - GAP);
  const lowPlane = useMemo(
    () => (anchor ? planeItems(photos, pair, anchor, width, height, shrink) : []),
    [anchor, pair, photos, width, height, shrink],
  );
  const highPlane = useMemo(
    () => (anchor && next !== pair ? planeItems(photos, next, anchor, width, height, 1) : []),
    [anchor, next, pair, photos, width, height],
  );

  return (
    <GestureDetector gesture={pinch}>
      <View
        style={styles.root}
        onLayout={(event) =>
          setBox({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          })
        }
      >
        <ScrollView
          ref={scroller}
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            scroll.value = y;
            if (y <= 0) setPad((value) => (value === 0 ? value : 0));
          }}
          scrollEventThrottle={16}
          pointerEvents={pinching ? 'none' : 'auto'}
          style={pinching ? styles.hidden : undefined}
        >
          <View style={styles.grid}>
            {Array.from({ length: pad }, (_, index) => (
              <View key={`pad-${index}`} style={{ width: pitch, height: pitch }} />
            ))}
            {photos.map((photo, index) => (
              <View
                key={photo.id}
                style={{ width: pitch, height: pitch, paddingRight: GAP, paddingBottom: GAP }}
              >
                <PhotoTile id={photo.id} source={photo.source} onPress={() => onOpen(index)} />
              </View>
            ))}
          </View>
        </ScrollView>
        {pinching && anchor ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {next !== pair ? (
              <Plane
                key={`plane-${next}`}
                items={highPlane}
                level={next}
                anchor={anchor}
                from={pair}
                to={next}
                zoom={zoom}
                pointX={pointX}
                pointY={pointY}
              />
            ) : null}
            <Plane
              key={`plane-${pair}`}
              items={lowPlane}
              level={pair}
              anchor={anchor}
              from={pair}
              to={next}
              zoom={zoom}
              pointX={pointX}
              pointY={pointY}
            />
            <AnchorPhoto
              photos={photos}
              anchor={anchor}
              from={pair}
              to={next}
              zoom={zoom}
              pointX={pointX}
              pointY={pointY}
            />
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  hidden: {
    opacity: 0,
  },
  plane: {
    transformOrigin: 'top left',
  },
  anchor: {
    position: 'absolute',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});
