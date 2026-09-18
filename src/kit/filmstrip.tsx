import { Image } from 'expo-image';
import { Play } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { photo, radius, themed, useTheme } from '@/theme';

import { Icon } from './icon';
import { useFocusRing, useHoverFocus } from './interaction';

/** One frame as the strip and the mosaic know it: a picture, and whether it moves. */
export type Frame = { uri: string; video?: boolean };

/**
 * Spec 7.7 — the viewer's filmstrip: 48 tall, the neighbours 30 × 44 fading out towards the edges,
 * the current frame 44 × 48 at full strength with a play circle on it if it is a video.
 *
 * The one place in the product with a horizontal scroll (spec 1.5), and it turns with the frame
 * above it rather than on its own.
 */
export function Filmstrip({
  frames,
  index,
  onPick,
  labelAt,
  style,
}: {
  frames: readonly Frame[];
  index: number;
  onPick?: (at: number) => void;
  /** What each frame is called out as — «Кадр 4 из 486», written by the screen. */
  labelAt?: (at: number) => string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      style={style}
    >
      {frames.map((frame, at) => (
        <Shot
          key={frame.uri}
          frame={frame}
          current={at === index}
          // The fade is by distance from the frame in hand: 0.75, 0.6, then 0.45 for everything past.
          dim={[0.75, 0.6][Math.abs(at - index) - 1] ?? 0.45}
          label={labelAt?.(at)}
          onPress={onPick ? () => onPick(at) : undefined}
        />
      ))}
    </ScrollView>
  );
}

function Shot({
  frame,
  current,
  dim,
  label,
  onPress,
}: {
  frame: Frame;
  current: boolean;
  dim: number;
  label?: string;
  onPress?: () => void;
}) {
  const { focused, props } = useHoverFocus();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: current }}
      disabled={!onPress}
      onPress={onPress}
      {...props}
      style={[
        styles.shot,
        current ? styles.shotCurrent : { opacity: dim },
        focused ? focusRing : null,
      ]}
    >
      <Image source={{ uri: frame.uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
      {current && frame.video ? <PlayDot /> : null}
    </Pressable>
  );
}

function PlayDot() {
  const styles = useStyles();
  return (
    <View style={styles.playDot}>
      <Icon icon={Play} size={8} color={photo.on} fill={photo.on} />
    </View>
  );
}

/**
 * Spec 7.7 — the three mosaics the layout builds out of a memory's own frames:
 *
 * - `cover` — 3 × 2 with one 2 × 2 cell on the left, behind the large memory card;
 * - `strip` — four in a row inside an ordinary card, 96 tall;
 * - `banner` — four in a row under a solid, 176 tall, behind «Собираем ролик».
 *
 * A cell with nothing to put in it is left as plain `surface`: spec 7.6 says a memory with fewer
 * than three frames fills what it can and leaves the rest empty rather than repeating a picture.
 */
export function Mosaic({
  photos,
  layout = 'strip',
  style,
}: {
  photos: readonly string[];
  layout?: 'cover' | 'strip' | 'banner';
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
        layout === 'banner' ? styles.mosaicBanner : null,
        style,
      ]}
    >
      {Array.from({ length: cells }, (_, i) => {
        const uri = photos[i];
        return (
          <View
            key={uri ?? i}
            style={[
              styles.cell,
              layout === 'cover' && i === 0 ? styles.cellBig : null,
              layout === 'cover' && i > 0 ? styles.cellSmall : null,
            ]}
          >
            {uri ? (
              <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    strip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 48 },
    shot: { width: 30, height: 44, borderRadius: 3, overflow: 'hidden', backgroundColor: color.raise },
    shotCurrent: { width: 44, height: 48, borderRadius: 5, opacity: 1 },
    playDot: {
      position: 'absolute',
      top: 17,
      left: 15,
      width: 14,
      height: 14,
      borderRadius: radius.pill,
      backgroundColor: photo.mark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    mosaicCover: { gap: 2 },
    mosaicBanner: { gap: 2 },
    cell: { flexGrow: 1, flexBasis: 0, backgroundColor: color.surface, overflow: 'hidden' },
    // The 2 × 2 cell on the left of a cover, and the two stacked beside it.
    cellBig: { flexBasis: '66%', flexGrow: 0, height: '100%' },
    cellSmall: { flexBasis: '32%', flexGrow: 0, height: '49%' },
  }),
);
