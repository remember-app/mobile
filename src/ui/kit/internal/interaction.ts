import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { AccessibilityInfo, type ViewStyle } from 'react-native';
import { themed } from '@/ui/theme';

export { hitSlop, TAP } from './tap';

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
export const FieldInBar = createContext<(() => () => void) | null>(null);
export function useFieldInBar(): void {
  const hold = useContext(FieldInBar);
  useEffect(() => hold?.(), [hold]);
}
