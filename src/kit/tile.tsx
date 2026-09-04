// `expo-image` and not React Native's own: a frame picked out of the phone's gallery is named by a
// `ph://` reference to the photo library, which React Native has no loader for at all — that is the
// red «No suitable image URL loader» screen. This one asks the Photos framework, which answers for a
// video with its poster frame too, and hands back a bitmap already scaled to the tile instead of a
// twelve-megapixel original — which is what makes a contact sheet of thousands survivable.
import { Image } from 'expo-image';
import { Check, TriangleAlert } from 'lucide-react-native';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, duration as motion, radius, space } from '@/theme';

import { ICO_S, Icon } from './icon';
import { EASE, focusRing, useFadeIn, useHoverFocus, useLoop } from './interaction';
import { shade } from './shades';
import { Text } from './text';

/** The kit's `.tile--*`, section 8: what has become of one frame. */
export type TileState = 'ready' | 'processing' | 'failed';

/** The developing frame: the kit's `develop` is an opacity, and opacity is animatable on any view. */
const AnimatedImage = Animated.createAnimatedComponent(Image);

/**
 * One frame of the contact sheet. Ready, it develops out of the darkness the way a print comes up
 * in the tray; waiting, it pulses a safelight dot; fallen over, it says so plainly instead of
 * showing a code. Selected before sending, it takes the ember frame and a mark in the corner.
 *
 * The tile fills whatever column the sheet gives it and stays square. Nothing here is clickable
 * unless `onPress` is passed — a frame still developing is not a button.
 */
export function Tile({
  state,
  uri,
  length,
  selected,
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
  /** What a waiting or fallen frame says of itself — `.tile__state`. */
  caption?: string;
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { focused, props } = useHoverFocus();
  const develop = useFadeIn(motion.slow);
  // Only the waiting frame draws it, and only it should be paying for it: a sheet of a thousand
  // ready frames must not run a thousand loops nothing reads.
  const safelight = useLoop(1600, EASE, state === 'processing');

  const inner = (
    <>
      {state === 'ready' && uri ? (
        <AnimatedImage
          source={{ uri }}
          contentFit="cover"
          style={[
            styles.image,
            {
              // The kit fades the frame in from near-black; over a dark tile, opacity is that same
              // rise out of the darkness. A selected frame settles at the kit's dimmed 0.82.
              opacity: develop.interpolate({
                inputRange: [0, 1],
                outputRange: [0, selected ? 0.82 : 1],
              }),
            },
          ]}
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
            <Icon icon={TriangleAlert} size={ICO_S} color={shade.danger} />
          </View>
          {caption ? <Text style={[styles.caption, styles.captionFailed]}>{caption}</Text> : null}
        </View>
      ) : null}

      {length && state === 'ready' ? (
        <View style={styles.length}>
          <Text style={styles.lengthText}>{length}</Text>
        </View>
      ) : null}

      {selected ? (
        <>
          <View style={[StyleSheet.absoluteFill, styles.ring]} pointerEvents="none" />
          <View style={styles.check}>
            {/* The kit thickens this one stroke to 3 — a 13px tick at 1.75 would not read. */}
            <Check size={13} color={shade.onEmber} strokeWidth={3} />
          </View>
        </>
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

const styles = StyleSheet.create({
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.frame,
    overflow: 'hidden',
    backgroundColor: color.surface,
  },
  processing: { borderWidth: 1, borderColor: color.line },
  failed: { borderWidth: 1, borderColor: shade.dangerLine, backgroundColor: shade.dangerTile },
  image: { width: '100%', height: '100%' },
  state: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.s2 },
  safelight: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.ember },
  caption: { fontSize: 12, lineHeight: 15.6, fontWeight: '500', color: color.muted, textAlign: 'center' },
  captionFailed: { color: shade.danger },
  length: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: shade.scrim,
  },
  lengthText: { fontSize: 12, lineHeight: 14.4, fontWeight: '500', fontVariant: ['tabular-nums'] },
  // `box-shadow: inset 0 0 0 2px` has no React Native spelling; a bordered overlay is the same ring.
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
});
