import { expect, test } from 'vitest';

import { DROP, type Drag, EDGE, edgeBack, GO, letGo, topDown } from '@/lib/gesture';

/**
 * The three ways back (TASK-477), and only the arithmetic they agree on: what counts as having
 * begun in the strip at the edge, what counts as having come far enough to mean it, and the same
 * two questions of a finger that goes down over a photograph rather than at the side of the screen.
 *
 * `useEdgeBack` and the two responders that hang these answers on their own views are driven through
 * the handlers a real render hangs on them — in `tests/routes/edge-back.test.tsx`,
 * `tests/screens/memory/frame-viewer-gestures.test.tsx` and `tests/kit/sheet-drag.test.tsx`. What is
 * here is the part a view cannot say: the numbers themselves.
 */

/** A drag as `PanResponder` counts it, and no more than a test cares to spell out. */
const drag = (over: Partial<Drag> = {}): Drag => ({
  x0: 0,
  y0: 0,
  dx: 0,
  dy: 0,
  vy: 0,
  ...over,
});

test('the edge is the platform’s own width, not a thumb’s', () => {
  // The horizontal gestures the product is full of — the strip of neighbours, the scrubber above
  // it, every sideways scroll in the feed — start at the left edge of their own. A strip wider
  // than this takes them from it (the m-33 notes), and this is the number that keeps it from doing
  // so: the platform's own back gesture, which is what a person's thumb is already aimed at.
  expect(EDGE).toBe(24);
});

test('a finger only means back from the strip at the edge, and only going sideways', () => {
  // Inside the strip, and plainly to the right.
  expect(edgeBack(drag({ x0: 0, dx: 100 }))).toBe(true);
  expect(edgeBack(drag({ x0: EDGE, dx: 100 }))).toBe(true);
  // A point past it: this is a scroll that began near the left, not a way back.
  expect(edgeBack(drag({ x0: EDGE + 1, dx: 100 }))).toBe(false);
  expect(edgeBack(drag({ x0: 200, dx: 100 }))).toBe(false);
  // A wander is not a gesture.
  expect(edgeBack(drag({ x0: 0, dx: 11 }))).toBe(false);
  // And a diagonal out of the corner is a scroll going up the screen, not a way back — the one
  // case where the narrow strip alone would have been wrong.
  expect(edgeBack(drag({ x0: 0, dx: 100, dy: 120 }))).toBe(false);
  expect(edgeBack(drag({ x0: 0, dx: 100, dy: -120 }))).toBe(false);
  // Level with it, either way round, is level: it goes back.
  expect(edgeBack(drag({ x0: 0, dx: 100, dy: 0 }))).toBe(true);
});

test('a lift means it only when the finger came far enough — the same 56 the gallery asks of a swipe', () => {
  // The second question, at the moment the finger lifts: 56 in all is what «назад» costs.
  expect(edgeBack(drag({ x0: 0, dx: GO }), GO)).toBe(true);
  expect(edgeBack(drag({ x0: 0, dx: GO - 1 }), GO)).toBe(false);
  // Coming back to where it began never asked for a route change, however far it went first.
  expect(edgeBack(drag({ x0: 0, dx: 300 }), GO)).toBe(true);
});

test('over a photograph down is back and sideways is the next frame, and where it began tells them apart', () => {
  const band = 300;
  // Begun in the upper third and falling: back.
  expect(topDown(drag({ y0: 100, dy: 120 }), band)).toBe(true);
  expect(topDown(drag({ y0: band, dy: 120 }), band)).toBe(true);
  // Begun below it and falling: nothing — that is the strip of neighbours and the scrubber, whose
  // own drags are sideways, and a downward one would take them away.
  expect(topDown(drag({ y0: band + 1, dy: 120 }), band)).toBe(false);
  // A finger falling in the upper third and going sideways at the same time is walking the gallery.
  expect(topDown(drag({ y0: 100, dy: 120, dx: 200 }), band)).toBe(false);
  expect(topDown(drag({ y0: 100, dy: 120, dx: -200 }), band)).toBe(false);
  // And a wander is still a wander.
  expect(topDown(drag({ y0: 100, dy: 11 }), band)).toBe(false);
  // Enough of it, and it means it.
  expect(topDown(drag({ y0: 100, dy: GO }), band, GO)).toBe(true);
  expect(topDown(drag({ y0: 100, dy: GO - 1 }), band, GO)).toBe(false);
});

test('a sheet lets go of a long drag or a short fast one, and holds onto neither a short slow one nor a flick up', () => {
  // Further than a gallery swipe, because a sheet that let go of a short drag would be closed by
  // every scroll meant to stay inside it.
  expect(DROP).toBeGreaterThan(GO);
  expect(letGo(drag({ dy: DROP }))).toBe(true);
  expect(letGo(drag({ dy: DROP - 1 }))).toBe(false);
  // A flick is a flick however short the throw.
  expect(letGo(drag({ dy: 20, vy: 0.6 }))).toBe(true);
  expect(letGo(drag({ dy: 20, vy: 0.49 }))).toBe(false);
  // And a finger that flung upwards is not on its way out of the sheet.
  expect(letGo(drag({ dy: -300, vy: -2 }))).toBe(false);
});
