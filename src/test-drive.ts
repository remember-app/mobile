import { act as reactAct } from 'react-test-renderer';
import { afterEach, beforeEach } from 'vitest';

/**
 * How a test that walks a screen through many clock beats drives its tree, so that one of them running
 * out of time is one failure and not thirty. Vitest cannot stop a test's body when its time is up: it
 * fails the test, runs the `afterEach` hooks and goes on to the next test — while the body is still
 * awaiting its `act`, moving the next test's fake clock and mixing its own `act` into the next test's.
 * React does not support two `act`s at once, and every test after a timeout then failed at once, for
 * as long as the leftover body kept running.
 *
 * So a test is stopped from the inside: every `act` here refuses to start once the test's signal is
 * aborted (which vitest does the moment the time is up), and `drives()` waits, before the next test
 * begins, for the `act` that was already running to finish. Used by `recorded-api/` and
 * `order-flow.test.tsx`, the two files whose tests are made of dozens of beats.
 */

/**
 * The time given to a test that walks a screen beat by beat — each beat is a clock tick and one or
 * six rounds of `act`, and there are dozens of them, or hundreds. Idle such a test takes 0.1–0.5 s; at
 * a load average of 50 the longest took 3.6 s and 5 s (vitest's own limit) was a coin toss. Twenty is
 * for those tests alone: a test that touches the tree once or twice keeps the default, and is seen to.
 */
export const BEAT_BY_BEAT = { timeout: 20_000 };

let signal: AbortSignal | undefined;
let running: Promise<unknown> = Promise.resolve();

/** `act` from the test renderer, that a test whose time is up cannot start another of. */
export function act(work: () => void | Promise<unknown>): Promise<void> {
  if (signal?.aborted) throw new Error('the test ran out of time; its leftover steps stop here');
  const done = Promise.resolve(reactAct(work as () => Promise<void>)).then(() => {});
  running = done.catch(() => {});
  return done;
}

/**
 * Once per test file, after the file's own hooks: it hands the test's signal to `act`, and holds the
 * run back until the `act` a timed-out test left running is over. After them, because hooks run in the
 * opposite order they are written, and this one has to be the first to run when the test ends — before
 * the trees are taken down and the clock is given back.
 */
export function drives() {
  beforeEach((context) => {
    signal = context.signal;
  });
  afterEach(async () => {
    await running;
    signal = undefined;
  });
}

/** Lets the requests that went out come back and the state they moved be drawn. */
export async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((done) => setImmediate(done));
    });
  }
}
