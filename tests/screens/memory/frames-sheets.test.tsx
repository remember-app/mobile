import { beforeAll, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import type { FrameInfo, Label } from '@/api';
import { FILTER_NONE, SORT_DEFAULT, type Filter, type Sort } from '@/lib/frames';
import { allDifferent, story } from '@/kit/story';
import { FilterSheet, FrameInfoSheet, SortSheet } from '@/screens/memory/frames-sheets';
import { setTheme, ThemePin } from '@/theme';

/**
 * The sheets of a memory's feed (spec 8): `SheetFrameInfo`, which draws material rather than
 * controls, and the two the feed is tuned from — `SheetFilter` and `SheetSort`. All three are
 * surfaces that hold nothing of their own but the draft, so all three can be rendered here as the
 * states they have.
 *
 * The rows of the first are `frames.test.ts`'s (`frameFacts`) and so is everything the other two
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
 * is handed. The boxes come in the api's own order, shared first: one everybody sees and one that
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
const days = [
  { at: new Date(2026, 8, 13).getTime(), count: 312 },
  { at: new Date(2026, 8, 12).getTime(), count: 88 },
];

const filter = (over: Partial<Filter> = {}, shown = 486, boxes: readonly Label[] = labels) => (
  <FilterSheet
    people={people}
    labels={boxes}
    days={days}
    value={{ ...FILTER_NONE, ...over }}
    count={() => shown}
    onApply={() => {}}
    onCancel={() => {}}
  />
);

const sorting = (over: Partial<Sort> = {}) => (
  <SortSheet value={{ ...SORT_DEFAULT, ...over }} onChange={() => {}} onDone={() => {}} />
);

test('the filter is four groups, and a day chip carries what that day holds', () => {
  const whole = story(filter());
  for (const line of [
    'Фильтры',
    'Сбросить',
    // The eyebrows are drawn in caps, the way the layout writes every heading over a row.
    'КТО ПРИНЁС',
    // The name they are called by, with the whole of it still in the circle.
    '>Лиза<',
    'ЛМ',
    'ТИП',
    'Всё',
    'Фото',
    'Видео',
    'ЛЕЙБЛЫ',
    'Лучшее',
    'ДЕНЬ',
    'Все дни',
    '13 сент',
    '312',
    'Другая дата',
  ]) {
    expect(whole).toContain(line);
  }
  // The calendar is behind «Другая дата» and not under the row from the start: it is for the day
  // the row is not offering, which on most memories is no day at all.
  expect(whole).not.toContain('Сентябрь 2026');
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
  expect(story(filter({}, 486, labels.map((one) => ({ ...one, shared: true }))))).not.toBe(whole);
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

test('the sort sheet is the order, the three cuts, and the one switch about dates', () => {
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
    'Даты между днями',
    'Выключено — дата видна только на полосе у края, пока листаете.',
    'Готово',
  ]) {
    expect(whole).toContain(line);
  }
  // The switch on, the feed cut by people, and the switch held shut because of it — three sheets.
  allDifferent({
    plain: sorting(),
    dated: sorting({ dates: true }),
    byPeople: sorting({ by: 'person' }),
  });
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
    sorting({ dates: true }),
  ]) {
    const night = story(<ThemePin value="dark">{both}</ThemePin>);
    const day = story(<ThemePin value="light">{both}</ThemePin>);
    expect(day).not.toBe(night);
  }
  expect(story(<ThemePin value="light">{sorting()}</ThemePin>)).toContain('Даты между днями');
});
