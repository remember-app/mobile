import { act as reactAct } from 'react-test-renderer';
import { afterEach, beforeEach } from 'vitest';

/**
 * How the tests beside this file drive a tree, so that one of them running out of time is one failure
 * and not thirty. Vitest cannot stop a test's body when its time is up: it fails the test, runs the
 * `afterEach` hooks and goes on to the next test — while the body is still awaiting its `act`, moving
 * the next test's fake clock and mixing its own `act` into the next test's. React does not support
 * two `act`s at once, and every test after a timeout then failed at once, for as long as the leftover
 * body kept running.
 *
 * So a test is stopped from the inside: every `act` here refuses to start once the test's signal is
 * aborted (which vitest does the moment the time is up), and `drives()` waits, before the next test
 * begins, for the `act` that was already running to finish.
 */

/**
 * The time given to a test that sits through a making beat by beat — each beat is a clock tick and six
 * rounds of `act`, and there are dozens of them. Idle it takes 0.1 s; at a load average of 50 the
 * longest took 3.6 s, and vitest's own five seconds is a coin toss there. Twenty is for those tests
 * alone: a test that touches the tree once or twice keeps the default, and is seen to.
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
 * Once, at the top of a test file: hooks that hand the test's signal to `act`, and that hold the run
 * back until the `act` a timed-out test left running is over. Registered after `mountsTrees()`, so it
 * runs first when the test ends and the trees are taken down only when nothing is drawing in them.
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
