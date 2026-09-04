import type { ComponentType } from 'react';

import { color } from '@/theme';

/**
 * Any icon from `lucide-react-native`. Typed by the props the kit actually sets rather than by
 * Lucide's own type, so nothing outside this file has to know where the icons come from.
 */
export type IconComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

/** The kit's `.ico` (20) and `.ico-s` (16). */
export const ICO = 20;
export const ICO_S = 16;

/**
 * One icon, drawn the one way the kit allows: Lucide at stroke 1.75. Every component goes through
 * this so the weight is set in a single place.
 *
 * An icon carries no label of its own — it is either inside something labelled (a button says what
 * it does) or beside the words it repeats, in which case the caller hides it from screen readers.
 */
export function Icon({
  icon: Glyph,
  size = ICO,
  color: tint = color.paper,
}: {
  icon: IconComponent;
  size?: number;
  color?: string;
}) {
  return <Glyph size={size} color={tint} strokeWidth={1.75} />;
}
