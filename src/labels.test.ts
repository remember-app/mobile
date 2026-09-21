import { expect, test, vi } from 'vitest';

// `@/theme` stands on two native expo modules vitest has nothing to run, and `labelTint` asks it for
// the eight colours.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

import type { Label, MediaItem } from '@/api';
import { filed, filing, labelGroups, labelNameOk, labelTint, withLabel } from '@/labels';
import { themes } from '@/theme';

/**
 * What a press on a label row does to a selection, and what the gallery looks like the moment after
 * (doc-13, spec 7.7). The sheet itself is words and shapes; these are the rules underneath it, and
 * the one that cost the most to get right is the half-filed selection.
 */

const frame = (id: string, labels: string[] = []): MediaItem => ({
  id,
  kind: 'photo',
  status: 'ready',
  uploaded_by: 'u',
  size_bytes: '1',
  captured_at: null,
  width: null,
  height: null,
  duration_seconds: null,
  created_at: '2026-09-20T10:00:00.000Z',
  label_ids: labels,
  thumbnail_url: null,
  preview_url: null,
  screening_rejected: null,
  screening_reason: null,
});

test('the circle is lit only when every marked frame is already in the box', () => {
  const best = 'best';
  expect(filing(best, [frame('a', [best]), frame('b', [best])]).inside).toBe(true);
  // Half of them in it reads as «не лежит»: the press that follows has to add the rest.
  expect(filing(best, [frame('a', [best]), frame('b')]).inside).toBe(false);
  expect(filing(best, [frame('a'), frame('b')]).inside).toBe(false);
  // Nothing marked files nothing — the sheet is open over a selection, and an empty one is empty.
  expect(filing(best, [])).toEqual({ inside: false, ids: [] });
});

test('a press on a half-filed label sends the missing ones and nothing else', () => {
  const best = 'best';
  const half = filing(best, [frame('a', [best]), frame('b'), frame('c')]);
  expect(half.ids).toEqual(['b', 'c']);
  // And a press on a full one takes the whole selection back out.
  const whole = filing(best, [frame('a', [best]), frame('b', [best])]);
  expect(whole).toEqual({ inside: true, ids: ['a', 'b'] });
});

test('a label the frame lies in beside others is not confused with the one being pressed', () => {
  const both = frame('a', ['best', 'funny']);
  expect(filing('funny', [both]).inside).toBe(true);
  expect(filing('printing', [both])).toEqual({ inside: false, ids: ['a'] });
});

test('the gallery after the api answered: the box added, and the frame still listed once', () => {
  const items = [frame('a'), frame('b', ['funny']), frame('c')];
  const after = filed(items, 'best', ['a', 'b'], true);
  expect(after?.map((item) => item.label_ids)).toEqual([['best'], ['funny', 'best'], []]);
  // The records themselves are not duplicated and not reordered: a label is an array on a record.
  expect(after?.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  // The untouched one is the very same object — the feed must not redraw what did not change.
  expect(after?.[2]).toBe(items[2]);
});

test('putting the same frame in the same box twice leaves it in it once', () => {
  const items = [frame('a', ['best'])];
  const after = filed(items, 'best', ['a'], true);
  expect(after?.[0].label_ids).toEqual(['best']);
  expect(after?.[0]).toBe(items[0]);
});

test('taking frames out of a box leaves them in the memory, in their other boxes', () => {
  const items = [frame('a', ['best', 'funny']), frame('b', ['best'])];
  const after = filed(items, 'best', ['a', 'b'], false);
  expect(after?.map((item) => item.label_ids)).toEqual([['funny'], []]);
  expect(after?.length).toBe(2);
  // A frame that was not in the box is not an error and does not move.
  expect(filed(items, 'printing', ['a'], false)?.[0]).toBe(items[0]);
});

test('a box that has gone is taken off every frame, not only off the marked ones', () => {
  const items = [frame('a', ['best']), frame('b', ['best', 'funny']), frame('c')];
  expect(filed(items, 'best', null, false)?.map((item) => item.label_ids)).toEqual([
    [],
    ['funny'],
    [],
  ]);
});

test('a gallery that has not arrived yet is not patched into existence', () => {
  expect(filed(null, 'best', ['a'], true)).toBeNull();
});

test('the colour is the palette cell, and the two themes paint the last two of them differently', () => {
  expect(labelTint(1, themes.dark)).toBe('#FFB547');
  expect(labelTint(6, themes.dark)).toBe('#8A7CFF');
  // Cells 7 and 8 are the theme's own `spark` and `muted`, so daylight repaints them (spec 2).
  expect(labelTint(7, themes.light)).not.toBe(labelTint(7, themes.dark));
  // A cell the api should never send still draws something a person can see and rename.
  expect(labelTint(0, themes.dark)).toBe('#FFB547');
  expect(labelTint(9, themes.dark)).toBe('#FFB547');
});

test('a name of spaces is not a name, and a hundred characters is the limit', () => {
  expect(labelNameOk('Лучшее')).toBe(true);
  expect(labelNameOk('  Лучшее  ')).toBe(true);
  expect(labelNameOk('')).toBe(false);
  expect(labelNameOk('   ')).toBe(false);
  expect(labelNameOk('л'.repeat(100))).toBe(true);
  expect(labelNameOk('л'.repeat(101))).toBe(false);
});

const label = (id: string, shared: boolean, title = id, count = 0): Label => ({
  id,
  title,
  color: 1,
  shared,
  mine: true,
  can_edit: true,
  can_add_media: true,
  media_count: count,
});

test('the two groups of the sheet keep the order the api sorted them into', () => {
  const { shared, own } = labelGroups([label('a', true), label('b', true), label('c', false)]);
  expect(shared.map((one) => one.id)).toEqual(['a', 'b']);
  expect(own.map((one) => one.id)).toEqual(['c']);
});

test('a label the api answered with lands where a re-read would have put it', () => {
  const list = [label('1', true, 'Лучшее'), label('2', false, 'Любимые')];
  // A new shared one goes into the shared group, in its place by title.
  const made = withLabel(list, label('3', true, 'Для бабушки'));
  expect(made.map((one) => one.title)).toEqual(['Для бабушки', 'Лучшее', 'Любимые']);
  // The same id twice is one row: the answer to «положили кадры» carries a fresh count, not a copy.
  const filled = withLabel(made, label('1', true, 'Лучшее', 24));
  expect(filled.length).toBe(3);
  expect(filled.find((one) => one.id === '1')?.media_count).toBe(24);
  // And a renamed one moves to where its new name belongs.
  expect(withLabel(filled, label('1', true, 'Ящик')).map((one) => one.title)).toEqual([
    'Для бабушки',
    'Ящик',
    'Любимые',
  ]);
});
