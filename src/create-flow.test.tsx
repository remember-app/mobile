import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
vi.mock('expo-router', () => ({ useRouter: () => router }));
// A text input listens on the browser's `document`, which a test renderer has none of.
vi.mock('@/kit', async (original) => ({ ...(await original<typeof import('@/kit')>()), Field: () => null }));

import { Pressable } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import CreateMemoryScreen from '@/app/create';
import { endOfDay, startOfDay } from '@/dates';
import { Banner, Button, Calendar, Chip, Field, IconButton } from '@/kit';
import { EventWhen } from '@/memory/when';
import { ru } from '@/strings';
import { later, memory, refused, serve, type Asked } from '@/test-api';
import { setTheme } from '@/theme';
import { mounted, mountsTrees, themesShown } from '@/test-renderer';

/**
 * `Create` (spec 8) — a name and the days it was, on the real api client over a stand-in server.
 * What is read is the one request the button sends: the name trimmed, the first day as the start of
 * that local day, and an end only when the memory was more than one day.
 *
 * «Today» is fixed to Wednesday 16 September 2026, noon, because three of the four quick days are
 * counted from it.
 */

mountsTrees();

const NOW = new Date(2026, 8, 16, 12);
const day = (d: number) => new Date(2026, 8, d);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  router.back.mockClear();
  router.replace.mockClear();
  router.canGoBack.mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function world(answer: unknown = memory({ id: 'made' })) {
  return { log: serve((asked) => (asked.method === 'POST' && asked.path === '/memories' ? answer : undefined)) };
}
const posts = (log: Asked[]) => log.filter((one) => one.method === 'POST').map((one) => one.body);

async function open() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<CreateMemoryScreen />));
  });
  const root = tree.root;
  const screen = {
    root,
    field: () => root.findByType(Field).props as { value: string; editable?: boolean },
    type: (text: string) => act(async () => root.findByType(Field).props.onChangeText(text)),
    when: () => root.findByType(EventWhen).props as { value: { from: Date; to: Date | null }; disabled?: boolean },
    submit: () => root.findAllByType(Button).find((one) => one.props.label === ru.create.submit)!,
    press: (find: () => { props: { onPress?: () => void } }) => act(async () => find().props.onPress?.()),
    quick: (label: string) => () => root.findAllByType(Chip).find((one) => one.props.label === label)!,
    pickDays: (from: Date, to: Date | null) => act(async () => root.findByType(EventWhen).props.onChange({ from, to })),
    banners: () => root.findAllByType(Banner).map((one) => one.props.text as string),
    text: () => JSON.stringify(tree.toJSON()),
  };
  return screen;
}

test('the button is off until there is a name, and a name of spaces is not a name', async () => {
  world();
  const screen = await open();
  expect(screen.submit().props.disabled).toBe(true);
  // Off for want of a name and for no other reason: nothing is busy and nothing is shut.
  expect(screen.submit().props.busy).toBe(false);
  expect(screen.field().editable).toBe(true);
  expect(screen.when().disabled).toBe(false);
  expect(screen.banners()).toEqual([]);
  await screen.type('    ');
  expect(screen.submit().props.disabled).toBe(true);
  await screen.type('Свадьба');
  expect(screen.submit().props.disabled).toBe(false);
});

test('one day, the default, sends the name trimmed and the start of today — and no end at all', async () => {
  const w = world();
  const screen = await open();
  expect(screen.when().value).toEqual({ from: startOfDay(NOW), to: null });
  await screen.type('  Свадьба Лизы и Марка ');
  await screen.press(() => screen.submit());
  const [body] = posts(w.log) as Record<string, unknown>[];
  expect(body).toEqual({ title: 'Свадьба Лизы и Марка', event_start: startOfDay(NOW).toISOString() });
  // Not «null» and not the same day again: the key is not there, which is how the api hears «one day».
  expect('event_end' in body).toBe(false);
});

