import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
vi.mock('expo-router', () => ({
  useFocusEffect: () => {},
  useLocalSearchParams: () => ({ id: 'm1' }),
  useRouter: () => router,
}));
// A text input listens on the browser's `document`, which a test renderer has none of. The value and
// the answer the field gives are on the props the screen hands it, which is what is read here.
vi.mock('@/kit', async (original) => ({ ...(await original<typeof import('@/kit')>()), Field: () => null }));

import TestRenderer, { act } from 'react-test-renderer';

import type { MediaItem, Memory } from '@/api';
import MemoryEditScreen from '@/app/memory/[id]/edit';
import { endOfDay, startOfDay } from '@/dates';
import { Banner, Button, ConfirmSheet, Field, IconButton, Tile } from '@/kit';
import { CoverSheet, CoverSlot } from '@/memory/cover';
import { EventWhen } from '@/memory/when';
import { ru } from '@/strings';
import { developing, later, memory, photo, refused, serve, type Asked } from '@/test-api';
import { setTheme } from '@/theme';
import { mounted, mountsTrees, themesShown } from '@/test-renderer';

/**
 * `MemoryEdit` (spec 10.8.3) — name, days and cover of a memory changed in one go, on the real api
 * client over a stand-in server. What a person can see is the state of the save button, the banner
 * and the sheet that asks about leaving; what matters most is the one request: only what was touched
 * goes up, and nothing goes up when nothing changed.
 */

mountsTrees();

beforeEach(() => {
  router.push.mockClear();
  router.back.mockClear();
  router.replace.mockClear();
  router.canGoBack.mockReturnValue(true);
});
afterEach(() => vi.unstubAllGlobals());

const day = (d: number) => new Date(2026, 8, d);
const at = (d: number, hour = 12) => new Date(2026, 8, d, hour).toISOString();

/** A two-day memory of the 12th and 13th, with no cover. */
const wedding = (over: Partial<Memory> = {}) =>
  memory({
    event_start: startOfDay(day(12)).toISOString(),
    event_end: endOfDay(day(13)).toISOString(),
    ...over,
  });

const shots = (): MediaItem[] => [
  photo('a', 'me', at(13, 10)),
  photo('b', 'me', at(12, 9)),
  { ...developing('c', 'me', at(12, 8)), thumbnail_url: 'https://r2.example/c' },
];

type World = {
  memory: Memory;
  media: MediaItem[] | 'offline';
  onPatch?: Response | 'offline' | Promise<unknown>;
  log: Asked[];
};

function world(over: Partial<Pick<World, 'memory' | 'media' | 'onPatch'>> = {}): World {
  const w: World = { memory: wedding(), media: shots(), log: [] };
  Object.assign(w, over);
  w.log = serve((asked) => {
    if (asked.path === '/memories') return [w.memory];
    if (asked.path === '/memories/m1/media') return w.media;
    if (asked.method === 'PATCH' && asked.path === '/memories/m1') return w.onPatch ?? w.memory;
    return undefined;
  });
  return w;
}

async function open() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<MemoryEditScreen />));
  });
  const root = tree.root;
  const press = (find: () => { props: { onPress?: () => void } }) => act(async () => find().props.onPress?.());
  const screen = {
    root,
    press,
    field: () => root.findByType(Field).props as { value: string; state?: string; hint?: string; editable?: boolean },
    when: () => root.findByType(EventWhen),
    buttons: (label: string) => root.findAllByType(Button).filter((one) => one.props.label === label),
    save: () => root.findAllByType(Button).find((one) => one.props.label === ru.edit.save)!,
    type: (text: string) => act(async () => root.findByType(Field).props.onChangeText(text)),
    pickDays: (from: Date, to: Date | null) => act(async () => root.findByType(EventWhen).props.onChange({ from, to })),
    back: () => root.findAllByType(IconButton).find((one) => one.props.label === ru.action.back)!,
    leaving: () => root.findAllByType(ConfirmSheet)[0],
    cover: () => root.findByType(CoverSheet),
    banners: () => root.findAllByType(Banner).map((one) => one.props.text as string),
    patches: (log: Asked[]) => log.filter((one) => one.method === 'PATCH').map((one) => one.body),
    text: () => JSON.stringify(tree.toJSON()),
  };
  return screen;
}

type Screen = Awaited<ReturnType<typeof open>>;

