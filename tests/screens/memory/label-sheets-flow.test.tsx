import { afterEach, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
// The session is somebody's; what it is called does not matter here, only that there is one.
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session' }) }));
// A text input listens on the browser's `document`, which a test renderer has none of. The name is
// handed to the sheet's `onSubmit` directly below; how the field draws is `label-sheets.test.tsx`'s.
vi.mock('@/kit', async (original) => ({
  ...(await original<typeof import('@/kit')>()),
  Field: () => null,
}));

import { frame, label } from '@tests/helpers/labels';
import { bannersSaid, mountsTrees } from '@tests/helpers/renderer';
import { sheetBox, wordsIn } from '@tests/helpers/sheet';
import { Unlink, WifiOff } from 'lucide-react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { Label, MediaItem } from '@/api';
import { Banner, Button, ConfirmSheet, Icon, IconButton, RowLabel } from '@/kit';
import { LabelNewSheet, LabelSheets } from '@/screens/memory/label-sheets';
import { ru } from '@/strings';

/**
 * The labels sheet as a person uses it: the real container, the real api client, and a stand-in
 * server behind `fetch` that answers the way the api's README says it does. What is pinned is what
 * the sheet asks for, what it tells the feed, and what it shows afterwards — never how it gets
 * there — so these are the flows of doc-13 (a press files everything marked in one request, a
 * second press takes it back, a new label files as it is made, a deleted one leaves the frames)
 * rather than the lines of the file.
 *
 * The sheet's rows and states, drawn, are `label-sheets.test.tsx`; the rules a press comes to are
 * `labels.test.ts`.
 */

mountsTrees();

afterEach(() => vi.unstubAllGlobals());

type Asked = { method: string; path: string; body: unknown };
type Server = {
  labels: Label[];
  asked: Asked[];
  /** Holds every answer back until released — a request that is still in the air. */
  hold?: Promise<void>;
  /** Refuses a request the way the api would, or drops the connection. */
  refuse?: (asked: Asked) => Response | 'offline' | undefined;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** The api's labels routes over a list held here, with the counts it would work out. */
function serve(labels: Label[], over: Partial<Server> = {}): Server {
  const server: Server = { labels, asked: [], ...over };
  vi.stubGlobal('fetch', async (url: string, init: { method?: string; body?: string }) => {
    const asked = {
      method: init.method ?? 'GET',
      path: url.replace(/^.*\/memories\/m1/, ''),
      body: init.body ? JSON.parse(init.body) : null,
    };
    server.asked.push(asked);
    await server.hold;
    const refused = server.refuse?.(asked);
    if (refused === 'offline') throw new TypeError('Network request failed');
    if (refused) return refused;

    const [, , id, media] = asked.path.split('/');
    const one = server.labels.find((each) => each.id === id);
    if (asked.path === '/labels' && asked.method === 'GET') return json(server.labels);
    if (asked.path === '/labels') {
      const made = label({
        id: 'made',
        title: (asked.body as { title: string }).title,
        shared: (asked.body as { shared: boolean }).shared,
        media_count: ((asked.body as { media_ids?: string[] }).media_ids ?? []).length,
      });
      server.labels = [...server.labels, made];
      return json(made, 201);
    }
    if (!one) return json({ error: 'not found' }, 404);
    if (media) {
      const moved = (asked.body as { media_ids: string[] }).media_ids.length;
      one.media_count += asked.method === 'POST' ? moved : -moved;
      return json(one);
    }
    server.labels = server.labels.filter((each) => each !== one);
    return json({ ok: true });
  });
  return server;
}

type Filed = [labelId: string, ids: string[] | null, now: boolean];

/** The sheet over a selection, the way the feed mounts it. */
async function open(frames: MediaItem[]) {
  const filed: Filed[] = [];
  let closed = 0;
  const node = (marked: MediaItem[]) => (
    <LabelSheets
      memoryId="m1"
      frames={marked}
      onFiled={(...args: Filed) => filed.push(args)}
      onClose={() => closed++}
    />
  );
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(node(frames));
  });
  const rows = () => tree.root.findAllByType(RowLabel);
  const row = (name: string) => {
    const found = rows().find((one) => one.props.name === name);
    if (!found) throw new Error(`no row «${name}» among ${rows().map((one) => one.props.name)}`);
    return found;
  };
  return {
    filed,
    closed: () => closed,
    rows,
    row,
    names: () => rows().map((one) => one.props.name as string),
    /** The feed hands the sheet the marked frames again once it has patched what came back. */
    marked: (next: MediaItem[]) => act(async () => tree.update(node(next))),
    press: (name: string) => act(async () => row(name).props.onPress?.()),
    button: (text: string) =>
      tree.root.findAllByType(Button).find((one) => one.props.label === text)!,
    icon: (text: string) =>
      tree.root.findAllByType(IconButton).find((one) => one.props.label === text)!,
    banner: () => bannersSaid(tree.root).map(([words]) => words),
    /** The glyph each banner draws beside its words. */
    glyph: () => tree.root.findAllByType(Banner).map((one) => one.findByType(Icon).props.icon),
    confirm: () => tree.root.findByType(ConfirmSheet),
    making: () => tree.root.findAllByType(LabelNewSheet),
    act: (run: () => void) => act(async () => run()),
  };
}

