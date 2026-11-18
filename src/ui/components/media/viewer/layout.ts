import { space } from '@/ui/theme';

export const STRIP_HEIGHT = 130;
export const STRIP_BREADTH = 40;
const STRIP_SHARE = 0.8;

type Insets = { top: number; bottom: number; left: number; right: number };

export type ViewerLayout = {
  hudTop: number;
  hudSide: number;
  stripHitBottom: number;
  stripHitHeight: number;
  stripInset: number;
  stripWidth: number;
  controlsBottom: number;
  controlsWidth: number;
};

/** Положение элементов просмотрщика считается здесь и нигде больше. */
export function viewerLayout(width: number, height: number, insets: Insets): ViewerLayout {
  const portrait = width <= height;
  const stripBottom = portrait ? insets.bottom + space.s2 : -20;
  const stripWidth = width * STRIP_SHARE;
  const stripHitBottom = stripBottom + (STRIP_HEIGHT - STRIP_BREADTH) / 2;
  const thumbTop = stripHitBottom + STRIP_BREADTH;

  return {
    hudTop: portrait ? 0 : space.s4 / 2,
    hudSide: portrait ? space.s4 : Math.max(insets.left, insets.right, space.s4) + space.s4 * 1.5,
    stripHitBottom,
    stripHitHeight: STRIP_BREADTH,
    stripInset: (width - stripWidth) / 2,
    stripWidth,
    controlsBottom: portrait ? STRIP_HEIGHT + space.s1 : thumbTop + space.s2,
    controlsWidth: width * (portrait ? 0.9 : STRIP_SHARE),
  };
}