test('the screen opens on what the memory is, and with nothing changed there is nothing to save', async () => {
  world();
  const screen = await open();
  expect(screen.field().value).toBe('Свадьба Лизы и Марка');
  expect(screen.field().state).toBeUndefined();
  expect(screen.when().props.value).toEqual({ from: startOfDay(day(12)), to: startOfDay(day(13)) });
  // Молча: the button is unavailable and no line explains why.
  expect(screen.save().props.disabled).toBe(true);
  expect(screen.banners()).toEqual([]);
  // And nothing is shut: not the field, not the calendar, not the button that picks a cover.
  expect(screen.save().props.busy).toBe(false);
  expect(screen.field().editable).toBe(true);
  expect(screen.when().props.disabled).toBe(false);
  expect(screen.buttons(ru.edit.coverPick)[0].props.disabled).toBe(false);
});

test('a memory that is not on the list is an error, not a spinner that never ends', async () => {
  world({ memory: wedding({ id: 'other' }) });
  const screen = await open();
  expect(screen.banners()).toHaveLength(1);
  expect(screen.root.findAllByType(EventWhen)).toHaveLength(0);
  expect(screen.save().props.disabled).toBe(true);
});

test('leaving with nothing changed goes at once; with edits it asks, gently, and «Остаться» keeps them', async () => {
  world();
  const screen = await open();
  await screen.press(() => screen.back());
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(screen.leaving().props.visible).toBe(false);

  router.back.mockClear();
  await screen.type('Свадьба');
  await screen.press(() => screen.back());
  expect(router.back).not.toHaveBeenCalled();
  expect(screen.leaving().props.visible).toBe(true);
  // Gentle: nothing is lost by leaving but the edits, and the sheet has no red in it.
  expect(screen.leaving().props.variant).toBe('gentle');
  expect(screen.leaving().props.title).toBe(ru.edit.leaveAsk);
  await act(async () => screen.leaving().props.onCancel());
  expect(screen.leaving().props.visible).toBe(false);
  expect(screen.field().value).toBe('Свадьба');

  await screen.press(() => screen.back());
  await act(async () => screen.leaving().props.onConfirm());
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(screen.leaving().props.visible).toBe(false);
});

test('with nowhere to go back to, leaving is the settings of this memory', async () => {
  world();
  router.canGoBack.mockReturnValue(false);
  const screen = await open();
  await screen.press(() => screen.back());
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/memory/[id]/settings', params: { id: 'm1' } });
});

