import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  LayoutAnimation,
  type ViewStyle,
} from 'react-native';

import { duration, ease, themed } from '@/theme';

export { hitSlop, TAP } from './tap';

/**
 * What every component of the library needs in order to answer a person: motion that obeys the OS,
 * a visible focus ring, and a touch target big enough for a finger. The spec states these once for
 * the whole product (sections 6, 10.2 and 10.3), so they live here once and not in thirty files.
 */

/** The spec's `ease-out`, resolved for Animated. */
export const EASE = Easing.bezier(...ease);

/**
 * The spec's `prefers-reduced-motion: reduce` (section 6), held once for the whole app: a transition
 * becomes an instant swap and an endless turn becomes a still glyph.
 *
 * Asking the OS is asynchronous, and a component that asks on mount animates once before the answer
 * lands — with a screenful of frames each starting its own fade, that is the setting being ignored
 * exactly where it matters. So the question is asked once at import, long before the first screen
 * mounts, and every component reads the answer that is already there.
 */
let reduced = false;
const watchers = new Set<() => void>();

function answer(on: boolean) {
  reduced = on;
  for (const notify of watchers) notify();
}

// The listener goes on first and the boot answer defers to it: both write the same slot, and the
// question is asked once and never again, so a change arriving while the promise is still in flight
// must not be overwritten by the older answer. Rejection is swallowed rather than left unhandled —
// nobody is awaiting this at module scope, so a reject where the native module is missing (a plain
// JS runtime, a static web render) would be a red box on startup, and `false` is the right answer
// to keep: it is what the setting is off.
let told = false;
AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
  told = true;
  answer(on);
});
AccessibilityInfo.isReduceMotionEnabled().then(
  (on) => {
    if (!told) answer(on);
  },
  () => {},
);

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      watchers.add(notify);
      return () => {
        watchers.delete(notify);
      };
    },
    () => reduced,
    // Same answer off the render path: the module-scope slot is not the DOM's and reads fine
    // without one. Without this third argument a static render throws instead of drawing.
    () => reduced,
  );
}

/**
 * The next change of layout, moved into rather than snapped to: a row landing in a list, a block
 * giving way to another one. Whatever appears fades in, whatever was already there slides to where
 * it now stands — the platform's own doing, one call, no component wrapped in anything.
 *
 * Called just before the state that changes the layout, and never on something that changes every
 * frame — a text box growing under a letter being typed would be thirty of these a second, each
 * animating over the last. Silent under reduced motion, like everything else here, and it reads the
 * slot above directly because a caller of this is not always a component.
 */
export function soften(ms: number): void {
  if (reduced) return;
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      ms,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  );
}

/**
 * A 0 → 1 value that repeats forever — the spinner, and nothing else in the product is allowed to
 * move without being asked. Returns `null` when reduced motion is on, and that `null` is the signal
 * to draw the still arc: spec 6 silences even this one.
 *
 * Linear and always running, because the one thing that loops is the spinner and a spinner is only
 * ever mounted while it is being drawn. The old kit's tile pulsed under its own easing and its own
 * «only while developing» flag; this one draws a `Spinner` instead, so both of those went with it
 * (found in review, m-21). The day something else loops, it brings its own argument back.
 */
export function useLoop(ms: number): Animated.Value | null {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    // `Animated.loop` rewinds to 0 before each pass, so the value always sweeps 0 → 1.
    const loop = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: ms,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, ms, value]);

  return reduced ? null : value;
}

/**
 * A 0 → 1 value that runs once on mount — a sheet coming up, a pick circle appearing. Under reduced
 * motion it is simply already 1, so the thing is there without ever having moved.
 *
 * For an `Animated.View` and nothing else. The native driver writes straight at the view the value
 * is attached to, so wrapping somebody else's component in `Animated.createAnimatedComponent` gets
 * a value that climbs in JS over a picture that never moves — see the tile, which fades through
 * `expo-image`'s own `transition` for exactly that reason.
 */
