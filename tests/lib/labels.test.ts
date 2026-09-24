import { expect, test, vi } from 'vitest';

// `@/lib/frames` words dates in the app's language, and that stands on a native expo module vitest cannot
// run. Nothing below reads a date.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));

import type { Label, MediaItem } from '@/api';
import { FILTER_NONE, framesMatching, keepLabels } from '@/lib/frames';
import { frame } from '@tests/helpers/labels';
import { filed, filing, labelGroups, labelNameOk, labelTint, withLabel } from '@/lib/labels';
import { themes } from '@/theme';

/**
 * What a press on a label row does to a selection, and what the gallery looks like the moment after
 * (doc-13, spec 7.7). The sheet itself is words and shapes; these are the rules underneath it, and
 * the one that cost the most to get right is the half-filed selection.
 */

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

/**
 * The promises of doc-13 read as one story on the records the feed holds: what a press names, what
 * the feed looks like once the api has answered, and what the filter then shows. Only the rules —
 * the api's own answers are handed in as the records they come back as.
 */
const feed = () => [frame('a'), frame('b', ['funny']), frame('c', ['best']), frame('d')];
const listed = (items: readonly MediaItem[], labels: string[]) =>
  framesMatching(items, { ...FILTER_NONE, labels: new Set(labels) }).map((item) => item.id);

test('several frames go into a label in one press, and then that label shows exactly them', () => {
  const marked = feed().slice(0, 3);
  // «c» already lies in it, so the one request names the two that are missing, nobody twice.
  const press = filing('best', marked);
  expect(press).toEqual({ inside: false, ids: ['a', 'b'] });

  const after = filed(feed(), 'best', press.ids, true)!;
  expect(listed(after, ['best'])).toEqual(['a', 'b', 'c']);
  // The feed is the same four frames, each listed once, and the one in another box still is.
  expect(after.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
  expect(after[1].label_ids).toEqual(['funny', 'best']);
  // Now the whole selection lies in it: the circle lights, and the next press takes all three out.
  const next = filing('best', after.slice(0, 3));
  expect(next).toEqual({ inside: true, ids: ['a', 'b', 'c'] });
  expect(listed(filed(after, 'best', next.ids, false)!, ['best'])).toEqual([]);
});

test('a frame put into one more label is one frame on the feed, whichever boxes are looked at', () => {
  const after = filed(feed(), 'funny', ['c'], true)!;
  expect(after.filter((item) => item.id === 'c')).toHaveLength(1);
  expect(after[2].label_ids).toEqual(['best', 'funny']);
  // Looked at through both of its boxes it is still listed once.
  expect(listed(after, ['best', 'funny'])).toEqual(['b', 'c']);
  // And a label nobody filed anything into is «nothing», not «everything».
  expect(listed(after, ['printing'])).toEqual([]);
});

test('a deleted label leaves the feed and the filter, and not one frame goes with it', () => {
  const before = feed();
  const after = filed(before, 'best', null, false)!;
  expect(after.map((item) => item.id)).toEqual(before.map((item) => item.id));
  expect(after.every((item) => !item.label_ids.includes('best'))).toBe(true);
  // A filter that was looking at just that label falls back to the whole feed instead of staying
  // narrowed to a box with nothing in it; one looking at two keeps the other.
  const only = keepLabels({ ...FILTER_NONE, labels: new Set(['best']) }, (one) => one !== 'best');
  expect(framesMatching(after, only)).toHaveLength(4);
  const both = keepLabels(
    { ...FILTER_NONE, labels: new Set(['best', 'funny']) },
    (one) => one !== 'best',
  );
  expect(framesMatching(after, both).map((item) => item.id)).toEqual(['b']);
});

test('the sheet splits what the server sent by «общий», and adds nothing of its own', () => {
  // A contributor sees shared labels somebody else made beside their own private one; somebody
  // else's private label never comes down at all, so there is nothing here to leave out or invent.
  const theirs = { ...label('o', true, 'Чужой общий'), mine: false };
  const own = { ...label('p', false, 'Мой личный'), mine: true };
  const { shared, own: privates } = labelGroups([theirs, own]);
  expect(shared).toEqual([theirs]);
  expect(privates).toEqual([own]);
  expect(labelGroups([])).toEqual({ shared: [], own: [] });
});
