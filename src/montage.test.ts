import { expect, test, vi } from 'vitest';

// `@/api` words its own errors, so it asks `@/language` which language to say them in — and that one
// stands on two native expo modules vitest has nothing to run. The same two lines `api.test.ts`
// carries, for the same reason.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

// The file behind a picked track, as `expo-file-system` hands it over: a size, and a handle that
// reads a slice at an offset. Nine bytes against the eight-byte part below is two parts, which is
// the only thing about the cutting worth proving here.
vi.mock('expo-file-system', () => ({
  File: class {
    exists = true;
    size = 9;
    constructor(readonly uri: string) {}
    open() {
      return {
        offset: 0,
        readBytes: (length: number) => new Uint8Array(length),
        close: () => {},
      };
    }
  },
}));

import { orderMontage, type MediaItem, type Montage } from '@/api';
import {
  afterTap,
  beingMade,
  blankOrder,
  enoughMaterial,
  MIN_FRAMES,
  pickOf,
  rejectedGroups,
  stages,
  taken,
  wishes,
  type Order,
} from '@/montage';
import { sendOwnTrack } from '@/music';

/**
 * The four steps of an order, checked where they can be: what the organizer settled about the
 * material, and the body that goes out because of it. The screen itself is read as text in
 * `memory-screens.test.ts` — this is the part that decides what actually reaches the worker.
 */

/** A record as `listMedia` hands it over, cut down to what an order reads. */
const frame = (over: Partial<MediaItem>): MediaItem => ({
  id: 'a',
  kind: 'photo',
  status: 'ready',
  uploaded_by: 'u',
  size_bytes: '1',
  captured_at: null,
  width: null,
  height: null,
  duration_seconds: null,
  created_at: '2026-09-18T10:00:00.000Z',
  thumbnail_url: null,
  preview_url: null,
  screening_rejected: false,
  screening_reason: null,
  ...over,
});

const kept = frame({ id: 'kept' });
const blurred = frame({ id: 'blurred', screening_rejected: true, screening_reason: 'blur' });
const dark = frame({ id: 'dark', screening_rejected: true, screening_reason: 'exposure' });
/** Not looked at yet — null is «the pass has not been here», and that frame is in like any other. */
const unseen = frame({ id: 'unseen', screening_rejected: null });
const gallery = [kept, blurred, dark, unseen];

const after = (order: Order, item: MediaItem): Order => ({ ...order, ...afterTap(item, order) });

test('the automatic pass proposes, and one tap is the whole of overruling it', () => {
  const start = blankOrder();
  expect(pickOf(kept, start)).toBe('keep');
  expect(pickOf(blurred, start)).toBe('auto');
  expect(pickOf(unseen, start)).toBe('keep');

  // A frame going in, tapped, is out by hand — and tapped again it is back in.
  const out = after(start, kept);
  expect(pickOf(kept, out)).toBe('hand');
  expect(pickOf(kept, after(out, kept))).toBe('keep');

  // One the pass dropped comes back, and a second tap drops it by hand rather than handing it
  // back to the pass: the hand is always the last word.
  const back = after(start, blurred);
  expect(pickOf(blurred, back)).toBe('keep');
  expect(pickOf(blurred, after(back, blurred))).toBe('hand');
});

test('only what was settled by hand is named in the order', () => {
  const start = blankOrder();
  // Nobody has touched anything: the worker's own pass decides, and the body names no frames at all.
  expect(wishes(gallery, start)).not.toHaveProperty('include_media_ids');
  expect(wishes(gallery, start)).not.toHaveProperty('exclude_media_ids');
  expect(taken(gallery, start).map((item) => item.id)).toEqual(['kept', 'unseen']);

  // One dropped by hand goes out as «exclude», one taken back from the pass as «include» — and the
  // frame nobody said anything about is in neither list.
  const settled = after(after(start, kept), blurred);
  expect(wishes(gallery, settled)).toMatchObject({
    include_media_ids: ['blurred'],
    exclude_media_ids: ['kept'],
  });
});

test('a frame taken back and then dropped by hand is named once, as dropped', () => {
  // The one body the api refuses outright is a frame named both ways, and this is the path that
  // makes one: the pass drops it, the organizer takes it back, then changes their mind.
  const start = blankOrder();
  const settled = after(after(start, blurred), blurred);
  const body = wishes(gallery, settled);
  expect(body.exclude_media_ids).toEqual(['blurred']);
  expect(body.include_media_ids).toBeUndefined();
});

test('a frame still being developed is in nothing — not the count, not the lists', () => {
  const developing = frame({ id: 'developing', status: 'processing' });
  const order = after(blankOrder(), kept);
  expect(taken([...gallery, developing], order).map((item) => item.id)).toEqual(['unseen']);
  expect(wishes([...gallery, developing], order).exclude_media_ids).toEqual(['kept']);
});

test('below three ready frames there is nothing to cut, and the wizard never starts', () => {
  expect(MIN_FRAMES).toBe(3);
  expect(enoughMaterial([kept, blurred])).toBe(false);
  // Counted on the material and not on what the pass would keep: everything it dropped is one tap
  // from being back in, so a memory it emptied is not a memory with too little in it.
  expect(enoughMaterial([kept, blurred, dark])).toBe(true);
  expect(enoughMaterial([kept, blurred, frame({ id: 'sending', status: 'processing' })])).toBe(false);
});