test('a range sends its first day’s start and its last day’s end, and picking one day again drops the end', async () => {
  const w = world();
  const screen = await open();
  await screen.type('Поход');
  await screen.pickDays(day(10), day(12));
  await screen.press(() => screen.submit());
  expect(posts(w.log)).toEqual([
    { title: 'Поход', event_start: startOfDay(day(10)).toISOString(), event_end: endOfDay(day(12)).toISOString() },
  ]);

  vi.unstubAllGlobals();
  const again = world();
  const second = await open();
  await second.type('Поход');
  await second.pickDays(day(10), day(12));
  await second.pickDays(day(14), null);
  await second.press(() => second.submit());
  const [body] = posts(again.log) as Record<string, unknown>[];
  expect(body).toEqual({ title: 'Поход', event_start: startOfDay(day(14)).toISOString() });
  expect('event_end' in body).toBe(false);
});

test('the four quick days are whole answers, and the weekend on a Saturday is one day with no end', async () => {
  const cases: [string, Date, Date | null][] = [
    [ru.create.today, day(16), null],
    [ru.create.yesterday, day(15), null],
    // Wednesday: the weekend just gone is the 12th and 13th.
    [ru.create.weekend, day(12), day(13)],
    // A week is seven days and today is one of them.
    [ru.create.week, day(10), day(16)],
  ];
  for (const [label, from, to] of cases) {
    const w = world();
    const screen = await open();
    await screen.type('Праздник');
    await screen.press(screen.quick(label));
    expect(screen.when().value, label).toEqual({ from: startOfDay(from), to: to && startOfDay(to) });
    await screen.press(() => screen.submit());
    const [body] = posts(w.log) as Record<string, unknown>[];
    expect(body.event_start, label).toBe(startOfDay(from).toISOString());
    expect(body.event_end, label).toBe(to ? endOfDay(to).toISOString() : undefined);
    vi.unstubAllGlobals();
  }

  // Saturday the 12th: no Sunday has happened, and a memory cannot be of tomorrow.
  vi.setSystemTime(new Date(2026, 8, 12, 12));
  const w = world();
  const screen = await open();
  await screen.type('Праздник');
  await screen.press(screen.quick(ru.create.weekend));
  await screen.press(() => screen.submit());
  const [body] = posts(w.log) as Record<string, unknown>[];
  expect(body.event_start).toBe(startOfDay(day(12)).toISOString());
  expect('event_end' in body).toBe(false);
});

test('a quick day pressed over a range takes the whole range with it, and no end is left over', async () => {
  const w = world();
  const screen = await open();
  await screen.type('Праздник');
  await screen.pickDays(day(1), day(5));
  await screen.press(screen.quick(ru.create.yesterday));
  await screen.press(() => screen.submit());
  const [body] = posts(w.log) as Record<string, unknown>[];
  expect(body).toEqual({ title: 'Праздник', event_start: startOfDay(day(15)).toISOString() });
});

test('a memory cannot be of tomorrow: the calendar answers up to today, today included', async () => {
  world();
  const screen = await open();
  expect(screen.root.findByType(Calendar).props.max).toEqual(startOfDay(NOW));
  const cell = (d: number) =>
    screen.root.findAllByType(Pressable).find((one) => one.props.accessibilityLabel === `${d} сентября 2026`)!;
  expect(cell(16).props.disabled).toBe(false);
  expect(cell(17).props.disabled).toBe(true);
  expect(cell(1).props.disabled).toBe(false);
});

