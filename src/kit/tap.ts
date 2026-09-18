/**
 * The floor for a touch target, and the math that grows a control drawn smaller up to it. Pure and
 * free of any React Native import on purpose: `interaction.ts` pulls in `react-native` at module
 * scope (for `AccessibilityInfo`, `Animated`), which a plain Node test cannot parse — this one
 * stays importable from a test with no renderer and no mocking.
 */

/** Spec 1.6: a touch target is never under 44, however small the glyph on it is drawn. */
export const TAP = 44;

/**
 * The slop that grows a control drawn smaller than 44×44 up to it — spec 10.2, which settles every
 * such place in the layout at once: the visible size stays as drawn, the target grows out to 44 in
 * transparent padding. The 36 cross in a row gets 4 on each side, the 32 «скрыть сообщение» gets 6.
 */
export function hitSlop(width: number, height = width) {
  const grow = (size: number) => Math.max(0, (TAP - size) / 2);
  return { left: grow(width), right: grow(width), top: grow(height), bottom: grow(height) };
}
