import { afterEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
// The screen reads on focus, and the router that says when is not here: focus is «now, once».
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useRouter: () => ({ push: () => {}, back: () => {} }),
  };
});
// Not what these tests are about, and each reads a corner of the api of its own.
vi.mock('@/memory/films', () => ({ Films: () => null }));
vi.mock('@/memory/frame-viewer', () => ({ FrameViewer: () => null }));
vi.mock('@/downloads', () => ({
  maySaveToPhone: () => false,
  saveToPhone: async () => {},
  shareFile: async () => {},
}));
// A text input listens on the browser's `document`, which a test renderer has none of. The name is
// handed to the sheet's `onSubmit` directly below.
vi.mock('@/kit', async (original) => ({ ...(await original<typeof import('@/kit')>()), Field: () => null }));

import TestRenderer, { act } from 'react-test-renderer';

import type { Label, MediaItem } from '@/api';
import { Banner, Button, Chip, ConfirmSheet, IconButton, RowLabel, Tile } from '@/kit';
import { label } from '@/label-fixtures';
import { Frames } from '@/memory/frames';
import { FilterSheet } from '@/memory/frames-sheets';
import { LabelNewSheet, LabelSheets } from '@/memory/label-sheets';
import { ru } from '@/strings';
import { mountsTrees } from '@/test-renderer';

/**
 * The gallery of a memory as a person uses it to file frames into labels and to look at them again
 * (doc-13): the whole feed screen, the real api client, and a stand-in server behind `fetch` that
 * keeps the labels the way the api's README says — a private label of somebody else is simply not in
 * any answer. Every check is about what is on screen or what went over the wire: which frames the
 * feed shows through a label, how many times each, what was asked of the server, what a deleted
 * label leaves behind.
 *
 * The sheet on its own — every press and every refusal — is `label-sheets-flow.test.tsx`; the rules
 * are `labels.test.ts`. This file is the joins between them and the feed.
 */

mountsTrees();

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const shot = (id: string, at: number): MediaItem => ({
  id,
  kind: 'photo',
  status: 'ready',
  uploaded_by: 'me',
  size_bytes: '1',
  captured_at: `2026-09-20T10:0${at}:00.000Z`,
  width: null,
  height: null,
  duration_seconds: null,
  created_at: '2026-09-20T10:00:00.000Z',
  label_ids: [],
  thumbnail_url: `https://r2.example/${id}`,
  preview_url: null,
  screening_rejected: null,
  screening_reason: null,
});

/** Who is asking is `me`; `theirs` is a private label of somebody else, which no answer carries. */
type Db = {
  frames: MediaItem[];
  labels: Label[];
  /** Which frames lie in which label, the truth the api keeps. */
  filed: Record<string, Set<string>>;
  hidden: Set<string>;
  asked: { method: string; path: string; body: unknown }[];
  /** Answers instead of the api, for the one request it names. */
  refuse?: (asked: Db['asked'][number]) => Response | 'offline' | undefined;
};

const best = () => label({ id: 'best', title: 'Лучшее' });
const own = () => label({ id: 'mine', title: 'Для себя', shared: false });

function serve(over: Partial<Db> = {}): Db {
  const db: Db = {
    frames: [shot('a', 3), shot('b', 2), shot('c', 1)],
    labels: [best(), own(), label({ id: 'theirs', title: 'Чужой личный', shared: false, mine: false })],
    filed: { best: new Set(), mine: new Set(), theirs: new Set(['a']) },
    hidden: new Set(['theirs']),
    asked: [],
    ...over,
  };
  const seen = () => db.labels.filter((one) => !db.hidden.has(one.id));
  const row = (one: Label) => ({ ...one, media_count: db.filed[one.id]?.size ?? 0 });
  vi.stubGlobal('fetch', async (url: string, init: { method?: string; body?: string }) => {
    const asked = {
      method: init.method ?? 'GET',
      path: url.replace(/^.*\/memories\/m1/, ''),
      body: init.body ? JSON.parse(init.body) : null,
    };
    db.asked.push(asked);
    const refused = db.refuse?.(asked);
    if (refused === 'offline') throw new TypeError('Network request failed');
    if (refused) return refused;

    if (asked.path === '/media') {
      return json(
        db.frames.map((one) => ({
          ...one,
          label_ids: seen()
            .filter((each) => db.filed[each.id]?.has(one.id))
            .map((each) => each.id),
        })),
      );
    }
    if (asked.path === '/members') {
      return json([{ id: 'me', name: 'Я', username: 'me', role: 'contributor', contribution_status: 'done', media_count: 3 }]);
    }
    if (asked.path === '/labels' && asked.method === 'GET') return json(seen().map(row));
    if (asked.path === '/labels') {
      const body = asked.body as { title: string; shared: boolean; media_ids?: string[] };
      const made = label({ id: 'made', title: body.title, shared: body.shared });
      db.labels.push(made);
      db.filed.made = new Set(body.media_ids ?? []);
      return json(row(made), 201);
    }
    const [, , id, media] = asked.path.split('/');
    const one = seen().find((each) => each.id === id);
    if (!one) return json({ error: 'not found' }, 404);
    if (media) {
      const ids = (asked.body as { media_ids: string[] }).media_ids;
      for (const frame of ids) db.filed[id][asked.method === 'POST' ? 'add' : 'delete'](frame);
      return json(row(one));
    }
    db.labels = db.labels.filter((each) => each !== one);
    delete db.filed[id];
    return json({ ok: true });
  });
  return db;
}

