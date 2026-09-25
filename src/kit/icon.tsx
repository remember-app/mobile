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
 * The size to draw Lucide's `play` at so it lands on the layout's own triangle in a box of `box`
 * (spec 5 and 8). The layout draws `M8 5.2v13.6L19 12z` — 13.6 of the 24 grid tall — where Lucide's
 * runs 18 of it with a 2.1 stroke round it, so at the layout's box it reads half as big again: 11 in
 * the 16 of a track's «Послушать» (TASK-384), 6 in the 9 of the feed's running time.
 */
export const playFor = (box: number): number => Math.round((box * 13.6) / (18 + 2.1));

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
  stroke,
}: {
  icon: IconComponent;
  size?: number;
  /** Left off, it is drawn in whatever the theme reads in — `paper`. */
  color?: string;
  /** Spec 5: only three glyphs are ever filled — play, pause and the three dots of «ещё». */
  fill?: string;
  /** Only where the layout names a stroke of its own for the place (spec 8, detail 40). */
  stroke?: number;
}) {
  const { color } = useTheme();
  const paint = tint ?? color.paper;

  return (
    <Glyph
      size={size}
      color={paint}
      strokeWidth={stroke ?? strokeFor(size)}
      fill={fill ?? 'none'}
    />
  );
}
