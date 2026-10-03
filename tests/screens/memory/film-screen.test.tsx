import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { router, params } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => true },
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

import type { Asked } from '@tests/helpers/api';
import { member, memory, refused, serve } from '@tests/helpers/api';
import { entry, page, stage } from '@tests/helpers/journal';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { AppState } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { Member, Montage, MontageJournal, MontageStage } from '@/api';
import FilmScreen from '@/app/memory/[id]/montage/[montageId]/index';
import { Banner, Button, FilmStageList } from '@/kit';
import { makingTakes, minutesSince, WHILE_LIVE_MS } from '@/lib/montage/journal';
import { ru } from '@/strings';

/**
 * `Film` (spec 8) — one screen of a movie in each of its five states. What is asserted is what the
 * screen says in each and what it offers: the queue's place and what was ordered, the stage in hand
 * with its «Сейчас» card, the stopped film with «Повторить» for the organizer and the organizer's
 * name for everybody else, and the film that is ready leaving for its own page.
 *
 * The counters the api counts itself — «взял / мимо / мысли», «мимо» по причинам — are never
 * counted on the phone, so nothing here re-counts them either: the screen draws the rows the api
 * sent and the words it sends with them.
 */

mountsTrees();

beforeEach(() => {
  params.id = 'm1';
  params.montageId = 'f1';
  for (const fn of Object.values(router)) if ('mockClear' in fn) fn.mockClear();
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
  status: 'processing',
  name: 'Ролик для родителей',
  template: 'parents',
  size_bytes: null,
  duration_seconds: null,
  params: {
    target_seconds: 150,
    orientation: 'landscape',
    story_text: 'Для бабушек и дедушек: спокойно, тепло, без спешки.',
    music_tracks: ['warm'],
  },
  error_text: null,
  created_at: '2026-09-14T16:40:00Z',
  video_url: null,
  poster_url: null,
  photos: 168,
  videos: 46,
  stages: null,
  queue: null,
  ...over,
});

const ROSTER: Member[] = [
  member('me', 'organizer'),
  member('liza', 'contributor'),
  member('vera', 'viewer'),
];

/** One stage, with the counters the api counts itself already filled in. */
const row = (
  code: MontageStage['stage'],
  state: MontageStage['state'],
  over: Partial<MontageStage> = {},
): MontageStage => ({
  ...stage(code, state),
  // 4 + 2 + 2 minutes of what is left — the estimate the stage line adds up.
  // 4 + 2 + 2 minutes of what is left — the estimate the stage line adds up.
  eta_seconds: state === 'done' ? null : code === 'directing' ? 240 : 120,
  taken_count: code === 'directing' ? 23 : 0,
  skipped_count: code === 'directing' ? 38 : 0,
  thought_count: code === 'directing' ? 2 : 0,
  skipped_by_reason: code === 'directing' ? { duplicate: 24, left_out: 14 } : {},
  taken_by_part: code === 'directing' ? { '1': 14, '2': 9 } : {},
  total_count: code === 'directing' || code === 'prep' ? 214 : null,
  done_count: code === 'prep' ? 214 : code === 'directing' ? 61 : 0,
  outcome:
    code === 'prep'
      ? { photos: 168, videos: 46, video_seconds: 1420 }
      : code === 'analysis'
        ? { described: 120, earlier: 94 }
        : code === 'directing'
          ? { parts: [{ title: 'Сборы', from_seconds: 0, to_seconds: 24 }], frames: 61 }
          : {},
  ...over,
});

function world(
  montage: Montage,
  journal: Partial<MontageJournal> = {},
  over: { role?: 'organizer' | 'contributor' | 'viewer' } = {},
) {
  /** Flipped by the offline test: from here on the journal never answers. */
  const wire = { connected: true };
  const log = serve((one: Asked) => {
    if (one.path.includes('/journal') && !wire.connected) return 'offline';
    if (one.method === 'GET' && one.path === '/memories/m1/montages') return [montage];
    if (one.method === 'GET' && one.path === '/memories') {
      return [memory({ id: 'm1', role: over.role ?? 'organizer' })];
    }
    if (one.method === 'GET' && one.path === '/memories/m1/members') return ROSTER;
    if (one.method === 'GET' && one.path === '/memories/m1/montages/f1/journal') {
      return page([], {
        montage: { id: 'f1', status: montage.status },
        viewers: [{ id: 'liza', username: 'liza' }],
        ...journal,
      });
    }
    if (one.method === 'POST' && one.path === '/memories/m1/montages/f1/retry') {
      return film({ status: 'queued' });
    }
    if (one.method === 'GET' && one.path === '/memories') return [memory({ id: 'm1' })];
    if (one.method === 'GET' && /^[/]memories[/]m1[/]montages[/]f1[/]?$/.test(one.path)) {
      return refused(404, 'not found');
    }
    return undefined;
  });
  return { log, montage, wire };
}

