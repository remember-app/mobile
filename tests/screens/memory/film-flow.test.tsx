import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { router, params } = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    canGoBack: () => true,
    setParams: vi.fn(),
  },
  params: { id: 'm1', montageId: 'f1' },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useLocalSearchParams: () => params,
    useRouter: () => router,
  };
});
// The player is `expo-video` over a window of its own — not what this screen's own wiring is about.
vi.mock('@/screens/memory/film-player', () => ({
  FilmPlayer: () => null,
  useFilmActions: () => ({ busy: false, notice: null, run: async () => {} }),
}));
// `Field` mocked the way `profile-flow` and `invite-sheet-flow` do: a real `TextInput` with
// `autoFocus` under `react-test-renderer` is not what either of those tests are about, and it is not
// what this one is either — what is asserted is the value and the hint it is handed.
vi.mock('@/kit', async (original) => ({
  ...(await original<typeof import('@/kit')>()),
  Field: () => null,
}));

import type { Asked } from '@tests/helpers/api';
import { member, memory, refused, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { AppState } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { Member, Montage } from '@/api';
import FilmScreen from '@/app/memory/[id]/montage/[montageId]/film';
import { Banner, Button, ConfirmSheet, Field, GlassBar } from '@/kit';
import { FilmInfoSheet, FilmNameSheet } from '@/screens/memory/film-info';
import { ru } from '@/strings';

/**
 * `Film` (spec 8, `/memory/[id]/montage/[montageId]/film`) — the finished reel's own page. The real
 * api client over a stand-in server: what is asserted is the one write a finished film makes on its
 * own (`watched`), what renaming and deleting the film do to the screen, and who is shown either door.
 * The poster, the stages and the journal live on the neighbour screens and are read there
 * (`journal-screens.test.tsx`); this file is the one this screen had none of.
 */

mountsTrees();

beforeEach(() => {
  params.id = 'm1';
  params.montageId = 'f1';
  for (const fn of Object.values(router))
    if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear();
  // react-native-web has no app state to subscribe to off a phone and hands back no subscription.
  vi.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: () => {} });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const film = (over: Partial<Montage> = {}): Montage => ({
  id: 'f1',
  memory_id: 'm1',
  ordered_by: { id: 'me', username: 'me', name: null },
  status: 'ready',
  name: 'Ролик для родителей',
  template: null,
  size_bytes: null,
  duration_seconds: 150,
  params: {},
  error_text: null,
  created_at: new Date(2026, 8, 14, 12).toISOString(),
  video_url: 'https://r2.example/f1.mp4',
  poster_url: 'https://r2.example/f1.jpg',
  stages: [],
  ...over,
});

const ROSTER: Member[] = [
  member('me', 'organizer'),
  member('liza', 'contributor'),
  member('vera', 'viewer'),
];

type World = {
  log: Asked[];
  montage: Montage;
  onWatched?: unknown;
  onRename?: unknown;
  onDelete?: unknown;
};

function world(
  montage: Montage,
  over: Partial<Pick<World, 'onWatched' | 'onRename' | 'onDelete'>> & {
    role?: 'organizer' | 'contributor' | 'viewer';
    members?: Member[];
  } = {},
): World {
  const w: World = { montage, log: [], ...over };
  w.log = serve((one) => {
    if (one.method === 'GET' && one.path === '/memories/m1/montages') return [w.montage];
    if (one.method === 'GET' && one.path === '/memories') {
      return [memory({ id: 'm1', role: over.role ?? 'organizer' })];
    }
    if (one.method === 'GET' && one.path === '/memories/m1/members') return over.members ?? ROSTER;
    if (one.method === 'GET' && one.path === `/memories/m1/montages/${montage.id}/journal`) {
      return {
        montage: { id: montage.id, status: montage.status },
        stages: [],
        entries: [],
        has_more: false,
        files: [],
        viewers: [],
      };
    }
    if (one.method === 'POST' && one.path === `/memories/m1/montages/${montage.id}/watched`) {
      return w.onWatched ?? null;
    }
    if (one.method === 'PATCH' && one.path === `/memories/m1/montages/${montage.id}`) {
      return w.onRename ?? { ...w.montage, name: (one.body as { name: string }).name };
    }
    if (one.method === 'DELETE' && one.path === `/memories/m1/montages/${montage.id}`) {
      return w.onDelete ?? null;
    }
    return undefined;
  });
  return w;
}

async function open() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<FilmScreen />));
  });
  // A second turn of the microtask queue: the watched mark and the read it triggers are each a
  // promise chained off the one before, and one `act` does not necessarily chase both to the end.
  await act(async () => {});
  const root = tree.root;
  return {
    root,
    glass: () => root.findByType(GlassBar),
    infos: () => root.findAllByType(FilmInfoSheet),
    names: () => root.findAllByType(FilmNameSheet),
    confirm: () => root.findByType(ConfirmSheet),
    banners: () => root.findAllByType(Banner).map((one) => one.props.text as string),
    openInfo: () => act(async () => root.findByType(GlassBar).props.onCapsule?.()),
  };
}

