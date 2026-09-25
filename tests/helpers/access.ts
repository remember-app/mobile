import { Pressable, StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { expect } from 'vitest';

/**
 * The floor of accessibility on a drawn screen (spec 1.6, 10.2, 10.3), read off the tree for every
 * control on it at once: each thing a finger can press says what kind of control it is, has a name a
 * screen reader can say, and — where its size is written down in numbers — is felt at 44 by 44 once
 * the transparent slop around it is counted. Size that comes from the layout engine (a row that
 * stretches) is not knowable in node and is left to the phone. Imported by `*.test.*` only.
 */

/** What a reader would say of a subtree: every string in it, less what is hidden from readers. */
const words = (node: ReactTestInstance): string => {
  const said: string[] = [];
  const walk = (one: ReactTestInstance | string) => {
    if (typeof one === 'string') return void said.push(one);
    const { accessibilityElementsHidden, importantForAccessibility } = one.props ?? {};
    if (accessibilityElementsHidden || importantForAccessibility === 'no-hide-descendants') return;
    for (const child of one.children) walk(child);
  };
  walk(node);
  return said.join(' ').trim();
};

const side = (style: Record<string, unknown>, ...keys: string[]) => {
  const found = keys.map((key) => style[key]).find((value) => typeof value === 'number');
  return found as number | undefined;
};

/** What one pressable is to a finger and to a reader. */
export type Target = {
  name: string;
  role: string | undefined;
  /** Felt width and height in points, or `undefined` where the layout decides. */
  width: number | undefined;
  height: number | undefined;
};

export function targets(root: ReactTestInstance): Target[] {
  return (
    root
      .findAllByType(Pressable)
      // A scrim is pressable for a finger and hidden from a reader on purpose (`Sheet`): its way out is the sheet's own.
      .filter(
        (one) =>
          typeof one.props.onPress === 'function' &&
          !one.props.accessibilityElementsHidden &&
          one.props.importantForAccessibility !== 'no-hide-descendants',
      )
      .map((one) => {
        const style = StyleSheet.flatten(
          typeof one.props.style === 'function'
            ? one.props.style({ pressed: false, hovered: false })
            : one.props.style,
        ) as Record<string, unknown>;
        const slop = one.props.hitSlop ?? {};
        const grow = (size: number | undefined, a: string, b: string) =>
          size === undefined ? undefined : size + (slop[a] ?? 0) + (slop[b] ?? 0);
        return {
          name: one.props.accessibilityLabel ?? words(one),
          role: one.props.accessibilityRole,
          width: grow(side(style, 'width'), 'left', 'right'),
          height: grow(side(style, 'height', 'minHeight'), 'top', 'bottom'),
        };
      })
  );
}

/** Every control on the screen has a role and a name, and none whose size is known is under 44. */
export function expectReachable(root: ReactTestInstance) {
  const found = targets(root);
  // A screen with nothing to press is a screen this was pointed at wrongly.
  expect(found.length).toBeGreaterThan(0);
  for (const one of found) {
    expect(one.role, `«${one.name}» has no role`).toBeTruthy();
    expect(one.name, 'a control with no name').not.toBe('');
    if (one.width !== undefined)
      expect(one.width, `«${one.name}» is ${one.width} wide`).toBeGreaterThanOrEqual(44);
    if (one.height !== undefined)
      expect(one.height, `«${one.name}» is ${one.height} high`).toBeGreaterThanOrEqual(44);
  }
  return found;
}