/**
 * Everything the screen put on the page, as one string to look for words in — every text node in the
 * tree, in the order it stands. A screen's words are the only thing a test of what it says can read.
 */
function shown(tree: TestRenderer.ReactTestRenderer): string {
  const words: string[] = [];
  const walk = (node: { children?: unknown[] }) => {
    for (const child of node.children ?? []) {
      if (typeof child === 'string') words.push(child);
      else if (child) walk(child as { children?: unknown[] });
    }
  };
  walk(tree.toJSON() as unknown as { children?: unknown[] });
  return words.join(' ');
}

/**
 * One block of words as it stands on the page — the text of a single node, its own words joined with
 * nothing between them. `shown` joins every node with a space, which is right for looking for a word
 * somewhere and wrong for reading a sentence: a paragraph broken across nodes would come back with a
 * space where its own punctuation was.
 */
function paragraph(tree: TestRenderer.ReactTestRenderer, beginsWith: string): string {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') {
      if (node.startsWith(beginsWith)) found.push(node);
      return;
    }
    if (node && typeof node === 'object') {
      for (const child of (node as { children?: unknown[] }).children ?? []) walk(child);
    }
  };
  walk(tree.toJSON());
  return found.join('');
}

/** A screen mounted and left standing, the way every flow test here opens one. */
const open = async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<FilmScreen />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return mounted(tree);
};

test('в очереди: место в очереди и что заказано', async () => {
  const { log } = world(
    film({
      status: 'queued',
      queue: { ahead: 1, starts_in_minutes: 2, estimate_minutes: 14 },
    }),
  );

  const tree = await open();

  const page = shown(tree);
  expect(page).toContain('В очереди');
  // One sentence, joined the way the layout joins it: the last clause is the tail of the second
  // sentence and never a third one opening with a conjunction.
  expect(paragraph(tree, 'Перед нами')).toBe(
    'Перед нами ещё один ролик. Сборка начнётся примерно через 2 минуты и займёт около 14',
  );
  // What was ordered, out of what the order counted — never recounted here.
  expect(page).toContain('214');
  expect(page).toContain('168 фото · 46 видео');
  expect(page).toContain('2:30');
  expect(page).toContain('16:9');
  expect(page).toContain('горизонтально');
  expect(page).toContain('Тёплая');
  // The story the organizer typed, and the promise that watching is not required.
  expect(page).toContain('Для бабушек и дедушек');
  expect(page).toContain('Можно закрыть экран');
  // Nobody has started yet: no stage at all. Not five rows of «не начался», and not an outlined
  // card with nothing in it either — a thing on the screen that stands for nothing is not a thing.
  expect(page).not.toContain('Этап 1 из 5');
  expect(page).not.toContain('не начался');
  expect(tree.root.findAllByType(FilmStageList)).toHaveLength(0);
  expect(log.some((one) => one.path.includes('/journal'))).toBe(true);
});

test('собирается: этап N из 5, сколько осталось, «Сейчас» и итог пройденных', async () => {
  world(film({ status: 'processing' }), {
    stages: [
      row('prep', 'done'),
      row('analysis', 'done'),
      row('directing', 'running'),
      row('music', 'pending'),
      row('assembly', 'pending'),
    ],
    entries: [
      entry(1042, {
        stage: 'directing',
        media_id: 'f1.jpg',
        thought: 'Марк роняет кольцо — беру 3 секунды',
        decision: 'take',
        story_part: 2,
        story_part_title: 'Церемония',
      }),
    ],
    files: [
      {
        id: 'f1.jpg',
        kind: 'photo',
        uploaded_by: 'liza',
        file_name: 'IMG_2041.JPG',
        captured_at: '2026-09-14T12:00:00Z',
        duration_seconds: null,
        thumbnail_url: 'https://bucket.example/f1.jpg',
        places: [{ start_seconds: 12.5, duration_seconds: 3 }],
      },
    ],
  });

  const tree = await open();

  const page = shown(tree);
  // The stage line: which stage, where it is, and what is left of it.
  expect(page).toContain('Режиссура');
  expect(page).toContain('Этап 3 из 5');
  expect(page).toContain('осталось ≈ 8 мин');
  // The card «Сейчас» — who is working, and the sentence they are in the middle of.
  expect(page).toContain('Режиссёр');
  expect(page).toContain('думает над кадром');
  expect(page).toContain('СЕЙЧАС');
  expect(page).toContain('беру 3 секунды');
  // Every stage is named and none is a percentage.
  for (const name of ['Подготовка', 'Анализ', 'Режиссура', 'Музыка', 'Сборка']) {
    expect(page).toContain(name);
  }
  expect(page).not.toMatch(/\d+ ?%/);
  // A stage nobody has come to says so in words.
  expect(page).toContain('не начался');
});

