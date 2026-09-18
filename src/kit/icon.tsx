import type { ComponentType } from 'react';

import { useTheme } from '@/theme';

/**
 * Any icon from `lucide-react-native`. Typed by the props the library actually sets rather than by
 * Lucide's own type, so nothing outside this file has to know where the icons come from.
 */
export type IconComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}>;

/** The sizes the layout draws at (spec 5): in a bar, in a row, and on a mark over a photograph. */
export const ICO = 22;
export const ICO_S = 18;
export const ICO_XS = 13;

/**
 * Spec 5: one set, one grid — Lucide 24 × 24 — and the stroke thickens as the glyph shrinks, so a
 * 13px mark on a tile reads as firmly as a 24px glyph in a bar. That ratio is the whole reason this
 * component exists: set it per call site and the set stops looking like one set.
 */
export function strokeFor(size: number): number {
  if (size >= 24) return 1.5;
  if (size >= 20) return 1.75;
  if (size >= 16) return 2;
  return 2.1;
}

/**
 * One icon. An icon carries no label of its own — it is either inside something labelled (a button
 * says what it does) or beside the words it repeats, in which case the caller hides it from screen
 * readers.
 */
export function Icon({
  icon: Glyph,
  size = ICO,
  color: tint,
  fill,
}: {
  icon: IconComponent;
  size?: number;
  /** Left off, it is drawn in whatever the theme reads in — `paper`. */
  color?: string;
  /** Spec 5: only two glyphs are ever filled — the play triangle and the three dots of «ещё». */
  fill?: string;
}) {
  const { color } = useTheme();
  const paint = tint ?? color.paper;

  return (
    <Glyph size={size} color={paint} strokeWidth={strokeFor(size)} fill={fill ?? 'none'} />
  );
}