const best = label({ id: 'best', title: 'Лучшее', media_count: 0 });
const mine = label({ id: 'mine', title: 'Для себя', shared: false, media_count: 0 });
const three = () => [frame('a'), frame('b'), frame('c')];

test('the sheet lists what the server sent, shared first, and files nothing by itself', async () => {
  const server = serve([best, mine]);
  const sheet = await open(three());
  expect(sheet.names()).toEqual(['Лучшее', 'Для себя']);
  expect(server.asked).toEqual([{ method: 'GET', path: '/labels', body: null }]);
  expect(sheet.filed).toEqual([]);
});

test('an empty memory has no rows to show, and a viewer with no rights has rows that do not press', async () => {
  serve([]);
  expect((await open(three())).rows()).toHaveLength(0);

  const server = serve([label({ id: 'x', title: 'Чужой', mine: false, can_add_media: false })]);
  const viewer = await open(three());
  expect(viewer.row('Чужой').props.onPress).toBeUndefined();
  expect(server.asked).toHaveLength(1);
});

test('one press puts every marked frame in with a single request, and the row shows the new count', async () => {
  const server = serve([{ ...best }]);
  const sheet = await open(three());
  await sheet.press('Лучшее');

  const puts = server.asked.filter((one) => one.method === 'POST');
  expect(puts).toEqual([
    { method: 'POST', path: '/labels/best/media', body: { media_ids: ['a', 'b', 'c'] } },
  ]);
  expect(sheet.filed).toEqual([['best', ['a', 'b', 'c'], true]]);
  expect(sheet.row('Лучшее').props.count).toBe(ru.memory.frames(3));
});

test('a selection half in the label sends only the missing ones and lights no circle until all are in', async () => {
  const server = serve([{ ...best, media_count: 1 }]);
  const halfIn = [frame('a', ['best']), frame('b'), frame('c')];
  const sheet = await open(halfIn);
  expect(sheet.row('Лучшее').props.inside).toBe(false);
  await sheet.press('Лучшее');

  expect(server.asked.at(-1)).toEqual({
    method: 'POST',
    path: '/labels/best/media',
    body: { media_ids: ['b', 'c'] },
  });
  expect(sheet.filed).toEqual([['best', ['b', 'c'], true]]);
});

test('once all are in the circle is lit, and the next press takes the whole selection out again', async () => {
  const server = serve([{ ...best, media_count: 3 }]);
  const sheet = await open(three().map((one) => frame(one.id, ['best'])));
  expect(sheet.row('Лучшее').props.inside).toBe(true);
  await sheet.press('Лучшее');

  expect(server.asked.at(-1)).toEqual({
    method: 'DELETE',
    path: '/labels/best/media',
    body: { media_ids: ['a', 'b', 'c'] },
  });
  // Out of the label, and still in the memory: the sheet says so to the feed and to nobody else.
  expect(sheet.filed).toEqual([['best', ['a', 'b', 'c'], false]]);
  expect(sheet.row('Лучшее').props.count).toBe(ru.memory.frames(0));
});

