// `expo-image` and not React Native's own: a frame picked out of the phone's gallery is named by a
// `ph://` reference to the photo library, which React Native has no loader for at all — that is the
// red «No suitable image URL loader» screen. This one asks the Photos framework, which answers for a
// video with its poster frame too, and hands back a bitmap already scaled to the tile instead of a
// twelve-megapixel original — which is what makes a grid of thousands survivable.
import { Image } from 'expo-image';
import { Check, ImageIcon, Play, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { duration as motion, photo, radius, space, themed, useTheme } from '@/theme';

import { Spinner } from './empty';
import { Icon, type IconComponent } from './icon';
import { useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/** What has become of one frame (spec 7.7). */
export type TileState = 'ready' | 'processing' | 'failed';

/**
 * The five kinds of pick circle (spec 7.4), and spec 1.7 is what tells them apart: `accent` means
 * «this frame is going to the server», `spark` means «this one is already ours and I am doing
 * something with it». Being dropped is not a pick at all — `auto` shows the reason instead of a
 * circle, `hand` shows a cross — and both dim the frame rather than hide it.
 */
export type PickKind = 'send' | 'keep' | 'off' | 'auto' | 'hand';

/**
 * The gutter between two frames of the grid, and the whole of what stands between them. Here rather
 * than in either screen that draws a grid: both have to work a column width out of it, and a gutter
 * of two minds would tell them two different widths.
 */
export const GRID_GAP = 3;

/**
 * One frame of the grid (spec 7.7). It fills whatever column it is given and stays square. Nothing
 * here is pressable unless `onPress` is passed — a frame still developing is not a button.
 */
export function Tile({
  state,
  uri,
  pick,
  length,
  reason,
  caption,
  label,
  onPress,
  style,
}: {
  state: TileState;
  uri?: string;
  /** The circle in the corner. Left off, the frame is not in a picking mode at all. */
  pick?: PickKind;
  /** A video's running time as the screen writes it, «0:24». */
  length?: string;
  /** Why the automatic pass dropped this one: a glyph and a word, «Размыто» / «Дубль» / «Темно». */
  reason?: { icon: IconComponent; label: string };
  /** What a developing frame says of itself. */
  caption?: string;
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const dropped = pick === 'auto' || pick === 'hand';
  const picked = pick === 'send' || pick === 'keep';

  const inner = (
    <>
      {state === 'ready' && uri ? (
        // The fade is `expo-image`'s own cross-dissolve and not an `Animated` opacity laid over it.
        // It was the latter until the frame stopped appearing at all: a native-driver opacity has to
        // be attached to a native view, and this is a class component wrapping one, so the value
        // rose to 1 in JS while the picture sat at 0 until an unrelated re-render pushed it — which
        // is why a tile only showed itself once it was tapped.
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={reduced ? 0 : motion.sheet}
          style={[styles.image, dropped ? styles.down : null]}
        />
      ) : null}

      {state === 'processing' ? (
        <View style={[StyleSheet.absoluteFill, styles.state]}>
          <Spinner size={16} />
          {caption ? (
            <Text role="meta" style={styles.caption}>
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Spec 7.7 — «не загрузилась»: a plain surface and a frame glyph, and a press tries again. */}
      {state === 'failed' ? (
        <View style={[StyleSheet.absoluteFill, styles.state]}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon icon={ImageIcon} size={22} color={color.faint} />
          </View>
          {caption ? (
            <Text role="meta" tone="faint" style={styles.caption}>
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}

      {length && state === 'ready' && !reason ? <FrameMark length={length} /> : null}
      {reason ? <FrameMark icon={reason.icon} label={reason.label} /> : null}

      {/* A layer over the picture rather than a border on the tile itself: a border comes out of the
          tile's own box, which in the grid would make a picked frame narrower than its neighbours. */}
      {picked ? (
        <View
          testID="tile-ring"
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.ring,
            { borderColor: pick === 'send' ? color.accent : color.spark },
          ]}
        />
      ) : null}

      {pick && pick !== 'auto' ? <PickCircle kind={pick} /> : null}
    </>
  );

  const frame: StyleProp<ViewStyle> = [
    styles.tile,
    state === 'processing' ? styles.processing : null,
    state === 'failed' ? styles.broken : null,
    style,
  ];

  if (!onPress) {
    return (
      <View style={frame} accessibilityRole="image" accessibilityLabel={label}>
        {inner}
      </View>
    );
  }

  // A frame that carries a pick is a checkbox, and one that does not is a button. It matters:
  // `checked` is spoken only when it is true, so on a screen whose whole job is picking, an unpicked
  // frame would announce neither that it toggles nor that it is currently off.
  return (
    <Pressable
      accessibilityRole={pick ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={pick ? { checked: picked } : undefined}
      onPress={onPress}
      {...props}
      style={[frame, focused ? focusRing : null]}
    >
      {inner}
    </Pressable>
  );
}

/**
 * Spec 7.4 — the 22 circle in the top right corner of a tile, 6 in from the edge. Its own component
 * because it is its own detail: the same circle stands on a frame going to the server and on a frame
 * being taken home, and only the colour tells those two apart.
 */
export function PickCircle({ kind }: { kind: Exclude<PickKind, 'auto'> }) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.pick,
        kind === 'send' ? { backgroundColor: color.accent } : null,
        kind === 'keep' ? { backgroundColor: color.spark } : null,
        kind === 'off' ? styles.pickOff : null,
        kind === 'hand' ? [styles.pickHand, { borderColor: color.lineStrong }] : null,
      ]}
    >
      {kind === 'send' ? <Icon icon={Check} size={13} color={color.onFill} /> : null}
      {kind === 'keep' ? <Icon icon={Check} size={13} color={color.sparkInk} /> : null}
      {kind === 'hand' ? <Icon icon={X} size={13} color={color.muted} /> : null}
    </View>
  );
}

/**
 * Spec 7.4 — the mark in the bottom left corner of a tile: either a video's running time, or the
 * reason the automatic pass dropped the frame. The reason's plate is denser and runs the whole width
 * of the tile, because a word has to be read at 10px over somebody's photograph.
 */
export function FrameMark({
  length,
  icon,
  label,
}: {
  length?: string;
  icon?: IconComponent;
  label?: string;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.mark, label ? styles.markWide : null]}>
      <Icon
        icon={icon ?? Play}
        size={length ? 10 : 11}
        color={photo.on}
        fill={length ? photo.on : undefined}
      />
      <Text
        role="meta"
        numberOfLines={1}
        style={[styles.markText, label ? styles.markTextSm : null]}
      >
        {length ?? label}
      </Text>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    tile: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: radius.tile,
      overflow: 'hidden',
      backgroundColor: color.surface,
    },
    processing: { borderWidth: 1, borderColor: color.line },
    broken: { backgroundColor: color.raise },
    image: { width: '100%', height: '100%' },
    // Spec 7.4: a frame the pass dropped goes down to 32% — visible, and plainly out.
    down: { opacity: 0.32 },
    state: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.s2 },
    caption: { textAlign: 'center' },
    ring: { borderWidth: 3, borderRadius: radius.tile, backgroundColor: photo.picked },
    pick: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickOff: { backgroundColor: photo.pickOff, borderWidth: 1.5, borderColor: photo.pickEdge },
    pickHand: { backgroundColor: photo.pickHand, borderWidth: 1 },
    mark: {
      position: 'absolute',
      left: 5,
      bottom: 5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      backgroundColor: photo.mark,
    },
    // The reason runs the width of the tile — a word needs the room a timecode does not.
    markWide: { right: 5, backgroundColor: photo.markStrong },
    markText: { color: photo.on, fontSize: 11 },
    markTextSm: { color: color.muted, fontSize: 10 },
  }),
);
