import { Image } from 'expo-image';
import { Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { pictureKey } from '@/lib/picture-key';
import { photo, radius, themed } from '@/theme';
import { Icon } from './icon';
export type Frame = {
  uri: string;
  video?: boolean;
  cacheKey?: string;
};
const GAP = 2;
const ACTIVATE = [{ name: 'activate' }];
export type StripSize = {
  shot: number;
  shotTall: number;
  current: number;
  tall: number;
  foot: number;
};
export const STRIP_STANDING: StripSize = {
  shot: 30,
  shotTall: 44,
  current: 44,
  tall: 48,
  foot: 30,
};
export const STRIP_TURNED: StripSize = {
  shot: 26,
  shotTall: 36,
  current: 38,
  tall: 40,
  foot: 14,
};
export function Filmstrip({
  frames,
  index,
  size = STRIP_STANDING,
  onSettle,
  labelAt,
  style,
}: {
  frames: readonly Frame[];
  index: number;
  size?: StripSize;
  onSettle?: (at: number) => boolean;
  labelAt?: (at: number) => string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const strip = useRef<FlatList<Frame>>(null);
  const [viewport, setViewport] = useState(0);
  const walked = useRef(false);
  const settled = useRef(false);
  const lifted = useRef(-1);
  const to = (at: number, animated: boolean) =>
    strip.current?.scrollToIndex({ index: at, viewPosition: 0.5, animated });
  function activate(at: number) {
    if (at === index) return;
    if (!onSettle?.(at)) to(index, true);
  }
  useEffect(() => {
    if (viewport === 0 || index < 0 || index >= frames.length) return;
    to(index, walked.current);
    walked.current = true;
  }, [index, viewport]);
  function rest(x: number, overrules = false) {
    if (settled.current && !overrules) return;
    if (viewport === 0) return;
    const at = restedAt(x, viewport, frames.length, index, size);
    if (overrules && at === lifted.current) return;
    if (at < 0) return;
    if (at === index) {
      settled.current = true;
      return to(index, true);
    }
    settled.current = true;
    if (onSettle?.(at)) return;
    to(index, true);
  }
  const scrollTo = (e: NativeSyntheticEvent<NativeScrollEvent>) => e.nativeEvent.contentOffset.x;
  return (
    <FlatList
      ref={strip}
      horizontal
      data={frames}
      keyExtractor={(frame, at) => frame.uri || String(at)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.strip, { height: size.tall }]}
      style={style}
      onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
      onScrollBeginDrag={() => {
        settled.current = false;
        lifted.current = -1;
      }}
      onScrollEndDrag={(e) => {
        const where = scrollTo(e);
        lifted.current = restedAt(where, viewport, frames.length, index, size);
        rest(where);
      }}
      onMomentumScrollEnd={(e) => rest(scrollTo(e), true)}
      getItemLayout={(_, at) => ({ ...shotAt(at, index, size), index: at })}
      renderItem={({ item, index: at }) => (
        <Shot
          frame={item}
          size={size}
          current={at === index}
          dim={[0.75, 0.6][Math.abs(at - index) - 1] ?? 0.45}
          label={labelAt?.(at)}
          onActivate={onSettle ? () => activate(at) : undefined}
        />
      )}
    />
  );
}
function Shot({
  frame,
  size,
  current,
  dim,
  label,
  onActivate,
}: {
  frame: Frame;
  size: StripSize;
  current: boolean;
  dim: number;
  label?: string;
  onActivate?: () => void;
}) {
  const styles = useStyles();
  const width = current ? size.current : size.shot;
  const height = current ? size.tall : size.shotTall;
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ selected: current }}
      accessibilityActions={onActivate ? ACTIVATE : undefined}
      onAccessibilityAction={onActivate}
      style={[{ width, height }, styles.shot, current ? styles.shotCurrent : { opacity: dim }]}
    >
      <Image
        source={frame.cacheKey ? { uri: frame.uri, cacheKey: frame.cacheKey } : { uri: frame.uri }}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      {current && frame.video ? <PlayDot /> : null}
    </View>
  );
}
function shotAt(at: number, index: number, size: StripSize) {
  return {
    length: at === index ? size.current : size.shot,
    offset: at * (size.shot + GAP) + (at > index ? size.current - size.shot : 0),
  };
}
function restedAt(x: number, viewport: number, count: number, index: number, size: StripSize) {
  if (count === 0 || viewport === 0) return -1;
  const held = shotAt(index, index, size);
  const last = shotAt(count - 1, index, size);
  const standing = Math.max(
    0,
    Math.min(held.offset + held.length / 2 - viewport / 2, last.offset + last.length - viewport),
  );
  if (Math.abs(x - standing) < 1) return -1;
  const middle = x + viewport / 2;
  let on = 0;
  let nearest = Infinity;
  for (let at = 0; at < count; at += 1) {
    const { length, offset } = shotAt(at, index, size);
    const away = Math.abs(offset + length / 2 - middle);
    if (away < nearest) {
      nearest = away;
      on = at;
    }
  }
  return on;
}
function PlayDot() {
  const styles = useStyles();
  return (
    <View style={styles.playDot}>
      <Icon icon={Play} size={8} color={photo.on} fill={photo.on} />
    </View>
  );
}
export function Mosaic({
  photos,
  layout = 'strip',
  style,
}: {
  photos: readonly string[];
  layout?: 'cover' | 'strip';
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const cells = layout === 'cover' ? 3 : 4;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        styles.mosaic,
        layout === 'cover' ? styles.mosaicCover : null,
        style,
      ]}
    >
      {Array.from({ length: cells }, (_, i) => {
        const uri = photos[i];
        return (
          <View
            key={i}
            style={[
              styles.cell,
              layout === 'cover' && i === 0 ? styles.cellBig : null,
              layout === 'cover' && i > 0 ? styles.cellSmall : null,
            ]}
          >
            {uri ? (
              <Image
                source={{ uri, cacheKey: pictureKey(uri) }}
                contentFit="cover"
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    strip: { flexDirection: 'row', alignItems: 'center', gap: GAP },
    shot: {
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    shotCurrent: { borderRadius: 5, opacity: 1 },
    playDot: {
      position: 'absolute',
      left: 4,
      bottom: 4,
      width: 14,
      height: 14,
      borderRadius: radius.pill,
      backgroundColor: photo.playDot,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mosaic: { flexDirection: 'row', gap: 3 },
    mosaicCover: { flexDirection: 'column', flexWrap: 'wrap', gap: 2 },
    cell: { flexGrow: 1, flexBasis: 0, backgroundColor: color.raise, overflow: 'hidden' },
    cellBig: { width: '66%', height: '100%', flexGrow: 0, flexBasis: 'auto' },
    cellSmall: { width: '32%', height: '49%', flexGrow: 0, flexBasis: 'auto' },
  }),
);
