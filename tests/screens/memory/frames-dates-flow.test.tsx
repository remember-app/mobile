import { afterEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
// The keychain holds a session, so the provider signs in the way a launch does.
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  getItemAsync: async (key: string) => (key === 'session-token' ? 'session' : null),
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
// A phone's width, and the `Modal` as a plain container — the same stand-ins as the feed's own flow.
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => true }),
  };
});
vi.mock('@/screens/memory/films', () => ({ Films: () => null }));
vi.mock('@/screens/memory/frame-viewer', () => ({ FrameViewer: () => null }));
vi.mock('@/lib/downloads', () => ({
  maySaveToPhone: vi.fn(),
  saveToPhone: vi.fn(),
  shareFiles: vi.fn(),
}));
vi.mock('@/kit', async (original) => ({
  ...(await original<typeof import('@/kit')>()),
  Field: () => null,
}));

import { type Asked, later, member, memory, photo, refused, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { ReactNode } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ApiError } from '@/api';
import { DayMark, IconButton } from '@/kit';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Frames } from '@/screens/memory/frames';
import { ru } from '@/strings';

/**
 * «Даты между днями» as the account's one setting (TASK-292, spec 8 `MemoryDated` / `MemoryScrub`):
 * the real provider, two feeds of two memories open at once behind the gate, and the api stood in
 * for behind `fetch`. A change made anywhere — the account screen, later — is the provider's, and
 * both feeds turn with it without being opened again.
 */

mountsTrees();
afterEach(() => vi.unstubAllGlobals());

const ME = { id: 'me', username: 'me', name: 'Я', email: 'me@test.test', language: 'ru' };

/** Three days of September in each memory: the 13th, the 12th, the 11th. */
const at = (day: number) => new Date(2026, 8, day, 12).toISOString();
const shots = (memoryId: string) => [
  photo(`${memoryId}-a`, 'me', at(13)),
  photo(`${memoryId}-b`, 'me', at(12)),
  photo(`${memoryId}-c`, 'me', at(11)),
];

/** The api, holding the setting at `on`; a change is answered by `change` when the test gives one. */
function world(on: boolean, change?: () => unknown): Asked[] {
  let held = on;
  return serve((asked) => {
    if (asked.path === '/me' || asked.path === '/me/language') {
      return { ...ME, dates_between_days: held };
    }
    if (asked.path === '/me/dates-between-days') {
      if (change) return change();
      held = (asked.body as { dates_between_days: boolean }).dates_between_days;
      return { ...ME, dates_between_days: held };
    }
    const [, , memoryId, what] = asked.path.split('/');
    if (what === 'media') return shots(memoryId);
    if (what === 'members') return [member('me', 'organizer', { name: 'Я' })];
    if (what === 'labels') return [];
    return undefined;
  });
}

let auth!: ReturnType<typeof useAuth>;
/** The gate of `_layout.tsx`, as far as a feed is concerned: nothing behind it until the account is. */
function Gate({ children }: { children: ReactNode }) {
  auth = useAuth();
  return auth.status === 'ready' ? children : null;
}

async function open() {
  const head = (id: string) => ({ memory: memory({ id }), error: null, reload: () => {} });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <AuthProvider>
          <Gate>
            <Frames id="m1" head={head('m1')} />
            <Frames id="m2" head={head('m2')} />
          </Gate>
        </AuthProvider>,
      ),
    );
  });
  // The keychain, the account, then both feeds' reads.
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((done) => setImmediate(done));
    });
  }
  const feeds = () => tree.root.findAllByType(Frames);
  expect(feeds()).toHaveLength(2);
  return {
    /** How many day seams each open feed draws. */
    seams: () => feeds().map((feed) => feed.findAllByType(DayMark).length),
    /** Whether each feed's sort button wears its dot. */
    dots: () =>
      feeds().map(
        (feed) =>
          feed.findAllByType(IconButton).find((one) => one.props.label === ru.gallery.sorting)!
            .props.dot as boolean,
      ),
  };
}

test('with the setting on in the account, every feed writes the day over its strip', async () => {
  world(true);
  const screen = await open();
  expect(screen.seams()).toEqual([3, 3]);
  // The account's setting is no arrangement of a feed: no dot on either sort button.
  expect(screen.dots()).toEqual([false, false]);
});

test('turned on and off again, every open feed follows at once, without being opened again', async () => {
  const answered = later<void>();
  let answering: (() => Promise<unknown>) | undefined = async () => {
    await answered.promise;
    return { ...ME, dates_between_days: true };
  };
  const log = world(false, () => answering?.());
  const screen = await open();
  expect(screen.seams()).toEqual([0, 0]);

  let done!: Promise<void>;
  await act(async () => {
    done = auth.setDatesBetweenDays(true);
  });
  // Before the api has answered: the feeds turn with the switch, not a round trip later.
  expect(screen.seams()).toEqual([3, 3]);
  expect(log.filter((one) => one.path === '/me/dates-between-days')).toEqual([
    { method: 'POST', path: '/me/dates-between-days', body: { dates_between_days: true } },
  ]);
  await act(async () => {
    answered.settle();
    await done;
  });
  expect(screen.seams()).toEqual([3, 3]);

  answering = async () => ({ ...ME, dates_between_days: false });
  await act(() => auth.setDatesBetweenDays(false));
  expect(screen.seams()).toEqual([0, 0]);
  expect(screen.dots()).toEqual([false, false]);
});

test('a change the api refuses turns every feed back, and hands the caller the refusal', async () => {
  world(false, () => refused(500, 'internal server error'));
  const screen = await open();

  let reason: unknown;
  await act(async () => {
    reason = await auth.setDatesBetweenDays(true).then(
      () => null,
      (e: unknown) => e,
    );
  });
  expect(reason).toBeInstanceOf(ApiError);
  expect(screen.seams()).toEqual([0, 0]);
});
