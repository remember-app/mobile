/**
 * What the three ways back of the product agree on (TASK-477) — a finger in from the left edge of
 * the screen, a finger down from the top of a photograph, and a sheet let go by its handle.
 *
 * Pure, and free of any `react-native` import on purpose, for the reason `kit/tap.ts` gives: this
 * file is arithmetic a plain node test reads with no renderer and no phone, and the three callers
 * that hang the answers on their own responders are a screen, a window over one, and a kit part —
 * none of which should have to agree with the others on a number.
 *
 * Every one of them asks the same two questions of the same drag, in the same order: has it gone
 * far enough to be a gesture rather than a drift (asked while the finger is still down, so the
 * gesture can be taken off whatever is under it), and did it go far enough to mean something (asked
 * when it lifts, because a finger that came back is «I changed my mind»). Splitting those two is
 * what lets the strip at the edge be narrow and still take the gesture before a horizontal scroll
 * underneath it does.
 */

import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';

/**
 * What a drag has come to, as `PanResponder` counts it: where it began, how far it has come, and
 * how fast it is falling — the last read only by {@link letGo}, and carried here rather than asked
 * for separately so that one `gestureState` is all three answers are worked out of.
 */
export type Drag = { x0: number; y0: number; dx: number; dy: number; vy: number };

/**
 * How far a finger has to come before the app believes it is a gesture and not the wander of a hand
 * resting on a phone. Below it nothing is claimed and whoever is under the finger keeps it.
 */
export const SIDEWAYS = 12;

/**
 * And how far in all, for a lift to mean it rather than «I changed my mind» — the same 56 the
 * window already asks of a finger before it walks to the next frame (TASK-182).
 */
export const GO = 56;

/**
 * How wide a strip of the left edge answers a finger at all. Narrow on purpose: the product has
 * horizontal gestures of its own everywhere — the strip of neighbours, the scrubber above it, every
 * sideways scroll in the feed — and a back that answered a thumb's worth of the screen would take
 * them all from it. This is the width of the platform's own back gesture, which is the one number
 * a person who has used any other phone already has the muscle memory for.
 */
export const EDGE = 24;

/**
 * How far down a sheet has to come before it lets go of its handle — further than {@link GO},
 * because a sheet that lets go of a short drag is closed by every scroll that was meant to stay
 * inside it.
 */
export const DROP = 120;

/**
 * How fast a finger has to be falling, in points a millisecond, for the distance not to matter: a
 * flick is a flick however short the throw, and a finger that has fallen this fast is not about to
 * be caught.
 */
export const FALL = 0.5;

/**
 * How much of the window down a drag has to begin in to be one that means «back» rather than one
 * that happens to be going down. The upper third, and no further: everything below it is either the
 * picture, whose own gestures are sideways, or the tools along the foot — whose horizontal drags a
 * downward one would otherwise take away from them.
 */
export const TOP = 0.35;

/**
 * Whether a drag that began in the strip at the left edge has gone back, as far as `over`.
 *
 * The horizontal test is not decoration: the corner of the screen is where a diagonal comes from,
 * and a back that answered to that would answer to a scroll that started at the edge and went up.
 *
 * `>=` and not `>`, so that a finger which came exactly as far as it was asked to counts as having
 * come that far — the same arithmetic the window already uses to decide a swipe walks the gallery.
 */
export function edgeBack(g: Drag, over = SIDEWAYS): boolean {
  return g.x0 <= EDGE && g.dx >= over && g.dx > Math.abs(g.dy);
}

/**
 * Whether a drag that began in the top `band` of the window has gone down, as far as `over` — the
 * answer a full-screen photograph gives, where sideways means «the next one» and down means «back».
 */
export function topDown(g: Drag, band: number, over = SIDEWAYS): boolean {
  return g.y0 <= band && g.dy >= over && g.dy > Math.abs(g.dx);
}

/**
 * Whether a sheet is being let go of: dragged far enough down, or let go of while falling fast
 * enough that catching it was never what the finger meant.
 */
export function letGo(g: Drag): boolean {
  return g.dy >= DROP || g.vy >= FALL;
}

/**
 * The app's own way back — a finger in from the left edge of the screen (TASK-477) — hung once on
 * the view every screen stands inside, so that a person who has learned it on one screen has it on
 * every one. The alternative, hanging it per screen, is the thing this module exists to stop: the
 * strip, the thresholds and the two questions below would then be written out once per screen and
 * would drift apart the first time one of them was tuned.
 *
 * Two questions, asked at the two moments they can be. While the finger is down, `edgeBack`
 * decides whether the gesture is ours at all — asked in the *capture* phase, which the responder
 * system runs from the root down, so the strip takes the drag off a horizontal scroll underneath it
 * before that scroll claims it. When it lifts, the same question with {@link GO} decides whether it
 * meant anything: a finger that came back to where it began never asked for a route change.
 *
 * Where the finger went down is remembered from the touch itself rather than read off the gesture:
 * `PanResponder` writes `x0` only once a view has *become* the responder, which is the answer this
 * hook is trying to decide in the first place. A finger that goes down anywhere at all answers
 * `onStartShouldSetResponderCapture` on the way past, and this is where it is written down — while
 * the hook still says no, and the scroll or the button under it gets the touch.
 */
export function useEdgeBack(
  back: () => void,
): ReturnType<typeof PanResponder.create>['panHandlers'] {
  // Built once and never rebuilt: the responder keeps how far the finger has come inside the object
  // `create` hands back, and the root layout re-renders under every launch and every upload.
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
        // A finger that is ours stays ours: a scroll that has not begun scrolling yet asks to take
        // it over (`ScrollView`), and this is the answer that says no.
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, g) => {
          if (edgeBack({ ...g, x0: from.current }, GO)) now.current();
        },
      }).panHandlers,
    [],
  );
}
