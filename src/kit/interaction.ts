import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing, type ViewStyle } from 'react-native';

import { color, ease } from '@/theme';

/**
 * What every kit component needs to answer a person: motion that obeys the OS, a focus ring, and a
 * touch target big enough for a finger. The kit states these once for the whole product («Голос»),
 * so they live here once and not in fourteen files.
 */

/** The kit's `--ease`, resolved for Animated. */
export const EASE = Easing.bezier(...ease);

/**
 * The kit's `@media (prefers-reduced-motion: reduce)`, held once for the whole app.
 *
 * Asking the OS is asynchronous, and a component that asks on mount animates once before the answer
 * lands — with a screenful of frames each starting its own develop, that is the setting being
 * ignored exactly where it matters. So the question is asked once at import, long before the first
 * screen mounts, and every component reads the answer that is already there.
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
AccessibilityInfo.isReduceMotionEnabled().then((on) => {
  if (!told) answer(on);
}, () => {});

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      watchers.add(notify);
      return () => {
        watchers.delete(notify);
      };
    },
    () => reduced,
  );
}

/**
 * A 0 → 1 value that repeats forever — the kit's `spin` and `safelight`, the only two things allowed
 * to move without being asked. Returns `null` when reduced motion is on, and that `null` is the
 * signal to draw the still version: the kit silences even these.
 *
 * `on` is for the caller that only sometimes draws the moving thing. A hook cannot be called
 * conditionally, so without it a contact sheet of a thousand ready frames would start a thousand
 * perpetual native animations to drive a dot none of them draws. `null` comes back for `off` too —
 * the same answer, for the same reason: there is nothing moving to read.
 */
export function useLoop(ms: number, easing = Easing.linear, on = true): Animated.Value | null {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  const run = on && !reduced;

  useEffect(() => {
    if (!run) return;
    // `Animated.loop` rewinds to 0 before each pass, so the value always sweeps 0 → 1.
    const loop = Animated.loop(
      Animated.timing(value, { toValue: 1, duration: ms, easing, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [run, ms, easing, value]);

  return run ? value : null;
}

/**
 * A 0 → 1 value that runs once on mount — the kit's `develop` (a frame coming out of the darkness)
 * and `rise` (a sheet coming up from the bottom). Under reduced motion it is simply already 1, so
 * the thing is there without ever having moved.
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
 * Hover and focus for one pressable. Hover only ever happens on web, focus only with a keyboard or
 * a switch — both are free to ask for and the kit requires the second one to be visible.
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

/** The kit's `:focus-visible` — a 2px ember ring, held off the element by 2px. */
export const focusRing: ViewStyle = {
  outlineWidth: 2,
  outlineColor: color.ember,
  outlineOffset: 2,
  outlineStyle: 'solid',
};

/** The kit's floor for a touch target. Anything drawn smaller borrows the difference back. */
export const TAP = 44;

/**
 * The slop that grows a control drawn smaller than 44×44 up to it — the kit's 40×40 icon button
 * gets 2 on each side, its 36-high small button gets 4 above and below.
 */
export function hitSlop(width: number, height = width) {
  const grow = (size: number) => Math.max(0, (TAP - size) / 2);
  return { left: grow(width), right: grow(width), top: grow(height), bottom: grow(height) };
}
