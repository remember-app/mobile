import { expect, test } from 'vitest';

import type { MediaItem } from '@/api';
import { frameOf, stillPreparing } from '@/frames';

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
