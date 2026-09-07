// `expo-image` and not React Native's own: a frame picked out of the phone's gallery is named by a
// `ph://` reference to the photo library, which React Native has no loader for at all — that is the
// red «No suitable image URL loader» screen. This one asks the Photos framework, which answers for a
// video with its poster frame too, and hands back a bitmap already scaled to the tile instead of a
// twelve-megapixel original — which is what makes a contact sheet of thousands survivable.
import { Image } from 'expo-image';
import { Check, TriangleAlert } from 'lucide-react-native';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { duration as motion, onScrim, radius, scrim, space, themed, useTheme } from '@/theme';

import { ICO_S, Icon } from './icon';
import { EASE, useFocusRing, useHoverFocus, useLoop, useReducedMotion } from './interaction';
import { Text } from './text';

/** The kit's `.tile--*`, section 8: what has become of one frame. */
export type TileState = 'ready' | 'processing' | 'failed';

/**
 * `.sheet{gap:3px}` — the cut between two frames of a contact sheet, and the whole of what stands
 * between them. Here rather than in either screen that draws a sheet: both of them have to work the
 * width of a column out of it, and a gutter of two minds would tell them two different widths.
 */
export const SHEET_GAP = 3;

/**
 * One frame of the contact sheet. Ready, it develops out of the darkness the way a print comes up
 * in the tray; waiting, it pulses a safelight dot; fallen over, it says so plainly instead of
 * showing a code. Selected before sending, it takes the ember ring and a mark in the corner; open in
 * the filmstrip, the same ring and nothing else.
 *
 * The tile fills whatever column the sheet gives it and stays square. Nothing here is clickable
 * unless `onPress` is passed — a frame still developing is not a button.
 */
export function Tile({
  state,
  uri,
  length,
  selected,
  current,
  caption,
  label,
  onPress,
  style,
}: {
  state: TileState;
  uri?: string;
  /** Video length as the screen writes it, e.g. `0:42` — `.tile__duration`. */
  length?: string;
  selected?: boolean;
  /**
   * `.tile--current` — the frame the filmstrip has open. The kit gives it the same ember ring a
   * picked frame wears («метка выделения в продукте одна») and nothing else: no tick, no dimming.
   */
  current?: boolean;
  /** What a waiting or fallen frame says of itself — `.tile__state`. */
  caption?: string;
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { shade } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  // Only the waiting frame draws it, and only it should be paying for it: a sheet of a thousand
  // ready frames must not run a thousand loops nothing reads.
  const safelight = useLoop(1600, EASE, state === 'processing');

  const inner = (
    <>
      {state === 'ready' && uri ? (
        // The kit's `develop` is `expo-image`'s own cross-dissolve, not an `Animated` opacity laid
        // over it. It was the latter until this frame stopped appearing at all: a native-driver
        // opacity has to be attached to a native view, and this is a class component wrapping one,
        // so the value rose to 1 in JS while the picture sat at 0 until an unrelated re-render
        // pushed it — which is why a tile only showed itself once it was tapped. The dim on a
        // picked frame is a plain style: it is a state, not a motion.
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={reduced ? 0 : motion.slow}
          style={[styles.image, selected ? styles.dimmed : null]}
        />
      ) : null}

      {state === 'processing' ? (
        <View style={[StyleSheet.absoluteFill, styles.state]}>
          <Animated.View
            style={[
              styles.safelight,
              // Still and lit when motion is turned down — a dot frozen at the kit's dimmest
              // would read as nothing happening.
              safelight
                ? {
                    opacity: safelight.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.25, 1, 0.25],
                    }),
                  }
                : null,
            ]}
          />
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
      ) : null}

      {state === 'failed' ? (
        <View style={[StyleSheet.absoluteFill, styles.state]}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon icon={TriangleAlert} size={ICO_S} color={shade.rustText} />
          </View>
          {caption ? <Text style={[styles.caption, styles.captionFailed]}>{caption}</Text> : null}
        </View>
      ) : null}

      {length && state === 'ready' ? (
        <View style={styles.length}>
          <Text style={styles.lengthText}>{length}</Text>
        </View>
      ) : null}

      {/* One ring for both marks, `.tile--selected::after, .tile--current::after` — and a layer over
          the picture rather than a border on the tile itself. A border would come out of the tile's
          own box: in the filmstrip that made the open frame 4px smaller than every frame beside it,
          which is the one thing it must not be. */}
      {selected || current ? (
        <View
          testID="tile-ring"
          style={[StyleSheet.absoluteFill, styles.ring]}
          pointerEvents="none"
        />
      ) : null}

      {selected ? (
        <View testID="tile-check" style={styles.check}>
          {/* The kit thickens this one stroke to 3 — a 13px tick at 1.75 would not read. */}
          <Check size={13} color={shade.onEmber} strokeWidth={3} />
        </View>
      ) : null}
    </>
  );

  const frame: StyleProp<ViewStyle> = [
    styles.tile,
    state === 'processing' ? styles.processing : null,
    state === 'failed' ? styles.failed : null,
    style,
  ];

  if (!onPress) {
    return (
      <View style={frame} accessibilityRole="image" accessibilityLabel={label}>
        {inner}
      </View>
    );
  }

  // A frame that carries a selection is a checkbox, and one that does not is a button. It matters:
  // `selected` is spoken only when it is true, so on a sheet whose whole job is picking, an
  // unpicked frame would announce neither that it toggles nor that it is currently off.
  const checkable = selected !== undefined;

  return (
    <Pressable
      accessibilityRole={checkable ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={checkable ? { checked: !!selected } : undefined}
      onPress={onPress}
      {...props}
      style={[frame, focused ? focusRing : null]}
    >
      {inner}
    </Pressable>
  );
}

const useStyles = themed(({ color, shade }) =>
  StyleSheet.create({
    tile: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: radius.frame,
      overflow: 'hidden',
      backgroundColor: color.surface,
    },
    processing: { borderWidth: 1, borderColor: color.line },
    failed: { borderWidth: 1, borderColor: shade.rustLine, backgroundColor: shade.rustFill },
    image: { width: '100%', height: '100%' },
    // The kit dims a picked frame so the ember ring and the tick read over it.
    dimmed: { opacity: 0.82 },
    state: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.s2 },
    safelight: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.ember },
    caption: {
      fontSize: 12,
      lineHeight: 15.6,
      fontWeight: '500',
      color: color.muted,
      textAlign: 'center',
    },
    captionFailed: { color: shade.rustText },
    length: {
      position: 'absolute',
      right: 5,
      bottom: 5,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      backgroundColor: scrim,
    },
    // On the scrim and not on the theme: the pill lies on the photograph, so what is read on it is
    // the same in both themes.
    lengthText: {
      fontSize: 12,
      lineHeight: 14.4,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
      color: onScrim,
    },
    // The kit's own `::after{inset:0}` — a layer the size of the tile carrying the border, laid over
    // the picture. The tile keeps every pixel of its width; only the ring is drawn on top of it.
    ring: { borderWidth: 2, borderColor: color.ember, borderRadius: radius.frame },
    check: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.ember,
    },
  }),
);
