/**
 * A finger, as the responder system hands it to a `PanResponder` — enough of one for a test to drive
 * the handlers a component hangs on a view (`props.onResponderGrant` and its neighbours) without a
 * phone. What a gesture *means* is decided by the component; this only builds the touch. Imported by
 * `*.test.*` only.
 */

/**
 * Every event a moment later than the last: the responder ignores a move with nothing new in it.
 * Module-level on purpose — one finger, one clock, across every event of every gesture in a file.
 */
let clock = 1;

export type Finger = {
  /** Where the finger is, measured against the view it is on (`locationX`) and the screen (`pageY`). */
  x?: number;
  y?: number;
  /** Where it was a moment ago — the difference is what a move adds to the gesture's `dx` and `dy`. */
  fromX?: number;
  fromY?: number;
  /**
   * How long the finger took to get here, in milliseconds. `PanResponder` divides the movement by
   * this to work out how fast the finger is going, so a gesture that means to be slow has to say
   * so: one millisecond between events — what the rest of this file does by default, because it is
   * only ever about *where* a finger went — makes every drag a violent flick.
   */
  over?: number;
};

/**
 * A fresh finger, put down now: the clock back to where it started and the events from here on a
 * gesture of their own. A test that drives one whole gesture per `touch()` chain wants this between
 * chains — without it the elapsed time a `PanResponder` divides by is measured from the last gesture
 * in the file, and a flick of thirty points reads as a drag because it was counted as slow.
 */
export function restFinger(): void {
  clock = 1;
}

/** One touch event with one finger down. A press has no `from`; a move has one. */
export function touch({ x = 0, y = 0, fromX = x, fromY = y, over = 1 }: Finger = {}) {
  const from = clock;
  clock += over;
  return {
    nativeEvent: { locationX: x, locationY: y, pageX: x, pageY: y, touches: [{}] },
    touchHistory: {
      touchBank: [
        {
          touchActive: true,
          startPageX: fromX,
          startPageY: fromY,
          startTimeStamp: from,
          currentPageX: x,
          currentPageY: y,
          currentTimeStamp: clock,
          previousPageX: fromX,
          previousPageY: fromY,
          previousTimeStamp: from,
        },
      ],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: clock,
    },
  };
}
