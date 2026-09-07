import { expect, test, vi } from 'vitest';

// A day is written in the app's language now (m-13), and the module that holds it stands on two
// native expo modules vitest has nothing to run. Which language it lands on does not matter here:
// every day below is compared against `formatEventDates` itself.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

import type { MediaItem, Member, Memory } from '@/api';
// The day is written by `@/dates` and read here from the same place: what is pinned below is which
// day the line carries, not how this phone's locale spells it.
import { formatEventDates } from '@/dates';
import { frameIndex, frameOf, mayOpen, shotBy, stillPreparing } from '@/frames';

// The gallery sat in «Preparing…» for good because it read the list once and never again, and
// nothing on screen ever asked whether there was a reason to look. These are the two questions the
// screen now asks, walked through the transition the human actually hit: a photo is sent, the
// worker has not made its thumbnail yet, and a moment later it has.

/** A record as `listMedia` hands it over, cut down to what the sheet reads. */
const record = (over: Partial<MediaItem>): MediaItem => ({
  id: 'a',
  kind: 'photo',
  status: 'processing',
  uploaded_by: 'u',
  size_bytes: '1',
  captured_at: null,
  width: null,
  height: null,
  duration_seconds: null,
  created_at: '2026-09-06T10:00:00.000Z',
  thumbnail_url: null,
  preview_url: null,
  ...over,
});

/** The answer the first read gets: the file is in, its derivative is not made yet. */
const firstRead = [record({ id: 'a' })];
/** The answer the read after it gets, once the worker has been through. */
const secondRead = [
  record({ id: 'a', status: 'ready', thumbnail_url: 'https://r2.example/thumbnails/a.jpg?sig=1' }),
];

test('a list still being made is a reason to read again, and a finished one is not', () => {
  expect(stillPreparing(firstRead)).toBe(true);
  expect(stillPreparing(secondRead)).toBe(false);
});

test('nothing read yet is nothing to wait for — the first read is what starts it', () => {
  expect(stillPreparing(null)).toBe(false);
  expect(stillPreparing([])).toBe(false);
});

test('the frame the second read serves is the thumbnail itself, ready to draw', () => {
  // The whole point of the fix: after the refetch the record hands over a picture, not a caption.
  expect(frameOf(secondRead[0])).toEqual({
    state: 'ready',
    uri: 'https://r2.example/thumbnails/a.jpg?sig=1',
  });
});

test('until then the frame is the waiting one, with no picture to draw', () => {
  expect(frameOf(firstRead[0])).toEqual({ state: 'processing', uri: null });
});

test('a record that is ready with nothing on it is a fallen frame, not an empty square', () => {
  expect(frameOf(record({ status: 'ready' }))).toEqual({ state: 'failed', uri: null });
});

test('a record the worker gave up on stops the reading instead of being waited on forever', () => {
  const failed = [record({ status: 'failed' })];
  expect(stillPreparing(failed)).toBe(false);
  expect(frameOf(failed[0])).toEqual({ state: 'failed', uri: null });
});

test('one record still coming keeps the reading going for the whole sheet', () => {
  expect(stillPreparing([...secondRead, record({ id: 'b' })])).toBe(true);
});

// What the filmstrip under an open frame decides: which tile is the one being shown, which tiles
// can be walked to, and what the line over the frame says about who brought it.

/** A roster row, cut down to what a frame's line reads off it. */
const member = (over: Partial<Member>): Member => ({
  id: 'u',
  name: 'Marina',
  username: 'marina',
  role: 'contributor',
  contribution_status: 'more_coming',
  ...over,
});

/** The strip as the gallery hands it over: everything in the memory, oldest first. */
const strip = [
  record({ id: 'a', status: 'ready', thumbnail_url: 'https://r2.example/a.jpg' }),
  record({ id: 'b', status: 'processing' }),
  record({ id: 'c', status: 'failed' }),
];

test('the strip opens on the frame that is open, not at its head', () => {
  expect(frameIndex(strip, 'c')).toBe(2);
  expect(frameIndex(strip, 'a')).toBe(0);
});

test('a frame that is no longer in the list leaves the strip at its head instead of nowhere', () => {
  // What a delete leaves behind for the moment between the record going and the viewer closing.
  expect(frameIndex(strip, 'gone')).toBe(0);
  expect(frameIndex(strip, null)).toBe(0);
  expect(frameIndex([], 'a')).toBe(0);
});

test('a frame still developing stays in the strip but does not open', () => {
  expect(mayOpen(strip[1])).toBe(false);
  // The fallen one does open: the viewer is where the delete button is.
  expect(mayOpen(strip[0])).toBe(true);
  expect(mayOpen(strip[2])).toBe(true);
});

/** The memory the gallery is open on, cut down to what the line over a frame reads off it. */
const wedding = (over: Partial<Memory> = {}): Memory => ({
  id: 'm',
  organizer_id: 'u',
  title: 'Свадьба Лёши',
  event_start: '2026-09-03T09:00:00.000Z',
  event_end: null,
  storage_bytes: '1',
  media_count: 1,
  recent_thumbnail_urls: [],
  montage_count: 0,
  created_at: '2026-09-01T09:00:00.000Z',
  role: 'organizer',
  ...over,
});

test('the line over a frame is who brought it and the day of the event', () => {
  // Shot on a phone seven years before the wedding — an old picture somebody put in anyway.
  const shot = record({ uploaded_by: 'u', captured_at: '2019-03-12T18:20:00.000Z' });
  const line = shotBy(shot, [member({ id: 'u' })], wedding());

  expect(line).toBe(`Marina · ${formatEventDates('2026-09-03T09:00:00.000Z', null)}`);
  // Neither of the two dates the file carries: not the day the camera stamped it, and not the day
  // it reached us. Both of them dated the event wrong under the frame, which is what was reported.
  expect(line).not.toContain('2019');
});

test('an event that lasted is the span, the way every other screen of a memory writes it', () => {
  const line = shotBy(record({ uploaded_by: 'u' }), [member({ id: 'u' })], wedding({
    event_end: '2026-09-05T20:59:59.000Z',
  }));
  expect(line).toBe(
    `Marina · ${formatEventDates('2026-09-03T09:00:00.000Z', '2026-09-05T20:59:59.000Z')}`,
  );
});

test('a memory not read yet leaves the name alone rather than a wrong day after it', () => {
  // The listing this screen takes the memory from can fail; the frame is still somebody's.
  expect(shotBy(record({ uploaded_by: 'u' }), [member({ id: 'u' })], null)).toBe('Marina');
});

test('a name nobody claimed is the username, and somebody off the roster is «Someone»', () => {
  const shot = record({ uploaded_by: 'u' });
  const day = wedding();
  expect(shotBy(shot, [member({ id: 'u', name: null })], day).startsWith('marina · ')).toBe(true);
  // Whoever left the memory is off the roster, and the frame they brought stays.
  expect(shotBy(shot, [member({ id: 'other' })], day).startsWith('Someone · ')).toBe(true);
  expect(shotBy(shot, null, day).startsWith('Someone · ')).toBe(true);
});
