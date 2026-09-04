/**
 * The kit's floor for a touch target, and the math that grows a control drawn smaller up to it.
 * Pure and free of any React Native import on purpose: `interaction.ts` pulls in `react-native` at
 * module scope (for `AccessibilityInfo`, `Animated`), which a plain Node test cannot parse — this
 * one stays importable from a test with no renderer and no mocking.
 */

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
