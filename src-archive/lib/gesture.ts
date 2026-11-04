import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';
export type Drag = {
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  vy: number;
};
export const SIDEWAYS = 12;
export const GO = 56;
export const EDGE = 24;
export const DROP = 120;
export const FALL = 0.5;
export function edgeBack(g: Drag, over = SIDEWAYS): boolean {
  return g.x0 <= EDGE && g.dx >= over && g.dx > Math.abs(g.dy);
}
export function topDown(g: Drag, band: number, over = SIDEWAYS): boolean {
  return g.y0 <= band && g.dy >= over && g.dy > Math.abs(g.dx);
}
export function letGo(g: Drag): boolean {
  return g.dy >= DROP || g.vy >= FALL;
}
export function useEdgeBack(
  back: () => void,
): ReturnType<typeof PanResponder.create>['panHandlers'] {
  const now = useRef(back);
  now.current = back;
  const from = useRef(0);
  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (event) => {
          from.current = event.nativeEvent.pageX;
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_, g) => edgeBack({ ...g, x0: from.current }),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, g) => {
          if (edgeBack({ ...g, x0: from.current }, GO)) now.current();
        },
      }).panHandlers,
    [],
  );
}
