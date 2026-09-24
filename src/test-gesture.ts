/**
 * A finger, as the responder system hands it to a `PanResponder` — enough of one for a test to drive
 * the handlers a component hangs on a view (`props.onResponderGrant` and its neighbours) without a
 * phone. What a gesture *means* is decided by the component; this only builds the touch. Imported by
 * `*.test.*` only.
 */

/** Every event a moment later than the last: the responder ignores a move with nothing new in it. */
let clock = 1;

export type Finger = {
  /** Where the finger is, measured against the view it is on (`locationX`) and the screen (`pageY`). */
  x?: number;
  y?: number;
  /** Where it was a moment ago — the difference is what a move adds to the gesture's `dx` and `dy`. */
  fromX?: number;
  fromY?: number;
};

/** One touch event with one finger down. A press has no `from`; a move has one. */
export function touch({ x = 0, y = 0, fromX = x, fromY = y }: Finger = {}) {
  clock += 1;
  return {
    nativeEvent: { locationX: x, locationY: y, pageX: x, pageY: y, touches: [{}] },
    touchHistory: {
      touchBank: [
        {
          touchActive: true,
          startPageX: fromX,
          startPageY: fromY,
          startTimeStamp: clock - 1,
          currentPageX: x,
          currentPageY: y,
          currentTimeStamp: clock,
          previousPageX: fromX,
          previousPageY: fromY,
          previousTimeStamp: clock - 1,
        },
      ],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: clock,
    },
  };
}