test('the calendar is a gesture: a first tap is a day, the second closes the range, and the date line says how long', async () => {
  world();
  const screen = await open();
  const tap = (d: number) =>
    act(async () => screen.root.findByType(Calendar).props.onPick(day(d)));
  expect(screen.text()).toContain('16 сентября 2026');
  expect(screen.text()).not.toContain(ru.create.days(1));
  await tap(10);
  expect(screen.when().value).toEqual({ from: day(10), to: null });
  await tap(12);
  expect(screen.when().value).toEqual({ from: day(10), to: day(12) });
  expect(screen.text()).toContain('10–12 сентября');
  expect(screen.text()).toContain(ru.create.days(3));
  // A third tap starts over, and so does one before the first day.
  await tap(14);
  expect(screen.when().value).toEqual({ from: day(14), to: null });
  await tap(9);
  expect(screen.when().value).toEqual({ from: day(9), to: null });
});

test('paging the calendar by month never moves what is picked, and a quick day brings the grid to itself', async () => {
  world();
  const screen = await open();
  await act(async () => screen.root.findByType(Calendar).props.onPick(day(10)));
  await act(async () => screen.root.findByType(Calendar).props.onPick(day(12)));
  const month = () => screen.root.findByType(Calendar).props.month as Date;
  expect(month().getMonth()).toBe(8);
  const arrows = () => screen.root.findByType(Calendar).findAllByType(IconButton);
  await screen.press(() => arrows().find((one) => one.props.label === ru.create.prevMonth)!);
  await screen.press(() => arrows().find((one) => one.props.label === ru.create.prevMonth)!);
  expect(month().getMonth()).toBe(6);
  expect(month().getDate()).toBe(1);
  expect(screen.when().value).toEqual({ from: day(10), to: day(12) });
  // «Вчера» is a day in September again: the grid follows the first day of what was picked.
  await screen.press(screen.quick(ru.create.yesterday));
  expect(month().getMonth()).toBe(8);
});

test('a refused order says why in the api’s words, keeps the form as it was, and can be sent again', async () => {
  let answer: unknown = refused(400, 'end before start');
  const log = serve(() => answer);
  const screen = await open();
  await screen.type('Свадьба');
  await screen.pickDays(day(10), day(12));
  await screen.press(() => screen.submit());
  expect(screen.banners()).toEqual(['end before start']);
  expect(router.back).not.toHaveBeenCalled();
  expect(screen.field().value).toBe('Свадьба');
  expect(screen.when().value).toEqual({ from: day(10), to: day(12) });
  // The button is not left spinning over a request that already failed.
  expect(screen.submit().props.busy).toBe(false);
  expect(screen.submit().props.disabled).toBe(false);

  answer = memory({ id: 'made' });
  await screen.press(() => screen.submit());
  expect(screen.banners()).toEqual([]);
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(log.filter((one) => one.method === 'POST')).toHaveLength(2);
});

test('no connection is said in its own words', async () => {
  serve(() => 'offline');
  const screen = await open();
  await screen.type('Свадьба');
  await screen.press(() => screen.submit());
  expect(screen.banners()).toEqual([ru.error.offline]);
});

test('while the order is in the air the button is busy and the form is shut', async () => {
  const slow = later<unknown>();
  serve(() => slow.promise);
  const screen = await open();
  await screen.type('Свадьба');
  await act(async () => void screen.submit().props.onPress());
  expect(screen.submit().props.busy).toBe(true);
  expect(screen.field().editable).toBe(false);
  expect(screen.when().disabled).toBe(true);
  await act(async () => slow.settle(memory()));
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('a placed memory leaves by the back it arrived on, or the list when there is none', async () => {
  world();
  const screen = await open();
  await screen.type('Свадьба');
  await screen.press(() => screen.submit());
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();

  router.back.mockClear();
  router.canGoBack.mockReturnValue(false);
  vi.unstubAllGlobals();
  world();
  const landed = await open();
  // No back to go to, so no back button is drawn either.
  expect(landed.root.findAllByType(IconButton).some((one) => one.props.label === ru.action.back)).toBe(false);
  await landed.type('Свадьба');
  await landed.press(() => landed.submit());
  expect(router.replace).toHaveBeenCalledWith('/');
  expect(router.back).not.toHaveBeenCalled();
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
