import { space } from '@/ui/theme';

export const STRIP_HEIGHT = 130;
export const STRIP_BREADTH = 40;
const STRIP_SHARE = 0.8;

type Insets = { top: number; bottom: number; left: number; right: number };

export type ViewerLayout = {
  hudTop: number;
  hudSide: number;
  stripBottom: number;
  stripInset: number;
  stripWidth: number;
  controlsBottom: number;
  controlsWidth: number;
};

/** Положение элементов просмотрщика считается здесь и нигде больше. */
export function viewerLayout(width: number, height: number, insets: Insets): ViewerLayout {
  const portrait = width <= height;
  const hudTop = portrait ? 0 : space.s4 / 2;
  const stripBottom = portrait ? insets.bottom + space.s2 : hudTop;
  const stripWidth = width * STRIP_SHARE;

  return {
    hudTop,
    hudSide: portrait ? space.s4 : Math.max(insets.left, insets.right, space.s4) + space.s4 * 1.5,
    stripBottom,
    stripInset: (width - stripWidth) / 2,
    stripWidth,
    controlsBottom: stripBottom + STRIP_HEIGHT + space.s1,
    controlsWidth: width * (portrait ? 0.9 : STRIP_SHARE),
  };
}
