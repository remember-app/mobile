import { beforeAll, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import type { FrameInfo } from '@/api';
import { FILTER_NONE, SORT_DEFAULT, type Filter, type Sort } from '@/frames';
import { allDifferent, story } from '@/kit/story';
import { FilterSheet, FrameInfoSheet, SortSheet } from '@/memory/frames-sheets';
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
  captured_at: '2026-09-13T18:47:00.000Z',
  created_at: '2026-09-15T09:12:00.000Z',
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

/** Two people who brought something, and two days of it — what `SheetFilter` is handed. */
const people = [
  { id: 'liza', name: 'Лиза Морозова' },
  { id: 'mark', name: 'Марк Ковалёв' },
];
const days = [
  { at: new Date(2026, 8, 13).getTime(), count: 312 },
  { at: new Date(2026, 8, 12).getTime(), count: 88 },
];

const filter = (over: Partial<Filter> = {}, shown = 486) => (
  <FilterSheet
    people={people}
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

test('the filter is three groups, and a day chip carries what that day holds', () => {
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
  for (const both of [filter({ kind: 'photo' }, 184), sorting({ dates: true })]) {
    const night = story(<ThemePin value="dark">{both}</ThemePin>);
    const day = story(<ThemePin value="light">{both}</ThemePin>);
    expect(day).not.toBe(night);
  }
  expect(story(<ThemePin value="light">{sorting()}</ThemePin>)).toContain('Даты между днями');
});
