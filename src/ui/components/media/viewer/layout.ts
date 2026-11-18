import { space } from '@/ui/theme';

export const STRIP_HEIGHT = 130;
export const STRIP_BREADTH = 32;
export const STRIP_SELECTED = 34;
export const STRIP_UNSELECTED = 24;
export const STRIP_GAP = 4;
export const STRIP_CENTER_PUSH = 12;
export const STRIP_PITCH = STRIP_UNSELECTED + STRIP_GAP;
const STRIP_SHARE = 0.8;

type Insets = { top: number; bottom: number; left: number; right: number };

export type ViewerLayout = {
  hudTop: number;
  hudSide: number;
  stripHitBottom: number;
  stripHitHeight: number;
  stripWidth: number;
  controlsBottom: number;
  controlsWidth: number;
};

/** Положение элементов просмотрщика считается здесь и нигде больше. */
export function viewerLayout(width: number, height: number, insets: Insets): ViewerLayout {
  const portrait = width <= height;
  const stripBottom = portrait ? insets.bottom + space.s2 : -20;
  const available = width * STRIP_SHARE;
  const steps = Math.max(1, Math.floor((available - STRIP_CENTER_PUSH * 2) / (STRIP_PITCH * 2)));
  const stripWidth = (steps * STRIP_PITCH + STRIP_CENTER_PUSH) * 2;
  const stripHitBottom = stripBottom + (STRIP_HEIGHT - STRIP_BREADTH) / 2;
  const thumbTop = stripHitBottom + STRIP_BREADTH;

  return {
    hudTop: portrait ? 0 : space.s4 / 2,
    hudSide: portrait ? space.s4 : Math.max(insets.left, insets.right, space.s4) + space.s4 * 1.5,
    stripHitBottom,
    stripHitHeight: STRIP_BREADTH,
    stripWidth,
    controlsBottom: portrait ? STRIP_HEIGHT + space.s1 : thumbTop + space.s2,
    controlsWidth: width * (portrait ? 0.9 : STRIP_SHARE),
  };
}
