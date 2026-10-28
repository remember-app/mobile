import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { EASE, Text, useReducedMotion } from '@/kit';
import {
  currentDensity,
  DENSITY_DEFAULT,
  type Density,
  densityWalked,
  setDensity,
} from '@/lib/density';
import { useStrings } from '@/lib/language';
import { duration, height, photo, radius, themed } from '@/theme';

/**
 * The density of a gallery, walked by a pinch right in it (spec 10.14.1, `MemoryDensity`): squeezing
 * the fingers together cuts more frames to a row, spreading them apart cuts fewer, and the last
 * step of the same gesture is the single frame (`MemorySingle`, spec 10.14.2). No button opens it.
 * Every gallery that reads the pick wears it — the memory's feed, «Мои кадры», «Добавить кадры» and
 * the montage's picker — so the gesture is the same one wherever the frames are.
 *
 * None of this is a kit part: the layout draws neither the pill nor the gesture, and spec 10.14
 * says outright that no new detail is added to section 7 for them. What it draws instead is the
 * glass bar's own capsule slot (detail 4), held for the moment the fingers are down.
 */

/** How far apart two fingers are, in points — what the pinch is measured by. */
function spread(touches: readonly { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

/**
 * The pinch, hung on the view a gallery stands in. A drag of two fingers is the density's and is
 * taken off the feed before the scroll sees it; a drag of one is the gallery's own and passes
 * straight through, so the wall still scrolls and a frame is still a button.
 *
 * `pinching` is the fingers down, `leaving` is the 200ms the pill takes to go after they lift — the
 * bar draws the pill while either is true, and `DensityPill` fades itself out on `leaving`.
 */
export function useDensityPinch(): {
  pinching: boolean;
  leaving: boolean;
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
} {
  const [pinching, setPinching] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /**
   * Spec 10.14.1: «при reduce — без перерезки на глазах и без пилюли: значение меняется сразу».
   * The re-cut is already instant (the grids are cut from the value, not animated); what the setting
   * takes away is the pill, so the two flags the bar draws it from are shut off for it.
   */
  const reduced = useReducedMotion();
  /** How far apart the fingers were when they landed: every step is measured against this. */
  const base = useRef(0);
  /**
   * The density the gesture began on, and the one last applied — a step is taken only on a change.
   * Both are written on grant; what they stand at until then is never read.
   */
  const from = useRef<Density>(DENSITY_DEFAULT);
  const applied = useRef<Density>(DENSITY_DEFAULT);
  /** The timer the pill's fade-out rides on; null while it is not on its way out. */
  const away = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (away.current !== null) clearTimeout(away.current);
    },
    [],
  );

  const letGo = useCallback(() => {
    setPinching(false);
    setLeaving(true);
    away.current = setTimeout(() => {
      away.current = null;
      setLeaving(false);
    }, duration.banner);
  }, []);

  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        // Two fingers anywhere over the feed are the density's, taken in the capture phase so the
        // scroll underneath never begins. One is left alone: this answers false and the feed has it.
        onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          base.current = spread(event.nativeEvent.touches);
          from.current = currentDensity();
          applied.current = currentDensity();
          if (away.current !== null) {
            clearTimeout(away.current);
            away.current = null;
          }
          setLeaving(false);
          setPinching(true);
        },
        onPanResponderMove: (event) => {
          if (base.current <= 0) return;
          const next = densityWalked(
            from.current,
            spread(event.nativeEvent.touches) / base.current,
          );
          // A step is written once, on the value it moves to: the finger crossing a threshold back
          // and forth is not a reason to write the same number to the keychain again.
          if (next === applied.current) return;
          applied.current = next;
          void setDensity(next);
        },
        onPanResponderRelease: letGo,
        onPanResponderTerminate: letGo,
      }).panHandlers,
    [letGo],
  );

  // The pill is the only reader of the two; the gesture itself and the value it walks are untouched
  // by «reduce motion».
  return { pinching: !reduced && pinching, leaving: !reduced && leaving, panHandlers };
}

/**
 * The pill the glass bar wears while the fingers are down (spec 10.14.1): the count above, the
 * words below, on the night's `paper` with its ink — the held capsule of `FrameInfo` rather than
 * the glass the capsule is. It stands in the capsule's own slot, 48 tall, and answers no finger.
 */
export function DensityPill({ value, leaving }: { value: Density; leaving: boolean }) {
  const s = useStrings();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fingers down again while the pill is still on its way out: the same pill is kept mounted (the
    // bar shows it while either flag is up), so it has to be brought back to full strength rather
    // than left at whatever the interrupted fade had reached.
    if (!leaving) {
      fade.setValue(1);
      return;
    }
    const run = Animated.timing(fade, {
      toValue: 0,
      duration: reduced ? 0 : duration.banner,
      easing: EASE,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [leaving, reduced, fade]);

  const one = value === 1;
  return (
    <Animated.View
      // A live region: the number changes under the fingers, and a screen reader is told the value
      // it settles on (spec 10.14.1). It is never a button — the gesture is the whole of the control.
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={one ? s.gallery.onePerRow : s.gallery.framesPerRow(value)}
      pointerEvents="none"
      style={[styles.slot, { opacity: fade }]}
    >
      <View style={styles.pill}>
        {/* Spec 10.14.1: `Unbounded 600 16`, tabular — a number that changes in place under the
            finger must not move the pill's own width about as it does. */}
        <Text role="pillTitle" style={styles.figure}>
          {String(value)}
        </Text>
        <Text role="metaSm" style={styles.caption}>
          {one ? s.gallery.onePerRow : s.gallery.framesPerRowWords}
        </Text>
      </View>
    </Animated.View>
  );
}

// No colour of its own but the pill's two inks, which are the night's fixed pair (`photo`) rather
// than the theme's — the glass bar is dark in both themes (spec 2).
const useStyles = themed(() =>
  StyleSheet.create({
    // The capsule's own slot (detail 4): the pill stands where the memory's name stood, centred
    // between the two 48s, and is as wide as its words rather than stretched to the edges.
    slot: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
    pill: {
      maxWidth: '100%',
      // 48 as a floor and not a ceiling, the way the capsule it stands in for is: at the largest
      // system type the two lines are taller than the drawn pill, and it grows down with them.
      minHeight: height.roundViewer,
      paddingHorizontal: 22,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: photo.pillHeldEdge,
      backgroundColor: photo.pillHeld,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    },
    figure: {
      fontSize: 16,
      lineHeight: 19,
      letterSpacing: -0.32,
      color: photo.pillHeldInk,
      fontVariant: ['tabular-nums'],
    },
    caption: { color: photo.pillHeldMeta },
  }),
);