test('a new name is the only thing sent, trimmed, and the screen goes back', async () => {
  const w = world();
  const screen = await open();
  await screen.type('  Свадьба Лизы и Марка, второй день ');
  expect(screen.save().props.disabled).toBe(false);
  await screen.press(() => screen.save());
  expect(screen.patches(w.log)).toEqual([{ title: 'Свадьба Лизы и Марка, второй день' }]);
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('spaces around the same name are no change, and the button stays off', async () => {
  world();
  const screen = await open();
  await screen.type('  Свадьба Лизы и Марка  ');
  expect(screen.save().props.disabled).toBe(true);
});

test('an emptied name is said under the field and the button goes with it — nothing can be sent', async () => {
  const w = world();
  const screen = await open();
  await screen.type('   ');
  expect(screen.field().state).toBe('error');
  expect(screen.field().hint).toBe(ru.edit.noTitle);
  expect(screen.save().props.disabled).toBe(true);
  await screen.press(() => screen.save());
  expect(screen.patches(w.log)).toEqual([]);
  // Even with the days changed too: an empty name is not saved.
  await screen.pickDays(day(10), null);
  expect(screen.save().props.disabled).toBe(true);
});

test('new days go up as whole local days, and a single day sends an end of «null» to take the old end off', async () => {
  const w = world();
  const screen = await open();
  await screen.pickDays(day(14), day(16));
  await screen.press(() => screen.save());
  expect(screen.patches(w.log)).toEqual([
    { event_start: startOfDay(day(14)).toISOString(), event_end: endOfDay(day(16)).toISOString() },
  ]);

  vi.unstubAllGlobals();
  const w2 = world();
  const again = await open();
  await again.pickDays(day(14), null);
  await again.press(() => again.save());
  expect(again.patches(w2.log)).toEqual([{ event_start: startOfDay(day(14)).toISOString(), event_end: null }]);
});

test('the same days picked over again — by other objects, at another hour — are no change at all', async () => {
  world();
  const screen = await open();
  await screen.pickDays(new Date(2026, 8, 12, 17, 30), new Date(2026, 8, 13, 3));
  expect(screen.save().props.disabled).toBe(true);
  // A span that ends on the day it began is one day, and a memory that already is one is unchanged.
  vi.unstubAllGlobals();
  world({ memory: wedding({ event_end: endOfDay(day(12)).toISOString() }) });
  const single = await open();
  expect(single.when().props.value).toEqual({ from: startOfDay(day(12)), to: null });
  await single.pickDays(day(12), null);
  expect(single.save().props.disabled).toBe(true);
  await single.pickDays(day(12), day(13));
  expect(single.save().props.disabled).toBe(false);
});

test('name, days and cover changed together are one request carrying all three', async () => {
  const w = world();
  const screen = await open();
  await screen.type('Свадьба');
  await screen.pickDays(day(1), day(2));
  await act(async () => screen.cover().props.onChoose('a'));
  await screen.press(() => screen.save());
  expect(screen.patches(w.log)).toEqual([
    {
      title: 'Свадьба',
      event_start: startOfDay(day(1)).toISOString(),
      event_end: endOfDay(day(2)).toISOString(),
      cover_media_id: 'a',
    },
  ]);
  expect(w.log.filter((one) => one.method === 'PATCH')).toHaveLength(1);
});

test('the cover is picked on the sheet, waits in the slot, and only «Сохранить» puts it on the memory', async () => {
  const w = world();
  const screen = await open();
  expect(screen.text()).toContain(ru.edit.coverNone);
  expect(screen.text()).toContain(ru.edit.coverInstead);
  expect(screen.text()).not.toContain(ru.edit.coverDrop);
  expect(screen.cover().props.visible).toBe(false);

  await screen.press(() => screen.buttons(ru.edit.coverPick)[0]);
  expect(screen.cover().props.visible).toBe(true);
  // Newest first, as the feed reads; the one still developing is in the grid and cannot be taken.
  expect(screen.cover().findAllByType(Tile).map((one) => one.props.pick)).toEqual(['off', 'off', undefined]);
  await act(async () => screen.cover().props.onChoose('a'));
  expect(screen.cover().props.visible).toBe(false);
  // The slot says which frame it is, by the day it was shot on.
  expect(screen.text()).toContain(ru.edit.coverFrom('13 сентября 2026'));
  expect(screen.text()).toContain(ru.edit.coverWhere);
  expect(screen.buttons(ru.edit.coverReplace)).toHaveLength(1);
  // Nothing has left the phone yet.
  expect(w.log.filter((one) => one.method === 'PATCH')).toEqual([]);
  expect(screen.save().props.disabled).toBe(false);
  await screen.press(() => screen.save());
  expect(screen.patches(w.log)).toEqual([{ cover_media_id: 'a' }]);
});

test('the cover sheet is put away by its own cancel, and nothing was chosen by looking', async () => {
  const w = world();
  const screen = await open();
  await screen.press(() => screen.buttons(ru.edit.coverPick)[0]);
  expect(screen.cover().props.visible).toBe(true);
  await act(async () => screen.cover().props.onCancel());
  expect(screen.cover().props.visible).toBe(false);
  expect(screen.text()).toContain(ru.edit.coverNone);
  expect(screen.save().props.disabled).toBe(true);
  expect(w.log.filter((one) => one.method === 'PATCH')).toEqual([]);
});

test('the slot shows the chosen frame’s own picture, the listing’s signed one until the gallery answers, and none once the cover is off', async () => {
  const slot = (screen: Screen) => screen.root.findByType(CoverSlot).props.uri as string | null;
  const covered = wedding({ cover_media_id: 'b', cover_thumbnail_url: 'https://r2.example/b-signed-by-the-listing' });
  world({ memory: covered });
  const screen = await open();
  // The frame in the gallery is what is drawn once the gallery is here…
  expect(slot(screen)).toBe('https://r2.example/b');
  await screen.press(() => screen.buttons(ru.edit.coverDrop)[0]);
  expect(slot(screen)).toBeNull();
  await act(async () => screen.cover().props.onChoose('a'));
  expect(slot(screen)).toBe('https://r2.example/a');

  // …and while it is not, the picture the listing signed for the cover that is already set — so the
  // slot is never empty over a memory that has one — but never for one that was picked since.
  vi.unstubAllGlobals();
  world({ memory: covered, media: 'offline' });
  const unread = await open();
  expect(slot(unread)).toBe('https://r2.example/b-signed-by-the-listing');
  await unread.press(() => unread.buttons(ru.edit.coverDrop)[0]);
  expect(slot(unread)).toBeNull();
});

test('a cover that is on already comes off with one quiet press, and that is a save of null', async () => {
  const w = world({ memory: wedding({ cover_media_id: 'b', cover_thumbnail_url: 'https://r2.example/b' }) });
  const screen = await open();
  expect(screen.text()).toContain(ru.edit.coverFrom('12 сентября 2026'));
  expect(screen.buttons(ru.edit.coverReplace)).toHaveLength(1);
  expect(screen.save().props.disabled).toBe(true);
  await screen.press(() => screen.buttons(ru.edit.coverDrop)[0]);
  expect(screen.text()).toContain(ru.edit.coverNone);
  expect(screen.buttons(ru.edit.coverDrop)).toHaveLength(0);
  await screen.press(() => screen.save());
  expect(screen.patches(w.log)).toEqual([{ cover_media_id: null }]);
});

test('taking a cover off and putting the same one back is no change', async () => {
  world({ memory: wedding({ cover_media_id: 'b', cover_thumbnail_url: 'https://r2.example/b' }) });
  const screen = await open();
  await screen.press(() => screen.buttons(ru.edit.coverDrop)[0]);
  expect(screen.save().props.disabled).toBe(false);
  await act(async () => screen.cover().props.onChoose('b'));
  expect(screen.save().props.disabled).toBe(true);
});

test('a memory with no frame that could be a cover cannot be given one, and says why', async () => {
  world({ media: [{ ...developing('c', 'me', at(12, 8)), thumbnail_url: 'https://r2.example/c' }] });
  const screen = await open();
  expect(screen.buttons(ru.edit.coverPick)[0].props.disabled).toBe(true);
  expect(screen.text()).toContain(ru.edit.coverNeedsFrames);
});

test('a gallery that would not come is not this screen’s failure: name and days can still be changed, and nothing is claimed', async () => {
  const w = world({ media: 'offline' });
  const screen = await open();
  expect(screen.banners()).toEqual([]);
  // The gallery never answered, so «сначала нужен хотя бы один кадр» would be a claim nobody looked into.
  expect(screen.text()).not.toContain(ru.edit.coverNeedsFrames);
  expect(screen.buttons(ru.edit.coverPick)[0].props.disabled).toBe(true);
  await screen.type('Свадьба');
  await screen.press(() => screen.save());
  expect(screen.patches(w.log)).toEqual([{ title: 'Свадьба' }]);
});

test('a save that fails says so in words a person can act on, keeps everything typed, and can be pressed again', async () => {
  const w = world({ onPatch: refused(500, 'internal detail') });
  const screen = await open();
  await screen.type('Свадьба');
  await screen.pickDays(day(14), null);
  await screen.press(() => screen.save());
  // Not the api's own wording — the same line whatever went wrong.
  expect(screen.banners()).toEqual([ru.edit.failed]);
  expect(router.back).not.toHaveBeenCalled();
  expect(screen.field().value).toBe('Свадьба');
  expect(screen.when().props.value).toEqual({ from: day(14), to: null });
  expect(screen.save().props.disabled).toBe(false);
  expect(screen.save().props.busy).toBe(false);

  // Pressed again, it goes, and the line is gone with the failure.
  w.onPatch = undefined;
  await screen.press(() => screen.save());
  expect(screen.banners()).toEqual([]);
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(w.log.filter((one) => one.method === 'PATCH')).toHaveLength(2);
});

test('while it is saving, the button is busy and the fields and the calendar are shut — but «Назад» is not', async () => {
  const slow = later<Memory>();
  const w = world({ onPatch: slow.promise });
  const screen = await open();
  await screen.type('Свадьба');
  await act(async () => void screen.save().props.onPress());
  expect(screen.save().props.busy).toBe(true);
  expect(screen.field().editable).toBe(false);
  expect(screen.when().props.disabled).toBe(true);
  expect(screen.buttons(ru.edit.coverPick)[0].props.disabled).toBe(true);
  expect(screen.back().props.disabled).toBeFalsy();
  // Back where it was once the answer comes: one request, and the screen leaves.
  await act(async () => slow.settle(w.memory));
  expect(w.log.filter((one) => one.method === 'PATCH')).toHaveLength(1);
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(screen.save().props.busy).toBe(false);
});

test('in daylight the screen is drawn in the day’s tokens and carries none of the night’s', async () => {
  world();
  // The night is what the harness starts in, and the detector sees it — or the empty answer below proves nothing.
  expect(themesShown((await open()).root).night.length).toBeGreaterThan(0);
  await setTheme('light');
  try {
    const shown = themesShown((await open()).root);
    expect(shown.night).toEqual([]);
    expect(shown.day.length).toBeGreaterThan(0);
  } finally {
    await setTheme('dark');
  }
});
