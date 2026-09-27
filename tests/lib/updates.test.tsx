import { beforeEach, expect, test, vi } from 'vitest';

/**
 * `expo-updates` itself, stood in for by a fake `useUpdates` a test can push new states into —
 * the same shape `@expo-google-fonts/unbounded` gets in `root-layout.test.tsx`, because the real
 * hook is a subscription and there is no launch here to drive it. `vitest.setup.ts` stubs the
 * module for every other test with `isUpdatePending` nailed to `false`; this file needs it to
 * move, so it re-mocks the module for itself.
 */
type UpdateState = { isUpdatePending: boolean; checkError?: Error; downloadError?: Error };

const wait = vi.hoisted(() => ({ set: (_: UpdateState) => {} }));
const { reloadAsync } = vi.hoisted(() => ({ reloadAsync: vi.fn(async () => {}) }));

vi.mock('expo-updates', async () => {
  const { useState } = await import('react');
  return {
    useUpdates: () => {
      const [state, set] = useState<UpdateState>({ isUpdatePending: false });
      wait.set = set;
      return state;
    },
    reloadAsync,
  };
});

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import TestRenderer, { act } from 'react-test-renderer';
import { useLaunchUpdate } from '@/lib/updates';

mountsTrees();

beforeEach(() => {
  reloadAsync.mockClear();
  reloadAsync.mockImplementation(async () => {});
  vi.mocked(console.warn).mockClear();
});

async function launch() {
  function Probe() {
    useLaunchUpdate();
    return null;
  }
  await act(async () => {
    mounted(TestRenderer.create(<Probe />));
  });
  return { update: (state: UpdateState) => act(async () => wait.set(state)) };
}

test('an update downloaded before this launch restarts the app into it', async () => {
  const app = await launch();
  await app.update({ isUpdatePending: true });
  expect(reloadAsync).toHaveBeenCalledTimes(1);
});

test('a launch with nothing pending never restarts', async () => {
  await launch();
  expect(reloadAsync).not.toHaveBeenCalled();
});

test('a restart that fails is logged once and the app keeps running on the bundle it has', async () => {
  reloadAsync.mockRejectedValueOnce(new Error('disk full'));
  const app = await launch();
  await app.update({ isUpdatePending: true });
  // The rejection is handled inside the effect (a microtask past `reloadAsync` itself), so the
  // warning lands only after that promise has had a turn to settle.
  await act(async () => {});
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    'update fails to apply now, it runs from the next launch:',
    expect.objectContaining({ message: 'disk full' }),
  );
});

test('a check or download failure is logged once, not once per render that still carries it', async () => {
  const app = await launch();
  const error = new Error('offline');
  await app.update({ isUpdatePending: false, checkError: error });
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    'update does not come down, the app runs the bundle it has:',
    'offline',
  );

  // The state after a failure carries a fresh error object on every change (the doc comment on
  // the hook says so) — same message, new instance — and that must not log the failure again.
  await app.update({ isUpdatePending: false, checkError: new Error('offline') });
  expect(console.warn).toHaveBeenCalledTimes(1);
});