test('a finished reel says «Посмотрел» exactly once when it is opened, and a reel still being made says nothing of the kind', async () => {
  const collecting = world(film({ status: 'processing', video_url: null, poster_url: null }));
  await open();
  expect(collecting.log.filter((one) => one.path.endsWith('/watched'))).toHaveLength(0);

  vi.unstubAllGlobals();
  const done = world(film({ status: 'ready' }));
  await open();
  expect(done.log.filter((one) => one.path.endsWith('/watched'))).toEqual([
    { method: 'POST', path: '/memories/m1/montages/f1/watched', body: null },
  ]);
});

test('renaming the reel updates its name on the screen and in the capsule; a refusal says why under the field, and the sheet stays open', async () => {
  const w = world(film());
  const screen = await open();
  await screen.openInfo();
  await act(async () => screen.infos()[0].props.onRename());
  expect(screen.names()).toHaveLength(1);

  await act(async () => screen.root.findByType(Field).props.onChangeText('Свадебный клип'));
  await act(async () =>
    screen.root
      .findAllByType(Button)
      .find((b) => b.props.label === ru.action.save)!
      .props.onPress(),
  );
  expect(w.log).toContainEqual({
    method: 'PATCH',
    path: '/memories/m1/montages/f1',
    body: { name: 'Свадебный клип' },
  });
  expect(screen.names()).toHaveLength(0);
  expect(screen.glass().props.title).toBe('Свадебный клип');

  vi.unstubAllGlobals();
  const refusing = world(film(), { onRename: refused(403, 'not yours') });
  const other = await open();
  await other.openInfo();
  await act(async () => other.infos()[0].props.onRename());
  await act(async () => other.root.findByType(Field).props.onChangeText('Другое имя'));
  await act(async () =>
    other.root
      .findAllByType(Button)
      .find((b) => b.props.label === ru.action.save)!
      .props.onPress(),
  );
  expect(refusing.log.filter((one) => one.method === 'PATCH')).toHaveLength(1);
  // The sheet stays up, the field says why, and the screen's own banner says nothing of it twice.
  expect(other.names()).toHaveLength(1);
  expect(other.root.findByType(Field).props.hint).toBe('not yours');
  expect(other.root.findByType(Field).props.state).toBe('error');
  expect(other.glass().props.title).toBe('Ролик для родителей');
  expect(other.banners()).not.toContain('not yours');
});

test('deleting the reel returns to the memory’s feed; a refusal keeps the reel and says so in a banner instead of closing quietly', async () => {
  const w = world(film());
  const screen = await open();
  await screen.openInfo();
  await act(async () => screen.infos()[0].props.onRemove());
  expect(screen.confirm().props.visible).toBe(true);
  await act(async () => screen.confirm().props.onConfirm());
  expect(w.log).toContainEqual({ method: 'DELETE', path: '/memories/m1/montages/f1', body: null });
  expect(router.back).toHaveBeenCalledTimes(1);

  vi.unstubAllGlobals();
  router.back.mockClear();
  const refusing = world(film(), { onDelete: refused(403, 'not yours to delete') });
  const other = await open();
  await other.openInfo();
  await act(async () => other.infos()[0].props.onRemove());
  await act(async () => other.confirm().props.onConfirm());
  expect(refusing.log.filter((one) => one.method === 'DELETE')).toHaveLength(1);
  // Not moved off the screen, and not left to guess why: the confirmation goes and a banner takes
  // its place rather than the screen falling quiet.
  expect(router.back).not.toHaveBeenCalled();
  expect(other.confirm().props.visible).toBe(false);
  expect(other.banners()).toContain('not yours to delete');
});

test('a viewer is shown neither «Переименовать» nor «Удалить» — both are the organizer’s alone', async () => {
  world(film(), { role: 'viewer' });
  const screen = await open();
  await screen.openInfo();
  expect(screen.infos()[0].props.mayEdit).toBe(false);
});
