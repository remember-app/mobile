import { afterEach, expect, test, vi } from 'vitest';

import app from '../app.json';
import layout from './app/_layout.tsx?raw';
import films from './memory/films.tsx?raw';
import frames from './memory/frames.tsx?raw';

// `expo-screen-orientation` is a native module and does not exist under vitest, so the module under
// test cannot be imported without one standing in — `downloads.test.ts` mocks its two expo modules
// the same way. `PORTRAIT_UP` is a sentinel and not the enum's real number: what matters is that the
// lock is handed the module's own portrait constant, not that the constant happens to be 3.
const { lockAsync, unlockAsync, effects } = vi.hoisted(() => ({
  lockAsync: vi.fn(async () => {}),
  unlockAsync: vi.fn(async () => {}),
  effects: [] as (() => void | (() => void))[],
}));

vi.mock('expo-screen-orientation', () => ({
  lockAsync,
  unlockAsync,
  OrientationLock: { PORTRAIT_UP: 'portrait-up' },
}));

// The hook is one `useEffect`, and there is no renderer here to run it (`screen-theme.test.ts` says
// why: these are expo-router screens on a phone). So react's own scheduling is what stands in —
// `useEffect` collects the effect, and `viewer()` below fires it and hands back the cleanup exactly
// as react would on the next change of `open`.
vi.mock('react', () => ({ useEffect: (run: () => void | (() => void)) => effects.push(run) }));

const { useTurnsWithPhone } = await import('@/orientation');

/** A viewer mounted open or closed. Returns what react would call when it stops being that. */
function viewer(open: boolean) {
  useTurnsWithPhone(open);
  const run = effects.pop();
  if (run === undefined) throw new Error('the hook registered no effect');
  return run();
}

afterEach(() => {
  vi.clearAllMocks();
  effects.length = 0;
});

test('the app is no longer nailed to portrait natively', () => {
  // The whole reason the two modals' `supportedOrientations` did nothing: this line is compiled into
  // Info.plist and the Android manifest, above anything the js below can ask for.
  expect(app.expo.orientation).toBe('default');
});

test('an open viewer follows the phone, and closing it puts the app back in portrait', () => {
  const close = viewer(true);

  expect(unlockAsync).toHaveBeenCalledTimes(1);
  expect(lockAsync).not.toHaveBeenCalled();

  close?.();
  expect(lockAsync).toHaveBeenCalledWith('portrait-up');
});

test('a closed viewer does not touch the orientation at all', () => {
  // Nothing on the way in and nothing to undo on the way out: the app is already portrait, and a
  // face re-rendering with its modal shut must not re-issue the lock on every keystroke.
  expect(viewer(false)).toBeUndefined();
  expect(unlockAsync).not.toHaveBeenCalled();
  expect(lockAsync).not.toHaveBeenCalled();
});

test('portrait is set as the app comes up, and lifted by the two viewers only', () => {
  // Read off the source, the way the theme rule is: what breaks the acceptance criteria is not the
  // hook going wrong, it is the root call being dropped (every screen then free to turn) or a third
  // place picking the hook up (something other than a full-screen viewer turning with the phone).
  expect(layout).toContain('lockPortrait()');
  expect(frames).toContain('useTurnsWithPhone(shown !== null)');
  expect(films).toContain('useTurnsWithPhone(watching !== null)');

  const users = Object.values(
    import.meta.glob<string>('./{app,memory,kit}/**/*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).filter((source) => source.includes('useTurnsWithPhone('));
  expect(users).toHaveLength(2);
});