test('the circle follows the feed: lit after the feed has taken the answer in, dark after it lost it', async () => {
  serve([{ ...best }]);
  const sheet = await open(three());
  await sheet.marked(three().map((one) => frame(one.id, ['best'])));
  expect(sheet.row('Лучшее').props.inside).toBe(true);
  await sheet.marked([frame('a', ['best']), frame('b'), frame('c')]);
  expect(sheet.row('Лучшее').props.inside).toBe(false);
});

test('a second press while the first is still on its way is not a second request', async () => {
  const server = serve([{ ...best }]);
  const sheet = await open(three());
  let release!: () => void;
  server.hold = new Promise((done) => (release = done));
  await act(async () => {
    sheet.row('Лучшее').props.onPress?.();
  });
  await act(async () => {
    sheet.row('Лучшее').props.onPress?.();
  });
  release();
  await act(async () => {});
  expect(server.asked.filter((one) => one.method === 'POST')).toHaveLength(1);
  expect(sheet.filed).toHaveLength(1);
});

test('a label somebody deleted meanwhile says so in words, files nothing and leaves the sheet working', async () => {
  const server = serve([{ ...best }]);
  const sheet = await open(three());
  server.refuse = (asked) =>
    asked.method === 'POST' ? json({ error: 'not found' }, 404) : undefined;
  await sheet.press('Лучшее');

  expect(sheet.banner()).toEqual([ru.labels.gone]);
  expect(sheet.filed).toEqual([]);
  // Not stuck: the same press goes through as soon as the server lets it.
  server.refuse = undefined;
  await sheet.press('Лучшее');
  expect(sheet.filed).toEqual([['best', ['a', 'b', 'c'], true]]);
  expect(sheet.banner()).toEqual([]);
});

test('no connection: the failure is said, nothing is claimed as filed, and the sheet is not left busy', async () => {
  const server = serve([{ ...best }]);
  const sheet = await open(three());
  server.refuse = () => 'offline';
  await sheet.press('Лучшее');

  expect(sheet.banner()).toEqual([ru.error.offline]);
  expect(sheet.filed).toEqual([]);
  expect(sheet.button(ru.labels.newOne).props.disabled).toBe(false);
});

test('a label list that never arrived is said, and is read again on the way back from «Новый лейбл»', async () => {
  const server = serve([{ ...best }], { refuse: () => 'offline' });
  const sheet = await open(three());
  expect(sheet.banner()).toEqual([ru.error.offline]);
  expect(sheet.rows()).toHaveLength(0);

  server.refuse = undefined;
  await sheet.act(() => sheet.button(ru.labels.newOne).props.onPress());
  await sheet.act(() => sheet.making()[0].props.onCancel());
  expect(sheet.names()).toEqual(['Лучшее']);
});

test('«Новый лейбл» makes the label and puts the marked frames into it in one request', async () => {
  const server = serve([{ ...best }]);
  const sheet = await open(three());
  await sheet.act(() => sheet.button(ru.labels.newOne).props.onPress());
  await sheet.act(() => sheet.making()[0].props.onSubmit('Для бабушки', 3, false));

  expect(server.asked.filter((one) => one.method === 'POST')).toEqual([
    {
      method: 'POST',
      path: '/labels',
      body: { title: 'Для бабушки', color: 3, shared: false, media_ids: ['a', 'b', 'c'] },
    },
  ]);
  // The feed is told the new label holds the three, and the sheet is back on the list with it in.
  expect(sheet.filed).toEqual([['made', ['a', 'b', 'c'], true]]);
  expect(sheet.making()).toHaveLength(0);
  expect(sheet.names()).toContain('Для бабушки');
});