async function open() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Frames id="m1" head={{ memory: null, error: null, reload: () => {} }} />);
  });
  const press = (find: () => { props: { onPress?: () => void } }) =>
    act(async () => find().props.onPress?.());
  const icon = (text: string) => () =>
    tree.root.findAllByType(IconButton).find((one) => one.props.label === text)!;
  /** The chips of the labels row — the only ones on that sheet that carry a colour swatch. */
  const labelChips = (sheet: TestRenderer.ReactTestInstance) =>
    sheet.findAllByType(Chip).filter((one) => one.props.swatch !== undefined);
  /** The filter lives on the ordinary bottom layer, so a picking mode still on is left first. */
  const openFilter = async () => {
    if (tree.root.findAllByType(IconButton).some((one) => one.props.label === ru.gallery.leaveSelect)) {
      await press(icon(ru.gallery.leaveSelect));
    }
    await press(icon(ru.gallery.filters));
  };
  const screen = {
    root: tree.root,
    /** The frames on the feed, in the order drawn — each one a tile. */
    feed: () => tree.root.findAllByType(Tile).map((one) => String(one.props.uri).split('/').pop()),
    /** The select button, then a tap on each of these frames. */
    pick: async (...ids: string[]) => {
      await press(icon(ru.gallery.select));
      await screen.mark(...ids);
    },
    /** A tap on each of these frames, in the picking mode already on. */
    mark: async (...ids: string[]) => {
      for (const id of ids) {
        await press(
          () => tree.root.findAllByType(Tile).find((one) => one.props.uri === `https://r2.example/${id}`)!,
        );
      }
    },
    labelsButton: icon(ru.gallery.labelsPut),
    openLabels: () => press(icon(ru.gallery.labelsPut)),
    closeLabels: () => act(async () => tree.root.findByType(LabelSheets).props.onClose()),
    rows: () => tree.root.findByType(LabelSheets).findAllByType(RowLabel),
    row: (name: string) => () =>
      tree.root.findByType(LabelSheets).findAllByType(RowLabel).find((one) => one.props.name === name)!,
    press,
    tap: (name: string) => press(screen.row(name)),
    banner: () => tree.root.findByType(LabelSheets).findAllByType(Banner).map((one) => one.props.text as string),
    /** «Фильтры» → pick these label chips → «Показать». Returns the chips the sheet offered. */
    filterBy: async (...titles: string[]) => {
      await openFilter();
      const sheet = () => tree.root.findByType(FilterSheet);
      for (const title of titles) {
        await press(() => labelChips(sheet()).find((one) => one.props.label === title)!);
      }
      await press(() => sheet().findAllByType(Button).at(-1)!);
    },
    /** The label chips the filter sheet shows, with the frames each one says it holds. */
    offered: async () => {
      await openFilter();
      const chips = labelChips(tree.root.findByType(FilterSheet)).map(
        (one) => `${one.props.label} ${one.props.count}`,
      );
      await act(async () => tree.root.findByType(FilterSheet).props.onCancel());
      return chips;
    },
  };
  return screen;
}

const gets = (db: Db, path: string) =>
  db.asked.filter((one) => one.method === 'GET' && one.path === path);
const writes = (db: Db) => db.asked.filter((one) => one.method !== 'GET');