test('не собрался: организатору — «Повторить», участнику — кто может', async () => {
  const stoppedJournal = {
    stages: [
      row('prep', 'done'),
      row('analysis', 'done'),
      row('directing', 'done'),
      row('music', 'failed', { outcome: { stopped: 'track_unreadable' } }),
      row('assembly', 'pending'),
    ],
  };

  const organizer = world(film({ status: 'failed' }), stoppedJournal, { role: 'organizer' });
  const tree = await open();

  const page = shown(tree);
  expect(page).toContain('Ролик не собрался');
  expect(page).toContain('Сборка остановилась на этапе «Музыка»');
  // The api's own code, in the app's own words — never a code shown raw.
  expect(page).toContain('остановился: трек не открылся');
  expect(page).not.toContain('track_unreadable');
  expect(page).toContain('не начался');
  // What a second attempt costs — the worker's own estimate of the five stages added up, since a
  // film that has left the queue has no `queue` to read an estimate from any more.
  expect(page).toContain('Соберём заново по тому же заказу');

  const retry = tree.root
    .findAllByType(Button)
    .find((one) => one.props.label === ru.montage.filmScreen.retry);
  expect(retry).toBeDefined();
  // A member is not offered a door they cannot open.
  expect(page).not.toContain('Организатор может запустить заново');
  void organizer;

  const member = world(film({ status: 'failed' }), stoppedJournal, { role: 'contributor' });
  const memberTree = await open();

  const memberPage = shown(memberTree);
  expect(memberPage).toContain('Организатор может запустить заново');
  expect(
    memberTree.root
      .findAllByType(Button)
      .some((one) => one.props.label === ru.montage.filmScreen.retry),
  ).toBe(false);
  void member;
});

test('нет связи: баннер сверху, а всё, что было прочитано, остаётся на месте', async () => {
  const { wire } = world(film({ status: 'processing' }), {
    stages: [
      row('prep', 'done'),
      row('analysis', 'done'),
      row('directing', 'running'),
      row('music', 'pending'),
      row('assembly', 'pending'),
    ],
    entries: [entry(1042, { stage: 'directing', media_id: 'f1.jpg', thought: 'беру кольцо' })],
    files: [
      {
        id: 'f1.jpg',
        kind: 'photo',
        uploaded_by: 'liza',
        file_name: 'IMG_2041.JPG',
        captured_at: '2026-09-14T12:00:00Z',
        duration_seconds: null,
        thumbnail_url: 'https://bucket.example/f1.jpg',
        places: [],
      },
    ],
  });

  // The screen polls on its own clock, and the poll is what turns a good connection into the word
  // «нет соединения» — so the clock is the test's here rather than waited on.
  vi.useFakeTimers();
  const tree = await open();
  expect(shown(tree)).toContain('СЕЙЧАС');

  wire.connected = false;
  await act(async () => {
    vi.advanceTimersByTime(WHILE_LIVE_MS + 100);
  });
  await act(async () => {
    await Promise.resolve();
  });

  const page = shown(tree);
  expect(tree.root.findAllByType(Banner).length).toBeGreaterThan(0);
  expect(page).toContain('Нет соединения');
  expect(page).toContain('Сборка на сервере идёт дальше');
  // What was read before the connection went is still there — a screen that emptied itself in a lift
  // would be throwing away the only account of the making anybody has.
  expect(page).toContain('беру кольцо');
  expect(page).toContain('Режиссура');
  // The card says how old what it is showing is — never «сейчас» over a connection that is gone,
  // and never a figure that was made up for the occasion.
  expect(page).not.toContain('СЕЙЧАС');
  expect(page).toMatch(/обновлено \d+ (мин|минуту|минуты|минут) назад/);

  vi.useRealTimers();
});