test('a viewer asking for a shared label is told in words what they can make, and can try again', async () => {
  const server = serve([], {
    refuse: (asked) => (asked.method === 'POST' ? json({}, 403) : undefined),
  });
  const sheet = await open(three());
  await sheet.act(() => sheet.button(ru.labels.newOne).props.onPress());
  await sheet.act(() => sheet.making()[0].props.onSubmit('Общее', 1, true));

  expect(sheet.banner()).toEqual([ru.labels.sharedDenied]);
  expect(sheet.filed).toEqual([]);
  expect(sheet.making()).toHaveLength(1);
  expect(sheet.making()[0].props.busy).toBe(false);
  expect(server.asked.filter((one) => one.method === 'POST')).toHaveLength(1);

  // Taken out of the memory while the sheet was open: making one has no label in its path, so the
  // api's 404 is about the membership — and it is not «этого лейбла больше нет».
  server.refuse = (asked) => (asked.method === 'POST' ? json({}, 404) : undefined);
  await sheet.act(() => sheet.making()[0].props.onSubmit('Личное', 1, false));
  expect(sheet.banner()).toEqual([ru.memory.gone]);
  // …and it is not about the connection either: the banner wears a cut tie, not «no signal».
  expect(sheet.glyph()).toEqual([Unlink]);
  expect(sheet.glyph()).not.toContain(WifiOff);
});

test('deleting a label asks first, takes only the box, and tells the feed every frame lost it', async () => {
  const server = serve([{ ...best }, { ...mine }]);
  const sheet = await open(three());
  await sheet.act(() => sheet.button(ru.labels.edit).props.onPress());
  await sheet.act(() => sheet.icon(ru.labels.remove('Лучшее')).props.onPress());
  // Asked, not done: nothing has gone to the server yet. And no price is named — only the box goes.
  expect(sheet.confirm().props.visible).toBe(true);
  expect(sheet.confirm().props.price).toBeUndefined();
  expect(server.asked.filter((one) => one.method === 'DELETE')).toEqual([]);
  // Spec 4, `SheetConfirmDelete`: a label — the square of its own colour beside the question, no
  // price — is asked about on the 380 sheet, 18 between its blocks.
  expect(sheetBox(sheet.confirm())).toEqual({ gap: 18, minHeight: 380 });
  expect(wordsIn(sheet.confirm())).toContain(ru.labels.deleteAsk('Лучшее'));

  await sheet.act(() => sheet.confirm().props.onConfirm());
  expect(server.asked.filter((one) => one.method === 'DELETE')).toEqual([
    { method: 'DELETE', path: '/labels/best', body: null },
  ]);
  expect(sheet.filed).toEqual([['best', null, false]]);
  expect(sheet.names()).toEqual(['Для себя']);
  expect(sheet.confirm().props.visible).toBe(false);
});

test('a label somebody else already deleted cannot be deleted again, and says so', async () => {
  const server = serve([{ ...best }]);
  const sheet = await open(three());
  server.labels = [];
  await sheet.act(() => sheet.button(ru.labels.edit).props.onPress());
  await sheet.act(() => sheet.icon(ru.labels.remove('Лучшее')).props.onPress());
  await sheet.act(() => sheet.confirm().props.onConfirm());

  expect(sheet.banner()).toEqual([ru.labels.gone]);
  expect(sheet.filed).toEqual([]);
});

test('renaming saves the name and colour and tells the feed nothing, because no frame moved', async () => {
  const server = serve([{ ...best }]);
  const sheet = await open(three());
  server.refuse = (asked) =>
    asked.method === 'PATCH' ? json({ ...best, title: 'Ящик', color: 4 }) : undefined;
  await sheet.act(() => sheet.button(ru.labels.edit).props.onPress());
  await sheet.act(() => sheet.icon(ru.labels.rename('Лучшее')).props.onPress());
  await sheet.act(() => sheet.making()[0].props.onSubmit('Ящик', 4, true));

  expect(server.asked.at(-1)).toEqual({
    method: 'PATCH',
    path: '/labels/best',
    body: { title: 'Ящик', color: 4 },
  });
  expect(sheet.names()).toEqual(['Ящик']);
  expect(sheet.filed).toEqual([]);
});