test('several frames go into a label with one request and are then found there through the filter', async () => {
  const db = serve();
  const screen = await open();
  expect(screen.feed()).toEqual(['a', 'b', 'c']);
  await screen.pick('a', 'b');
  await screen.openLabels();
  await screen.tap('Лучшее');

  expect(writes(db)).toEqual([
    { method: 'POST', path: '/labels/best/media', body: { media_ids: ['a', 'b'] } },
  ]);
  // The feed took the answer in as it stood: the gallery was not read again to find it out.
  expect(gets(db, '/media')).toHaveLength(1);
  await screen.closeLabels();
  // The chip says what the server counted, and looking through it shows exactly those frames.
  expect(await screen.offered()).toEqual(['Лучшее 2', 'Для себя 0']);
  await screen.filterBy('Лучшее');
  expect(screen.feed()).toEqual(['a', 'b']);
});

test('a frame in more than one label is one frame on the feed, through either label or both', async () => {
  serve();
  const screen = await open();
  await screen.pick('a', 'b');
  await screen.openLabels();
  await screen.tap('Лучшее');
  await screen.closeLabels();
  // One more frame marked, and all three go into a second label: «a» and «b» now lie in both.
  await screen.mark('c');
  await screen.openLabels();
  await screen.tap('Для себя');
  await screen.closeLabels();
  expect(screen.feed()).toEqual(['a', 'b', 'c']);

  // Either label on its own, and both together — «any of them», each frame once.
  await screen.filterBy('Лучшее');
  expect(screen.feed()).toEqual(['a', 'b']);
  // The sheet opens on what is applied, so a press adds «Для себя» to «Лучшее».
  await screen.filterBy('Для себя');
  expect(screen.feed()).toEqual(['a', 'b', 'c']);
});

test('a selection partly in the label gets the rest, and the next press takes all of it out', async () => {
  const db = serve();
  db.filed.best.add('a');
  const screen = await open();
  await screen.pick('a', 'b', 'c');
  await screen.openLabels();
  expect(screen.row('Лучшее')().props.inside).toBe(false);
  await screen.tap('Лучшее');
  expect(writes(db).at(-1)).toEqual({
    method: 'POST',
    path: '/labels/best/media',
    body: { media_ids: ['b', 'c'] },
  });

  // Everything marked lies in it now, and the sheet knows it from the feed alone.
  expect(screen.row('Лучшее')().props.inside).toBe(true);
  await screen.tap('Лучшее');
  expect(writes(db).at(-1)).toEqual({
    method: 'DELETE',
    path: '/labels/best/media',
    body: { media_ids: ['a', 'b', 'c'] },
  });
  expect(screen.row('Лучшее')().props.inside).toBe(false);
  // Out of the label, and every frame is still in the memory.
  expect(screen.feed()).toEqual(['a', 'b', 'c']);
});

test('somebody else’s private label is nowhere: not in the sheet and not on the filter', async () => {
  serve();
  const screen = await open();
  await screen.pick('a');
  await screen.openLabels();
  expect(screen.rows().map((one) => one.props.name)).toEqual(['Лучшее', 'Для себя']);
  await screen.closeLabels();
  expect(await screen.offered()).toEqual(['Лучшее 0', 'Для себя 0']);
});

test('the labels button is off until something is marked', async () => {
  serve();
  const screen = await open();
  await screen.pick();
  expect(screen.labelsButton().props.disabled).toBe(true);
  await screen.mark('a');
  expect(screen.labelsButton().props.disabled).toBe(false);
});

test('labels that cannot be read leave the feed as it is, offer none on the filter, and say why on the sheet', async () => {
  const db = serve();
  db.refuse = (asked) => (asked.path === '/labels' ? 'offline' : undefined);
  const screen = await open();
  // The feed is fine and carries no error of its own: only the row of labels is missing.
  expect(screen.feed()).toEqual(['a', 'b', 'c']);
  expect(screen.root.findAllByType(Banner)).toHaveLength(0);
  expect(await screen.offered()).toEqual([]);

  await screen.pick('a');
  await screen.openLabels();
  expect(screen.banner()).toEqual([ru.error.offline]);
  // Removed from the memory meanwhile: the api's 404 on the list is «you are not in it any more».
  db.refuse = (asked) => (asked.path === '/labels' ? json({}, 404) : undefined);
  await screen.closeLabels();
  await screen.openLabels();
  expect(screen.banner()).toEqual([ru.memory.gone]);
});

test('a viewer who may not file into a label has a row that does nothing and sends nothing', async () => {
  const db = serve();
  db.labels[0].can_add_media = false;
  const screen = await open();
  await screen.pick('a');
  await screen.openLabels();
  expect(screen.row('Лучшее')().props.onPress).toBeUndefined();
  await screen.tap('Лучшее');
  expect(writes(db)).toEqual([]);
});

