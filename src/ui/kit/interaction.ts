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
  Platform,
  type ViewStyle,
} from 'react-native';
import { duration, ease, themed } from '@/ui/theme';

export { hitSlop, TAP } from './tap';
export const EASE = Easing.bezier(...ease);
let reduced = false;
const watchers = new Set<() => void>();
function answer(on: boolean) {
  reduced = on;
  for (const notify of watchers) notify();
}
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
    () => reduced,
  );
}
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
export function useLoop(ms: number): Animated.Value | null {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
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
export function useFadeIn(ms: number, onDone?: () => void): Animated.Value {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      onDone?.();
      return;
    }
    const run = Animated.timing(value, {
      toValue: 1,
      duration: ms,
      easing: EASE,
      useNativeDriver: true,
    });
    run.start(({ finished }) => {
      if (finished) onDone?.();
    });
    return () => run.stop();
  }, [reduced, ms, value]);
  return value;
}
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
    onAccent: {
      outlineWidth: 2,
      outlineColor: color.paper,
      outlineOffset: 2,
      outlineStyle: 'solid',
    },
  }),
);
export function useFocusRing(onAccent = false): ViewStyle {
  const rings = useRings();
  return onAccent ? rings.onAccent : rings.base;
}
export const PRESS: ViewStyle = { transform: [{ scale: 0.98 }] };
export const KEYBOARD_SCROLL = {
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'on-drag',
} as const;
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const up = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setShown(true),
    );
    const down = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setShown(false),
    );
    return () => {
      up.remove();
      down.remove();
    };
  }, []);
  return shown;
}
export const FieldInBar = createContext<(() => () => void) | null>(null);
export function useFieldInBar(): void {
  const hold = useContext(FieldInBar);
  useEffect(() => hold?.(), [hold]);
}
