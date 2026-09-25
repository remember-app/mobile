import { beforeAll, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import type { FrameInfo, Label } from '@/api';
import { allDifferent, rule, story } from '@/kit/story';
import { FILTER_NONE, type Filter, type FilterDay, SORT_DEFAULT, type Sort } from '@/lib/frames';
import { FilterSheet, FrameInfoSheet, SortSheet } from '@/screens/memory/frames-sheets';
import { setTheme, ThemePin } from '@/theme';

/**
 * The sheets of a memory's feed (spec 8): `SheetFrameInfo`, which draws material rather than
 * controls, and the two the feed is tuned from — `SheetFilter` and `SheetSort`. All three are
 * surfaces that hold nothing of their own but the draft, so all three can be rendered here as the
 * states they have.
 *
 * The rows of the first are `tests/lib/frames.test.ts`'s (`frameFacts`) and so is everything the other two
 * decide (`framesMatching`, `groupFrames`); what is read here is the sheets — what stands on them,
 * what the buttons say in each state, and that every one of them is drawn in the theme the app is
 * in.
 */

beforeAll(async () => {
  await setTheme('dark');
});

const told = (over: Partial<FrameInfo> = {}): FrameInfo => ({
  id: 'a',
  file_name: 'IMG_4471.HEIC',
  size_bytes: '4200000',
  // Local days, because the sheet writes local ones: an instant spelled in UTC is the day before, for
  // anybody west of it, and the line «принёс 15 сентября» would read 14.
  captured_at: new Date(2026, 8, 13, 21, 47).toISOString(),
  created_at: new Date(2026, 8, 15, 9, 12).toISOString(),
  width: 4032,
  height: 3024,
  camera_model: 'iPhone 15 Pro',
  focal_length_mm: 24,
  aperture: 1.8,
  latitude: 55.518,
  longitude: 37.53,
  uploaded_by: { id: 'u', username: 'mark', name: 'Марк Ковалёв', media_count: 96 },
  montages: [{ id: 'f', duration_seconds: 60, start_seconds: 72 }],
  ...over,
});

const sheet = (over: Partial<FrameInfo> | null = {}, error: string | null = null) => (
  <FrameInfoSheet
    visible
    thumb="https://example.test/f10.jpg"
    title="13 сентября, 21:47"
    meta="суббота · Свадьба Лизы и Марка"
    info={over === null ? null : told(over)}
    error={error}
    onFilm={() => {}}
    onClose={() => {}}
  />
);

test('the whole sheet: when it was, who brought it, the file, the camera, the place, the movie', () => {
  const whole = story(sheet());
  for (const line of [
    '13 сентября, 21:47',
    'суббота · Свадьба Лизы и Марка',
    'Марк Ковалёв',
    'принёс 15 сентября · всего 96 кадров',
    'IMG_4471.HEIC · 4,2 МБ',
    '4032 × 3024',
    'iPhone 15 Pro · 24 мм · f/1.8',
    '55.518, 37.53',
    'В роликах',
    // A montage has no name until templates arrive: its length is what it is called, and the row
    // says where in it this frame stands.
    'Ролик на 1:00',
    'на 1:12',
  ]) {
    expect(whole).toContain(line);
  }
});

test('a frame in no movie loses the block, and one the worker never read loses the rows', () => {
  expect(story(sheet({ montages: [] }))).not.toContain('В роликах');
  // Nothing the worker writes, and no name on the file: the head and the person stay, and «Файл»
  // is left holding the one thing that is known.
  const bare = story(
    sheet({
      file_name: undefined,
      width: null,
      height: null,
      camera_model: null,
      focal_length_mm: null,
      aperture: null,
      latitude: null,
      longitude: null,
      montages: [],
    }),
  );
  expect(bare).toContain('Марк Ковалёв');
  expect(bare).toContain('4,2 МБ');
  for (const label of ['Размер', 'Камера', 'Место', 'В роликах']) expect(bare).not.toContain(label);
  // And not a dash anywhere: an empty line is not drawn at all (spec 8).
  expect(bare).not.toContain('—');
});

test('the three states of the sheet are three sheets', () => {
  allDifferent({
    // The head is up while the one read behind it is in the air — wordless, because the head
    // already says which frame this is about.
    reading: sheet(null),
    failed: sheet(null, 'Нет связи с сервером'),
    whole: sheet(),
  });
  expect(story(sheet(null, 'Нет связи с сервером'))).toContain('Нет связи с сервером');
});

/**
 * Two people who brought something, two boxes to put it in and two days of it — what `SheetFilter`
 * is handed. The 13th of September 2026 is a Sunday, the 12th a Saturday. The boxes come in the api's own order, shared first: one everybody sees and one that
 * is somebody's own, which is the pair the lock tells apart.
 */
const people = [
  { id: 'liza', name: 'Лиза Морозова' },
  { id: 'mark', name: 'Марк Ковалёв' },
];
const box = (over: Partial<Label>): Label => ({
  id: 'best',
  title: 'Лучшее',
  color: 1,
  shared: true,
  mine: true,
  can_edit: true,
  can_add_media: true,
  media_count: 23,
  ...over,
});
const labels = [
  box({}),
  box({ id: 'mine', title: 'Для себя', color: 6, shared: false, media_count: 9 }),
];
const days: FilterDay[] = [
  { at: new Date(2026, 8, 13).getTime(), count: 312, fill: 1 },
  { at: new Date(2026, 8, 12).getTime(), count: 88, fill: 0.28 },
];

const filter = (
  over: Partial<Filter> = {},
  shown = 486,
  boxes: readonly Label[] = labels,
  offered: readonly FilterDay[] = days,
  who: readonly { id: string; name: string }[] = people,
) => (
  <FilterSheet
    people={who}
    labels={boxes}
    days={offered}
    value={{ ...FILTER_NONE, ...over }}
    count={() => shown}
    onApply={() => {}}
    onCancel={() => {}}
  />
);

const sorting = (over: Partial<Sort> = {}) => (
  <SortSheet value={{ ...SORT_DEFAULT, ...over }} onChange={() => {}} onDone={() => {}} />
);

test('the filter is four groups: faces, the type, the boxes and the day tiles', () => {
  const whole = story(filter());
  for (const line of [
    'Фильтры',
    'Сбросить',
    // The eyebrows are drawn in caps, the way the layout writes every heading over a row.
    'КТО ПРИНЁС',
    // Faces and no names (spec 8): the initials in the circle, the whole name read out.
    '>ЛМ<',
    '>МК<',
    'aria-label="Лиза Морозова"',
    'aria-label="Марк Ковалёв"',
    'ТИП',
    'Всё',
    'Фото',
    'Видео',
    'ЛЕЙБЛЫ',
    'Лучшее',
    'ДЕНЬ',
    '>Все дни<',
    'aria-label="Выбрать другую дату"',
    // A tile: the figure, the weekday, the count declined — and all of it in words out loud.
    '>13<',
    '>вс<',
    '>312 кадров<',
    'aria-label="13 сентября, вс, 312 кадров"',
    '>12<',
    '>сб<',
    '>88 кадров<',
    // The bar is the day's `fill`, and the fullest day's runs the whole track.
    'width:28%',
    'width:100%',
  ]) {
    expect(whole).toContain(line);
  }
  // No name under a face and no chip per day any more (spec 7.0.1).
  expect(whole).not.toContain('>Лиза<');
  expect(whole).not.toContain('>Лиза Морозова<');
  expect(whole).not.toContain('>13 сент<');
  expect(whole).not.toContain('Другая дата<');
  // The tiles run in date order, the earliest on the left — whatever order the days arrive in.
  expect(whole.indexOf('12 сентября, сб')).toBeLessThan(whole.indexOf('13 сентября, вс'));
  // The calendar is behind its button and not under the tiles from the start: it is for the day
  // the tiles are not offering, which on most memories is no day at all.
  expect(whole).not.toContain('Сентябрь 2026');
});

/** `n` days of September 2026 from the 10th on, the 1st of them holding 1 frame, the next 2… */
const daysOf = (n: number): FilterDay[] =>
  Array.from({ length: n }, (_, at) => ({
    at: new Date(2026, 8, 10 + at).getTime(),
    count: at + 1,
    fill: (at + 1) / n,
  }));
const tilesOf = (drawn: string) =>
  [...drawn.matchAll(/aria-label="(\d+) сентября, [а-я]+, \d+ кадр/g)].map((one) => one[1]);

test('a tile per day up to three; past three, the three fullest — and never a row that scrolls', () => {
  expect(tilesOf(story(filter({}, 1, labels, daysOf(1))))).toEqual(['10']);
  expect(tilesOf(story(filter({}, 3, labels, daysOf(2))))).toEqual(['10', '11']);
  expect(tilesOf(story(filter({}, 6, labels, daysOf(3))))).toEqual(['10', '11', '12']);
  // Four days and a week: the fullest three, still earliest first; the rest are the calendar's.
  expect(tilesOf(story(filter({}, 10, labels, daysOf(4))))).toEqual(['11', '12', '13']);
  expect(tilesOf(story(filter({}, 28, labels, daysOf(7))))).toEqual(['14', '15', '16']);
  // And the head of the block is the same whatever the count: «Все дни» and the calendar.
  for (const n of [1, 2, 3, 4, 7]) {
    const drawn = story(filter({}, 1, labels, daysOf(n)));
    expect(drawn).toContain('>Все дни<');
    expect(drawn).toContain('aria-label="Выбрать другую дату"');
  }
});

/** `n` people, each a name of their own. */
const crowd = (n: number) =>
  Array.from({ length: n }, (_, at) => ({ id: `p${at}`, name: `Гость Номер${at + 1}` }));
const facesOf = (drawn: string) => [...drawn.matchAll(/aria-label="Гость Номер(\d+)"/g)].length;

test('every person who brought something is a face — one, six, seven or twelve, and no «+N»', () => {
  for (const n of [1, 6, 7, 12]) {
    const drawn = story(filter({}, 1, labels, days, crowd(n)));
    expect(facesOf(drawn)).toBe(n);
    expect(drawn).not.toMatch(/>\+\d+</);
  }
});

test('a chosen face, a chosen tile and «Все дни» are each a sheet of their own', () => {
  allDifferent({
    nothing: filter(),
    person: filter({ people: new Set(['liza']) }, 212),
    day: filter({ days: new Set([days[0].at]) }, 312),
    both: filter({ people: new Set(['liza']), days: new Set([days[0].at]) }, 100),
  });
});

test('the boxes stand third, between the type and the days — and that is how one is looked at', () => {
  // Spec 10.8.2: the row of labels lands between «ТИП» and «ДЕНЬ», read off the sheet itself.
  const whole = story(filter());
  expect(whole.indexOf('ТИП')).toBeLessThan(whole.indexOf('ЛЕЙБЛЫ'));
  expect(whole.indexOf('ЛЕЙБЛЫ')).toBeLessThan(whole.indexOf('ДЕНЬ'));
  // The chip is the kit's label chip (detail 73): the colour the api's cell stands for, the name,
  // and what the box holds — read out as one thing, the way a day's count is. Which paint each cell
  // is, is `kit/chip.test.tsx`'s and `@/theme`'s; what is read here is that the cell reaches the
  // chip at all, so two boxes painted differently are drawn differently.
  expect(story(filter({}, 486, [box({ color: 3 })]))).not.toBe(story(filter({}, 486, [box({})])));
  expect(whole).toContain('aria-label="Лучшее 23"');
  expect(whole).toContain('aria-label="Для себя 9"');
  // A private box wears the lock in front of its name and a shared one wears nothing (spec 10.8.2),
  // so the same row of boxes drawn as all-shared is a different row.
  expect(
    story(
      filter(
        {},
        486,
        labels.map((one) => ({ ...one, shared: true })),
      ),
    ),
  ).not.toBe(whole);
  // Nothing marked, one box marked, both marked: three sheets, and the last is «или» — the frames
  // in either box (`framesMatching`).
  allDifferent({
    none: filter(),
    one: filter({ labels: new Set(['best']) }, 23),
    both: filter({ labels: new Set(['best', 'mine']) }, 30),
  });
  // A memory without a single box has no group here at all rather than an empty row under a
  // heading; a person with no private box of their own just gets a shorter row.
  const bare = story(filter({}, 486, []));
  expect(bare).not.toContain('ЛЕЙБЛЫ');
  expect(bare).toContain('ДЕНЬ');
  expect(story(filter({}, 486, [labels[0]]))).not.toContain('Для себя');
});

test('a box whose frames the other groups have taken cannot be applied, and «Сбросить» drops it', () => {
  // Spec 10.8.2 — «выбран лейбл, из которого все кадры сняты фильтром „Тип“»: the button counts
  // what the whole draft comes to, so this is the same refusal any other empty combination gets.
  expect(story(filter({ labels: new Set(['best']), kind: 'video' }, 0))).toContain(
    'Ни одного кадра под эти условия',
  );
  // And a label is a choice like any other to everything else on the sheet: the main button counts
  // instead of offering the lot, which is the same `chosen` that keeps «Сбросить» live.
  expect(story(filter({ labels: new Set(['best']) }, 23))).toContain('Показать 23 кадра');
  expect(story(filter())).toContain('Показать все');
});

test('the main button counts what it will show, and says when there is nothing to', () => {
  // Nothing held back at all: there is no count worth promising, so the button offers the lot.
  expect(story(filter())).toContain('Показать все');
  // A choice: the number is what that choice comes to, worked out on the spot by the face.
  expect(story(filter({ kind: 'video' }, 184))).toContain('Показать 184 кадра');
  // And a choice that comes to nothing cannot be applied at all (spec 8).
  expect(story(filter({ kind: 'video' }, 0))).toContain('Ни одного кадра под эти условия');
  allDifferent({
    nothing: filter(),
    counted: filter({ kind: 'video' }, 184),
    empty: filter({ kind: 'video' }, 0),
  });
});

test('the sort sheet is the order and the three cuts, and nothing about dates', () => {
  const whole = story(sorting());
  for (const line of [
    'Сортировка',
    'Порядок',
    'Сначала новые',
    'Сначала старые',
    'Собрать в группы',
    'Не собирать',
    'По людям',
    'По типу',
    'Готово',
  ]) {
    expect(whole).toContain(line);
  }
  // Whether the days are written between the strips is the account's «Даты между днями» (spec 8,
  // `SheetSort`), so there is no switch here at all — nor its line, in either language.
  expect(whole).not.toContain('role="switch"');
  for (const gone of ['Даты между днями', 'Dates between days', 'Выключено —', 'Off —']) {
    expect(whole).not.toContain(gone);
  }
  allDifferent({
    plain: sorting(),
    oldest: sorting({ order: 'oldest' }),
    byPeople: sorting({ by: 'person' }),
  });
});

/** The sheet's own style: its rhythm, and its floor when it has one. */
const sheetStyle = (markup: string) => /style="(gap:[^"]*padding-bottom:[^"]*)"/.exec(markup)?.[1];
/** The classes of the block a group's heading opens: the heading and the row it introduces. */
const groupOf = (markup: string, heading: string) =>
  new RegExp(`<div class="([^"]+)"><h1[^>]*>${heading}</h1>`).exec(markup)?.[1];

test('the two tuning sheets stand as drawn: 20 between blocks, 10 under a heading, 381 and 560 tall', () => {
  const sort = story(sorting());
  const filters = story(filter());
  // Spec 4 and 10.10: `SheetSort` is 381 — the layout's 380 squeezed its handle and «Готово» — and
  // `SheetFilter` 560, both a floor the sheet grows past rather than a height it is cut to.
  expect(sheetStyle(sort)).toMatch(/^gap:20px;.*min-height:381px;/);
  expect(sheetStyle(filters)).toMatch(/^gap:20px;.*min-height:560px;/);
  for (const drawn of [sort, filters]) expect(drawn).not.toMatch(/[^-]height:\s*(381|560)px/);
  // The filter scrolls, and keeps the same 20 inside the scroll.
  expect(filters).toContain('<div class="css-view-g5y9jx" style="gap:20px">');
  // One style for a heading and its row on both sheets: 10 down to the segments and the chips, and
  // 12 down to the faces (spec 8).
  for (const [drawn, heading] of [
    [sort, 'ПОРЯДОК'],
    [sort, 'СОБРАТЬ В ГРУППЫ'],
    [filters, 'ТИП'],
    [filters, 'ЛЕЙБЛЫ'],
  ]) {
    expect(groupOf(drawn, heading), heading).toContain(rule('gap:10px'));
  }
  expect(groupOf(filters, 'КТО ПРИНЁС')).toContain(rule('gap:12px'));
});

test('the sheet of a frame sets its facts out 14 apart, as `SheetFrameInfo` draws them', () => {
  expect(sheetStyle(story(sheet()))).toMatch(/^gap:14px;/);
  // «В роликах» and the movie under it stand 8 apart.
  expect(groupOf(story(sheet()), 'В роликах')).toContain(rule('gap:8px'));
});

test('the sheet is drawn in the theme the app is in, because daylight reaches it', () => {
  // The window under it is pinned dark in both themes (`frame-viewer.tsx`), and the sheet is
  // deliberately outside that pin: it is its own surface over the screen, and in daylight it is a
  // daylight surface. Every colour on it is a token, so the two come out as two different sheets.
  const night = story(<ThemePin value="dark">{sheet()}</ThemePin>);
  const day = story(<ThemePin value="light">{sheet()}</ThemePin>);
  expect(day).not.toBe(night);
  // And the same words either way: a theme is a colour and nothing else (spec 2).
  for (const drawn of [night, day]) expect(drawn).toContain('iPhone 15 Pro · 24 мм · f/1.8');
});

test('and so are the two the feed is tuned from — nothing on them is a colour of its own', () => {
  // The same check for `SheetFilter` and `SheetSort` (TASK-208): every chip, segment and switch on
  // them is the kit drawing itself, so the whole surface swaps with the theme and the words do not.
  // The labels row is in it (TASK-214): a box's colour is the kit's palette cell read through the
  // theme (`labelTint`), never a paint this sheet keeps of its own.
  for (const both of [
    filter({ kind: 'photo' }, 184),
    filter({ labels: new Set(['best', 'mine']) }, 30),
    sorting({ by: 'person' }),
  ]) {
    const night = story(<ThemePin value="dark">{both}</ThemePin>);
    const day = story(<ThemePin value="light">{both}</ThemePin>);
    expect(day).not.toBe(night);
  }
  expect(story(<ThemePin value="light">{sorting()}</ThemePin>)).toContain('Собрать в группы');
});
