import { beforeAll, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import type { FrameInfo } from '@/api';
import { allDifferent, story } from '@/kit/story';
import { FrameInfoSheet } from '@/memory/frames-sheets';
import { setTheme, ThemePin } from '@/theme';

/**
 * `SheetFrameInfo` (spec 8) — the one sheet of this file that draws material rather than controls,
 * and the only one worth a story: what it shows is decided by what the server knew, and every one
 * of those states is a different sheet.
 *
 * The rows themselves are `frames.test.ts`'s (`frameFacts`); what is read here is the sheet — its
 * head, the person, the movies, and the fact that it is drawn in whichever theme the app is in.
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
