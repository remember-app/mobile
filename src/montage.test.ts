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
    // Every other test here hands over a file that reads fine; the guard `sendOwnTrack` opens with
    // is only worth a mock of its own for the one uri that must fail it.
    constructor(readonly uri: string) {
      if (uri.includes('empty')) this.size = 0;
      if (uri.includes('missing')) this.exists = false;
    }
    open() {
      return {
        offset: 0,
        readBytes: (length: number) => new Uint8Array(length),
        close: () => {},
      };
    }
  },
}));

/**
 * The speaker. `expo-audio` is a native module node has nothing to run, and what it does with an
 * mp3 is outside anything a test here could see — so every player it hands out is a note of what
 * was asked of it, and a length long enough to have a middle.
 */
type FakePlayer = {
  uri: string;
  played: boolean;
  removed: boolean;
  currentTime: number;
  duration: number;
  play(): void;
  remove(): void;
};

const { players, silentMode } = vi.hoisted(() => ({
  players: [] as FakePlayer[],
  silentMode: [] as boolean[],
}));

vi.mock('expo-audio', () => ({
  setAudioModeAsync: async ({ playsInSilentMode }: { playsInSilentMode?: boolean }) => {
    silentMode.push(playsInSilentMode ?? false);
  },
  createAudioPlayer: (source: { uri: string }) => {
    const player: FakePlayer = {
      uri: source.uri,
      played: false,
      removed: false,
      currentTime: 0,
      duration: 100,
      play() {
        player.played = true;
      },
      remove() {
        player.removed = true;
      },
    };
    players.push(player);
    return player;
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
import { createPreview, sendOwnTrack, type Playing } from '@/music';

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

test('the floor is on what is taken, not on what the memory holds', () => {
  // Found in review, m-23: the api's own 409 and the worker's own count both read the memory's
  // material and never the selection, so a wizard could carry an order below the floor while the
  // memory it came from was nowhere near short of one. This is the arithmetic that guard now reads.
  const start = blankOrder();
  expect(enoughMaterial(gallery)).toBe(true);
  // The pass alone proposes two of the four usable frames — under the floor already, with the
  // memory itself well clear of it.
  expect(taken(gallery, start)).toHaveLength(2);

  // One frame taken back off the pass crosses the selection back over the floor…
  const back = after(start, blurred);
  expect(taken(gallery, back)).toHaveLength(3);
  // …and dropping a kept frame by hand can push it back under, exactly the same arithmetic working
  // the other way, whatever the pass proposed to begin with.
  expect(taken(gallery, after(back, kept))).toHaveLength(2);
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

test('a file that cannot be read never reaches the api at all', async () => {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify({}));
  });

  // Zero bytes and a phone that lost the file both fail the same guard, before any plan is asked
  // for — nothing is written down anywhere, so a track that did not make it is simply not chosen.
  await expect(
    sendOwnTrack('session', 'memory-1', { uri: 'file:///cache/empty.mp3', name: 'empty.mp3' }),
  ).rejects.toThrow();
  await expect(
    sendOwnTrack('session', 'memory-1', { uri: 'file:///cache/missing.mp3', name: 'missing.mp3' }),
  ).rejects.toThrow();
  expect(calls).toHaveLength(0);

  vi.unstubAllGlobals();
});

/**
 * And the shelf being heard rather than sent (TASK-172). Both ends of it are stood in for — the api
 * signs a link, the phone plays it — so what is left is the only part worth pinning: which track is
 * sounding after which press.
 */

/** Every api answer a preview asks for: the signed link to whichever track was named. */
function signsLinks(asked: string[]) {
  vi.stubGlobal('fetch', async (url: string) => {
    asked.push(url);
    const track = url.split('/').pop();
    return new Response(JSON.stringify({ url: `https://r2.example/tracks/${track}.mp3` }));
  });
}

test('one speaker for the shelf: another row switches it, the same row stops it', async () => {
  players.length = 0;
  silentMode.length = 0;
  const asked: string[] = [];
  signsLinks(asked);
  const heard: Playing[] = [];
  const preview = createPreview('session', (playing) => heard.push(playing));

  await preview.toggle('bright');
  expect(asked.at(-1)).toContain('/music/tracks/bright');
  // A phone lives on silent, and iOS plays nothing through the ringer switch unless it is told.
  expect(silentMode).toEqual([true]);
  expect(players).toHaveLength(1);
  expect(players[0]?.played).toBe(true);
  expect(heard.at(-1)).toEqual({ track: 'bright', at: 0 });

  // Another row: the one that was sounding is released before the next is built, so two tracks can
  // never be heard over each other.
  await preview.toggle('night');
  expect(players[0]?.removed).toBe(true);
  expect(players[1]?.uri).toContain('night');
  expect(heard.at(-1)).toEqual({ track: 'night', at: 0 });

  // And the same row again is the stop — silence, and the api is not asked for anything.
  const signed = asked.length;
  await preview.toggle('night');
  expect(players[1]?.removed).toBe(true);
  expect(heard.at(-1)).toBeNull();
  expect(asked).toHaveLength(signed);
  // Which leaves the shelf where it started: the next press plays again rather than stopping.
  await preview.toggle('night');
  expect(heard.at(-1)).toEqual({ track: 'night', at: 0 });

  preview.stop();
  vi.unstubAllGlobals();
});

test('the waveform follows the track, and running out is a stop nobody pressed', async () => {
  players.length = 0;
  vi.useFakeTimers();
  signsLinks([]);
  const heard: Playing[] = [];
  const preview = createPreview('session', (playing) => heard.push(playing));

  await preview.toggle('calm');
  const player = players[0];
  expect(player).toBeDefined();
  if (player === undefined) return;

  player.currentTime = 50;
  vi.advanceTimersByTime(500);
  expect(heard.at(-1)).toEqual({ track: 'calm', at: 0.5 });

  // The end of it: nothing is sounding, the player is released, and the button says «Послушать»
  // again without anybody having pressed anything.
  player.currentTime = 100;
  vi.advanceTimersByTime(500);
  expect(heard.at(-1)).toBeNull();
  expect(player.removed).toBe(true);
  // And the clock goes with it — a ticker left running would report on a released player forever.
  vi.advanceTimersByTime(5_000);
  expect(heard.at(-1)).toBeNull();

  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('a link still being signed loses the speaker to the press that came after it', async () => {
  players.length = 0;
  let sign: () => void = () => {};
  vi.stubGlobal('fetch', async (url: string) => {
    const track = url.split('/').pop();
    if (track === 'bright') await new Promise<void>((resolve) => (sign = () => resolve()));
    return new Response(JSON.stringify({ url: `https://r2.example/tracks/${track}.mp3` }));
  });
  const preview = createPreview('session', () => {});

  // Pressed twice inside the moment it takes to sign a link — the second press is the one whoever
  // is holding the phone means, and the first must not start playing over it when it lands.
  const slow = preview.toggle('bright');
  await preview.toggle('night');
  expect(players).toHaveLength(1);
  expect(players[0]?.uri).toContain('night');

  sign();
  await slow;
  expect(players).toHaveLength(1);
  expect(players[0]?.removed).toBe(false);

  preview.stop();
  vi.unstubAllGlobals();
});

test('a link that would not sign leaves silence, and the same row can be tried again', async () => {
  players.length = 0;
  const refused = { status: 503 };
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'no bucket' }), refused));
  const heard: Playing[] = [];
  const preview = createPreview('session', (playing) => heard.push(playing));

  await expect(preview.toggle('road')).rejects.toThrow();
  expect(players).toHaveLength(0);
  expect(heard.at(-1)).toBeNull();

  // The press came to nothing, so the next one on that row is «play» and not «stop this» — which is
  // what it would read as if a failed press were remembered as the track now sounding.
  vi.unstubAllGlobals();
  const asked: string[] = [];
  signsLinks(asked);
  await preview.toggle('road');
  expect(asked).toHaveLength(1);
  expect(heard.at(-1)).toEqual({ track: 'road', at: 0 });

  preview.stop();
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