test('готов: экран уводит на страницу ролика, а не назад', async () => {
  world(film({ status: 'ready', video_url: 'https://r2.example/f1.mp4' }), {
    montage: { id: 'f1', status: 'ready' },
    stages: [
      row('prep', 'done'),
      row('analysis', 'done'),
      row('directing', 'done'),
      row('music', 'done'),
      row('assembly', 'done'),
    ],
  });

  await open();

  // A `replace`, so that pressing back does not pop the memory out from under anybody as well.
  const [call] = router.replace.mock.calls;
  expect(call[0]).toMatchObject({ pathname: '/memory/[id]/montage/[montageId]/film' });
  expect(router.back).not.toHaveBeenCalled();
});

test('вас нет в воспоминании: одно объявление, и опрос прекращается', async () => {
  serve((one) => {
    if (one.method === 'GET' && one.path === '/memories/m1/montages/f1/journal') {
      return refused(404, 'not found');
    }
    if (one.method === 'GET' && one.path === '/memories/m1/montages') {
      return [film({ status: 'processing' })];
    }
    if (one.method === 'GET' && one.path === '/memories') return [memory({ id: 'm1' })];
    if (one.method === 'GET' && one.path === '/memories/m1/members') return ROSTER;
    return undefined;
  });

  const tree = await open();

  const page = shown(tree);
  expect(page).toContain(ru.memory.gone);
  // Nothing of the film is drawn — no stages, no card, no button that could only be refused.
  expect(page).not.toContain('Режиссура');
  expect(tree.root.findAllByType(Button)).toHaveLength(0);
});

test('сколько займёт повтор — сумма оценок пяти этапов, а не ничего', () => {
  const eta = (seconds: number | null) => ({ ...stage('music', 'failed'), eta_seconds: seconds });
  // The five stages' own opening estimates, added up: the stages do not get longer by having run.
  expect(makingTakes([eta(60), eta(300), eta(240), eta(60), eta(180)])).toBe(14);
  // Not one stage carries an estimate — a figure rounded up from nothing is worse than no figure.
  expect(makingTakes([eta(null), eta(null)])).toBeNull();
  expect(makingTakes([])).toBeNull();
  // Seconds are rounded up the way «осталось ≈» is: a minute and a half left is «2 мин», never «1».
  expect(makingTakes([eta(90)])).toBe(2);
  expect(makingTakes([eta(1)])).toBe(1);
});

test('«обновлено N мин назад» — возраст того, что на карточке, а не выдуманное число', () => {
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();

  // The freshest record is first — that is the order the api hands them in.
  expect(minutesSince([{ created_at: at(7) }])).toBe(7);
  expect(minutesSince([{ created_at: at(1) }, { created_at: at(9) }])).toBe(1);
  // Forty seconds ago is a minute old as far as the words are concerned, and «сейчас» would be a lie.
  expect(minutesSince([{ created_at: at(0) }])).toBe(1);
  // Nothing on the card to be old — and a date the api never sent is not «сейчас».
  expect(minutesSince([])).toBeNull();
  expect(minutesSince([{ created_at: 'не дата' }])).toBeNull();
});

test('повтор организатора: та же строка встаёт в очередь заново, и журнал начинается с нуля', async () => {
  const { log } = world(film({ status: 'failed' }), {
    stages: [row('music', 'failed', { outcome: { stopped: 'internal' } })],
  });

  const tree = await open();

  const retry = tree.root
    .findAllByType(Button)
    .find((one) => one.props.label === ru.montage.filmScreen.retry);
  expect(retry).toBeDefined();

  await act(async () => {
    retry?.props.onPress();
    await Promise.resolve();
  });

  // The same row queued again — never a second one.
  expect(log.some((one) => one.method === 'POST' && one.path.endsWith('/retry'))).toBe(true);
  expect(log.some((one) => one.method === 'POST' && one.path === '/memories/m1/montages')).toBe(
    false,
  );
});

test('счётчики «взял / мимо / мысли» приходят от api и телефон их не пересчитывает', async () => {
  // 23 «беру» and 38 «мимо» across the whole directing stage, while the page handed over carries
  // exactly one record. A screen that counted what it held would say one, and would be wrong.
  world(film({ status: 'processing' }), {
    stages: [
      row('prep', 'done'),
      row('analysis', 'done'),
      row('directing', 'running'),
      row('music', 'pending'),
      row('assembly', 'pending'),
    ],
    entries: [entry(1042, { stage: 'directing', media_id: null, thought: 'беру кольцо' })],
  });

  const tree = await open();

  const page = shown(tree);
  // What the screen says about the stage in hand is the count of the stage, never of the page:
  // «61 из 214 разложено» is the api's own `done_count` of `total_count`.
  expect(page).toContain('61 из 214');
  expect(page).not.toContain('1 из 1');
});