export function useFadeIn(ms: number): Animated.Value {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    const run = Animated.timing(value, {
      toValue: 1,
      duration: ms,
      easing: EASE,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [reduced, ms, value]);

  return value;
}

/**
 * A value that follows `to` — the sending bar reaching for a new percentage, 300ms, and never going
 * back (spec 6). Under reduced motion it jumps.
 *
 * Not on the native driver: `width` is a layout property, and the whole point of this one is that
 * the bar's width is what moves.
 */
export function useReach(to: number): Animated.Value {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(to)).current;

  useEffect(() => {
    if (reduced) {
      value.setValue(to);
      return;
    }
    const run = Animated.timing(value, {
      toValue: to,
      duration: duration.progress,
      easing: EASE,
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [reduced, to, value]);

  return value;
}

/**
 * Hover and focus for one pressable. Hover only ever happens on web, focus only with a keyboard or
 * a switch — both are free to ask for and spec 10.3 requires the second one to be visible.
 */
export function useHoverFocus() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const props = useMemo(
    () => ({
      onHoverIn: () => setHovered(true),
      onHoverOut: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    }),
    [],
  );
  return { hovered, focused, props };
}

const useRings = themed(
  ({ color }): Record<'base' | 'onAccent', ViewStyle> => ({
    base: { outlineWidth: 2, outlineColor: color.accent, outlineOffset: 2, outlineStyle: 'solid' },
    // Spec 2.5: on an element that is itself filled with `accent` — the main button — an accent
    // ring would be invisible, so that one is ringed in `paper`.
    onAccent: {
      outlineWidth: 2,
      outlineColor: color.paper,
      outlineOffset: 2,
      outlineStyle: 'solid',
    },
  }),
);

/**
 * Spec 2.5 — a 2px ring in `accent`, held 2px off the element, over any background. The layout has
 * no focus anywhere and that is the one thing about it that is not a style decision: pass
 * `onAccent` on anything filled with the accent itself.
 */
export function useFocusRing(onAccent = false): ViewStyle {
  const rings = useRings();
  return onAccent ? rings.onAccent : rings.base;
}

/** Spec 6 — a button under a finger goes to 0.98 and back. A movement, so it obeys the setting. */
export const PRESS: ViewStyle = { transform: [{ scale: 0.98 }] };

/**
 * How a scroll with a field in it treats the keyboard (TASK-377), the board's and the sheet's alike:
 * a tap that lands on a button or a field is theirs and leaves the keyboard up — a form keeps its
 * own button — and a drag takes the keyboard down, the way every scroll on the phone does.
 */
export const KEYBOARD_SCROLL = {
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'on-drag',
} as const;

/**
 * A tap or a drag on nothing takes the keyboard down (TASK-377) — the background, a line of words,
 * the gap between blocks, the bottom layer around its field, a sheet whose body has nothing to
 * scroll. Asked last: React Native offers a touch to the deepest view first, so a button or a field
 * that wants it has it, and this only hears the rest; a drag that scrolls is the scroll's, and
 * `KEYBOARD_SCROLL` takes the keyboard down there. A drag begun on a button takes it from the
 * button, which is what a drag is — the sliders and the rows dragged by hand refuse to give it up.
 * Only while the keyboard is up, so otherwise it stands in the way of nothing.
 */
export const DISMISS_KEYBOARD = {
  onStartShouldSetResponder: () => Keyboard.isVisible(),
  onMoveShouldSetResponder: () => Keyboard.isVisible(),
  onResponderRelease: () => Keyboard.dismiss(),
} as const;

/**
 * Where a field says it stands in a board's bar (TASK-381). The bar gives way to the keyboard by going
 * into the scroll, and a field moved there is drawn anew — the keyboard goes down with it (TASK-374) —
 * so a bar holding one never does. `Board` hands the bar this, and every field of the kit calls
 * {@link useFieldInBar}.
 */
export const FieldInBar = createContext<(() => () => void) | null>(null);

/** Called by every field of the kit; in a board's bar it keeps the bar standing. */
export function useFieldInBar(): void {
  const hold = useContext(FieldInBar);
  useEffect(() => hold?.(), [hold]);
}
