import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
/**
 * The keychain: the session token this phone holds, and how many times it was told to let go. It
 * answers a beat later, as the native module does — not within the same breath as the request.
 */
const keychain = vi.hoisted(() => ({ token: null as string | null, deleted: 0 }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => (key === 'session-token' ? keychain.token : null),
  setItemAsync: async () => {},
  deleteItemAsync: async (key: string) => {
    await new Promise((done) => setImmediate(done));
    if (key !== 'session-token') return;
    keychain.token = null;
    keychain.deleted += 1;
  },
}));
vi.mock('expo-router', () => ({ useFocusEffect: () => {}, useIsFocused: () => true }));

import { AppState } from 'react-native';
import TestRenderer from 'react-test-renderer';

import { AuthProvider, useAuth, type AuthStatus } from '@/auth';
import { useMontageJournal, WHILE_LIVE_MS, type Standing } from '@/montage-journal';
import { mounted, mountsTrees } from '@/test-renderer';

import { act, BEAT_BY_BEAT, drives, settle } from './drive';
import { liveSteps, load, MEMORY, MONTAGE, PEOPLE, replay, TOKEN } from './recorded';

/**
 * The live journal read by the real session, over the recorded making (`README.md` beside this
 * file), when the session stops being honoured half way through: signed out on another phone,
 * revoked, past its thirty days. The session and the hook are the app's own; the journal answers
 * are the recording's until the api starts answering 401 — which is `refuse`, not words of the api.
 *
 * The screen is the hook read off a bare component, and the gate in `_layout.tsx` is stood in for by
 * its own table: the montage exists while the session is `ready`, and nothing but the way in after.
 */

mountsTrees();
drives();

/** Who the organizer's token is — not part of the recording, which never asked. */
const ME = { id: PEOPLE.organizer, username: 'anya', name: 'Аня Петрова', email: null, language: 'ru' };

beforeEach(() => {
  // react-native-web has no app state to subscribe to off a phone and hands back no subscription.
  vi.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: () => {} });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(AppState.addEventListener).mockRestore();
  vi.mocked(console.info).mockRestore();
});

test('a 401 on the live poll ends the session once, the journal is left for the way in, and nothing is asked again', BEAT_BY_BEAT, async () => {
  const steps = load('director');
  let revoked = false;
  const api = replay(steps, {
    only: liveSteps(steps).map((one) => one.name),
    extra: { '/me': ME, '/me/language': ME },
    refuse: () => (revoked ? 401 : undefined),
  });
  vi.stubGlobal('fetch', api.fetch);
  keychain.token = TOKEN.organizer;
  keychain.deleted = 0;

  /** Every render, in order: the journal's standing while it exists, the gate's status after. */
  const seen: (Standing | AuthStatus)[] = [];
  function Journal() {
    const { token } = useAuth();
    seen.push(useMontageJournal(token, MEMORY, MONTAGE).standing);
    return null;
  }
  function Gate() {
    const { status } = useAuth();
    if (status === 'ready') return <Journal />;
    seen.push(status);
    return null;
  }

  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(
      <AuthProvider>
        <Gate />
      </AuthProvider>,
    ));
  });
  await settle();
  const beat = async () => {
    await act(async () => {
      vi.advanceTimersByTime(WHILE_LIVE_MS);
    });
    await settle();
  };
  await beat();
  expect(seen.at(-1)).toBe('live');

  revoked = true;
  await beat();

  expect(seen.at(-1)).toBe('signed-out');
  expect(keychain).toEqual({ token: null, deleted: 1 });
  expect(console.info).toHaveBeenCalledTimes(1);

  const asked = api.calls;
  for (let i = 0; i < 5; i++) await beat();
  expect(api.calls).toBe(asked);
  expect(api.served.filter((one) => one.endsWith('(refused)'))).toHaveLength(1);

  // The 401 was never a lost connection nor «you are not in this memory» — not for one render.
  expect(seen).not.toContain('offline');
  expect(seen).not.toContain('refused');
  expect(api.unmatched).toEqual([]);
  await act(() => tree.unmount());
});
