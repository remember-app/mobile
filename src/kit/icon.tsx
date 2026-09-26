import { FileText, Heart, House, Pencil, Zap } from 'lucide-react-native';
import type { ComponentProps, ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

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
 * Lucide's glyph drawn the way the layout draws its own, tighter one of the same thing (spec 5). The
 * layout keeps Lucide's names and its 24 grid but draws some glyphs from paths of its own that reach
 * less far across the grid. `share` is how much of Lucide's reach the layout's covers, across and down
 * together: the glyph is drawn that much smaller, centred in the box it was asked for, at the stroke
 * weight it was asked for. So a place names the box and the stroke the layout names, and the ink lands
 * where the layout's does, while the box — and whatever stands beside it — stays where it is.
 *
 * The drawing is a whole size: at 14.7 the phone set the house as if at 14, a point short of where it
 * was meant to land on either side (measured on the iOS simulator, TASK-398).
 */
export function drawnAs(Glyph: IconComponent, share: number): IconComponent {
  function Drawn({ size = ICO, strokeWidth, ...paint }: ComponentProps<IconComponent>) {
    const drawn = Math.round(size * share);
    return (
      <View style={[box.centre, { width: size, height: size }]}>
        <Glyph
          size={drawn}
          strokeWidth={strokeWidth === undefined ? undefined : (strokeWidth * size) / drawn}
          {...paint}
        />
      </View>
    );
  }
  return Drawn;
}

/**
 * The layout's own drawings, each over the Lucide glyph it stands for — extents in the 24 grid, the
 * layout's across + down over Lucide's, off the paths themselves (TASK-398):
 *
 * - the template signs of `MontageTemplate`, the plate over the story and the summary's poster — the
 *   heart `M12 20s-7-4.4-7-10…` 14 × 14 against Lucide's 20 × 17, the bolt `M13 3 5 13h6l-1 8…` 13 × 18
 *   against 16 × 20, the page `rect 5 3 14 18` 14 × 18 against 16 × 20, the house `M3 11 12 4l9 7…`
 *   18 × 16 against 18 × 19; the sun is Lucide's own and the phone is a drawing of its own
 *   (`smartphone-play`, not in Lucide 1.41), so neither is here;
 * - the pen of every «править» — `M12 20h9` under `M16.5 3.5…L7 19l-4 1 1-4Z`, 18 × 17 against
 *   Lucide's pencil, 20 × 20.
 */
export const DRAWN = {
  heart: drawnAs(Heart, (14 + 14) / (20 + 17)),
  zap: drawnAs(Zap, (13 + 18) / (16 + 20)),
  fileText: drawnAs(FileText, (14 + 18) / (16 + 20)),
  house: drawnAs(House, (18 + 16) / (18 + 19)),
  pen: drawnAs(Pencil, (18 + 17) / (20 + 20)),
} as const;

const box = StyleSheet.create({ centre: { alignItems: 'center', justifyContent: 'center' } });

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