test('what the pass dropped is grouped by why, and a group comes back together', () => {
  const start = blankOrder();
  expect(rejectedGroups(gallery, start)).toEqual([
    { reason: 'blur', ids: ['blurred'] },
    { reason: 'exposure', ids: ['dark'] },
  ]);

  // A reason this app has no word for is still a frame that can be taken back.
  const odd = frame({ id: 'odd', screening_rejected: true, screening_reason: 'weird' });
  expect(rejectedGroups([...gallery, odd], start).at(-1)).toEqual({ reason: 'other', ids: ['odd'] });

  // Taken back, the row it stood in is gone — it has nothing left to report and nothing to return.
  const returned = { ...start, returned: new Set(['blurred']) };
  expect(rejectedGroups(gallery, returned).map((group) => group.reason)).toEqual(['exposure']);
});

test('the four steps go out in one body, with everything they settled in it', async () => {
  const sent: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: { body?: string }) => {
    sent.push({ url, body: init.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ id: 'montage-1', status: 'queued' }));
  });

  const order: Order = {
    ...after(after(blankOrder(), kept), blurred),
    story: '  Сборы, церемония, танцы  ',
    track: 'night',
    seconds: 120,
    orientation: 'portrait',
  };
  await orderMontage('session', 'memory-1', wishes(gallery, order));

  expect(sent).toHaveLength(1);
  expect(sent[0]?.url).toContain('/memories/memory-1/montages');
  expect(sent[0]?.body).toEqual({
    target_seconds: 120,
    orientation: 'portrait',
    // Trimmed on the way out: the api keeps what it is given, and trailing spaces are not a story.
    story_text: 'Сборы, церемония, танцы',
    include_media_ids: ['blurred'],
    exclude_media_ids: ['kept'],
    music_track_id: 'night',
  });

  vi.unstubAllGlobals();
});

test('their own track goes to R2 part by part, and the order names it by its key', async () => {
  const put: string[] = [];
  let completed: unknown = null;
  vi.stubGlobal('fetch', async (url: string, init: { method?: string; body?: string }) => {
    if (url.endsWith('/music')) {
      return new Response(
        JSON.stringify({
          id: 'track-1',
          status: 'pending_upload',
          upload: {
            key: 'music/track-1',
            upload_id: 'r2-upload',
            part_size: 8,
            parts: [
              { part_number: 1, url: 'https://r2.example/part-1' },
              { part_number: 2, url: 'https://r2.example/part-2' },
            ],
            expires_at: '2026-09-18T12:00:00.000Z',
          },
        }),
      );
    }
    if (init.method === 'PUT') {
      put.push(url);
      return new Response('', { headers: { etag: `"${url.slice(-1)}"` } });
    }
    completed = init.body ? JSON.parse(init.body) : null;
    return new Response(JSON.stringify({ id: 'track-1', status: 'ready', key: 'music/track-1' }));
  });

  const key = await sendOwnTrack('session', 'memory-1', {
    uri: 'file:///cache/song.mp3',
    name: 'song.mp3',
  });

  // Nine bytes at eight to a part is two parts, sent in order and receipted in order — part 10
  // before part 9 is what S3 answers `InvalidPart` to, after the whole file is already up.
  expect(put).toEqual(['https://r2.example/part-1', 'https://r2.example/part-2']);
  expect(completed).toEqual({
    parts: [
      { part_number: 1, etag: '"1"' },
      { part_number: 2, etag: '"2"' },
    ],
  });
  expect(key).toBe('music/track-1');

  // And the order then carries the key instead of a shelf id — never both, which the api refuses.
  const order: Order = { ...blankOrder(), track: 'warm', ownTrack: { key, name: 'song.mp3' } };
  const body = wishes(gallery, order);
  expect(body.music_track_key).toBe('music/track-1');
  expect(body.music_track_id).toBeUndefined();

  vi.unstubAllGlobals();
});

/**
 * And the other side of that one call — the waiting the order lands on (`MontageProgress`,
 * TASK-163). The api says one word about the whole job, so what the screen may say about it is
 * decided here, where it can be checked without a phone.
 */

test('the worker is owed a queued and a processing montage, and nothing else', () => {
  // What starts the re-reading, on the waiting screen and on the movies face both. A `ready` or a
  // `failed` row is the worker's last word on it, and a screen left polling over one would ask the
  // api the same question every five seconds for as long as it stays open.
  expect(beingMade('queued')).toBe(true);
  expect(beingMade('processing')).toBe(true);
  expect(beingMade('ready')).toBe(false);
  expect(beingMade('failed')).toBe(false);
});

test('the five stages say what is known and guess at nothing', () => {
  const standing = (status: Montage['status']) => stages(status).map((step) => step.state);

  // The stages themselves are the work in the order it happens, whatever the standing.
  for (const status of ['queued', 'processing', 'ready', 'failed'] as const) {
    expect(stages(status).map((step) => step.stage)).toEqual([
      'screening',
      'understanding',
      'story',
      'rhythm',
      'cut',
    ]);
  }

  // Waiting its turn: the two that happen to a frame as it lands are behind before the order is
  // placed, and nothing of the montage job itself has begun — nor is any of it claimed to have.
  expect(standing('queued')).toEqual(['done', 'done', 'waiting', 'waiting', 'waiting']);
  // Picked up: the first thing the worker does with the job is the director, so that is the one it
  // is on. What follows the director is its own business and nobody is told when it gets there.
  expect(standing('processing')).toEqual(['done', 'done', 'running', 'waiting', 'waiting']);
  expect(standing('ready')).toEqual(['done', 'done', 'done', 'done', 'done']);
  // Nothing is «идёт» on a montage that fell over: the screen says it broke and hands over the
  // worker's own line, because which stage it broke on is exactly what nothing here knows.
  expect(standing('failed')).not.toContain('running');
  expect(standing('failed').slice(2)).toEqual(['waiting', 'waiting', 'waiting']);
});