test('a memory with no labels offers none on the filter; a new one made from the sheet holds the marked frames', async () => {
  const db = serve({ labels: [], filed: {}, hidden: new Set() });
  const screen = await open();
  expect(await screen.offered()).toEqual([]);

  await screen.pick('b', 'c');
  await screen.openLabels();
  expect(screen.rows()).toHaveLength(0);
  await screen.press(
    () =>
      screen.root
        .findByType(LabelSheets)
        .findAllByType(Button)
        .find((one) => one.props.label === ru.labels.newOne)!,
  );
  await act(async () =>
    screen.root.findByType(LabelNewSheet).props.onSubmit('Для бабушки', 2, true),
  );

  expect(writes(db)).toEqual([
    {
      method: 'POST',
      path: '/labels',
      body: { title: 'Для бабушки', color: 2, shared: true, media_ids: ['b', 'c'] },
    },
  ]);
  await screen.closeLabels();
  expect(await screen.offered()).toEqual(['Для бабушки 2']);
  await screen.filterBy('Для бабушки');
  expect(screen.feed()).toEqual(['b', 'c']);
});

/** The edit mode of the labels sheet, the trash on one row, and «Удалить лейбл». */
async function deleteLabel(screen: Awaited<ReturnType<typeof open>>, title: string) {
  const sheet = () => screen.root.findByType(LabelSheets);
  await screen.press(
    () => sheet().findAllByType(Button).find((one) => one.props.label === ru.labels.edit)!,
  );
  await screen.press(
    () =>
      sheet().findAllByType(IconButton).find((one) => one.props.label === ru.labels.remove(title))!,
  );
  await act(async () => sheet().findByType(ConfirmSheet).props.onConfirm());
}

test('deleting a label leaves every frame on the feed and takes the label off the filter with it', async () => {
  const db = serve();
  db.filed.best = new Set(['a', 'b']);
  db.filed.mine = new Set(['c']);
  const screen = await open();
  await screen.filterBy('Лучшее');
  expect(screen.feed()).toEqual(['a', 'b']);

  await screen.pick('a');
  await screen.openLabels();
  await deleteLabel(screen, 'Лучшее');
  expect(writes(db)).toEqual([{ method: 'DELETE', path: '/labels/best', body: null }]);
  // The filter was looking at nothing but that label: it lets go, and all three frames are there.
  expect(screen.feed()).toEqual(['a', 'b', 'c']);
  await screen.closeLabels();
  expect(await screen.offered()).toEqual(['Для себя 1']);
});

test('a label deleted next to another one still on the filter leaves the filter on the other', async () => {
  const db = serve();
  db.filed.best = new Set(['a', 'b']);
  db.filed.mine = new Set(['c']);
  const screen = await open();
  await screen.filterBy('Лучшее', 'Для себя');
  expect(screen.feed()).toEqual(['a', 'b', 'c']);

  await screen.pick('a');
  await screen.openLabels();
  await deleteLabel(screen, 'Лучшее');
  await screen.closeLabels();
  expect(screen.feed()).toEqual(['c']);
});

test('a label somebody else deleted is off the filter the next time the labels are read, frames untouched', async () => {
  const db = serve();
  db.filed.best = new Set(['a', 'b']);
  const screen = await open();
  await screen.filterBy('Лучшее');
  expect(screen.feed()).toEqual(['a', 'b']);

  db.labels = db.labels.filter((one) => one.id !== 'best');
  delete db.filed.best;
  await screen.pick('a');
  await screen.openLabels();
  expect(screen.rows().map((one) => one.props.name)).toEqual(['Для себя']);
  await screen.closeLabels();
  expect(screen.feed()).toEqual(['a', 'b', 'c']);
});

test('no connection while filing: it is said, nothing is filed, and the same press works when it is back', async () => {
  const db = serve();
  db.refuse = (asked) => (asked.method === 'POST' ? 'offline' : undefined);
  const screen = await open();
  await screen.pick('a', 'b');
  await screen.openLabels();
  await screen.tap('Лучшее');
  expect(screen.banner()).toEqual([ru.error.offline]);
  expect(screen.feed()).toEqual(['a', 'b', 'c']);
  expect(screen.row('Лучшее')().props.inside).toBe(false);

  db.refuse = undefined;
  await screen.tap('Лучшее');
  expect(screen.banner()).toEqual([]);
  expect(screen.row('Лучшее')().props.inside).toBe(true);
});

