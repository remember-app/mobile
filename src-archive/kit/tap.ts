export const TAP = 44;
export function hitSlop(width: number, height = width) {
  const grow = (size: number) => Math.max(0, (TAP - size) / 2);
  return { left: grow(width), right: grow(width), top: grow(height), bottom: grow(height) };
}
