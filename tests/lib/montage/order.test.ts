import { expect, test, vi } from 'vitest';

// `@/api` words its own errors, so it asks `@/lib/language` which language to say them in — and that one
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

import { type MediaItem, type MontageTemplate, orderMontage } from '@/api';
import {
  afterTap,
  beingMade,
  blankOrder,
  enoughMaterial,
  entered,
  fromTemplate,
  landing,
  MIN_FRAMES,
  movedTrack,
  type Order,
  pickedSeconds,
  pickOf,
  rejectedGroups,
  shapeOf,
  shelfTrack,
  TRACKS,
  taken,
  wishes,
} from '@/lib/montage/order';
import { createPreview, type Playing, sendOwnTrack } from '@/lib/music';

/**
 * The four steps of an order, checked where they can be: what the organizer settled about the
 * material, and the body that goes out because of it. The screen itself is read as text in
 * `tests/routes/memory/screen.test.ts` — this is the part that decides what actually reaches the worker.
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
  orientation: null,
  duration_seconds: null,
  created_at: '2026-09-18T10:00:00.000Z',
  label_ids: [],
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

test('every frame that is not going in is named, whoever crossed it out', () => {
  const start = blankOrder();
  // Nobody has touched anything, and the body already names the two the pass dropped: the api
  // counts the film off this very list — «готовые минус exclude_media_ids» — so a summary read
  // from it must count what the screen shows and not what the worker would have done anyway.
  expect(wishes(gallery, start).exclude_media_ids).toEqual(['blurred', 'dark']);
  expect(wishes(gallery, start)).not.toHaveProperty('include_media_ids');
  expect(taken(gallery, start).map((item) => item.id)).toEqual(['kept', 'unseen']);

  // One dropped by hand joins them; one taken back from the pass leaves the list and goes out as
  // «include» instead, which is what actually brings it back — the worker skips anything its own
  // pass rejected unless the order insists on it by name.
  const settled = after(after(start, kept), blurred);
  expect(wishes(gallery, settled)).toMatchObject({
    include_media_ids: ['blurred'],
    exclude_media_ids: ['kept', 'dark'],
  });
});

test('a frame taken back and then dropped by hand is named once, as dropped', () => {
  // The one body the api refuses outright is a frame named both ways, and this is the path that
  // makes one: the pass drops it, the organizer takes it back, then changes their mind.
  const start = blankOrder();
  const settled = after(after(start, blurred), blurred);
  const body = wishes(gallery, settled);
  expect(body.exclude_media_ids).toEqual(['blurred', 'dark']);
  expect(body.include_media_ids).toBeUndefined();
});

test('a frame still being developed is in nothing — not the count, not the lists', () => {
  const developing = frame({ id: 'developing', status: 'processing' });
  const order = after(blankOrder(), kept);
  expect(taken([...gallery, developing], order).map((item) => item.id)).toEqual(['unseen']);
  // The two the pass dropped are in the list; the one still being made is in neither list, because
  // the api refuses a body naming a frame it cannot cut anything out of.
  expect(wishes([...gallery, developing], order).exclude_media_ids).toEqual([
    'kept',
    'blurred',
    'dark',
  ]);
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
  expect(enoughMaterial([kept, blurred, frame({ id: 'sending', status: 'processing' })])).toBe(
    false,
  );
});

test('what the pass dropped is grouped by why, and a group comes back together', () => {
  const start = blankOrder();
  expect(rejectedGroups(gallery, start)).toEqual([
    { reason: 'blur', ids: ['blurred'] },
    { reason: 'exposure', ids: ['dark'] },
  ]);

  // A reason this app has no word for is still a frame that can be taken back.
  const odd = frame({ id: 'odd', screening_rejected: true, screening_reason: 'weird' });
  expect(rejectedGroups([...gallery, odd], start).at(-1)).toEqual({
    reason: 'other',
    ids: ['odd'],
  });

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
    tracks: [
      { key: 'music/own-1', name: 'song.mp3', wish: '  Первым, на сборы  ' },
      { key: 'night', name: null },
    ],
    seconds: 137,
    orientation: 'portrait',
  };
  await orderMontage('session', 'memory-1', wishes(gallery, order));

  expect(sent).toHaveLength(1);
  expect(sent[0]?.url).toContain('/memories/memory-1/montages');
  expect(sent[0]?.body).toEqual({
    // Any whole number of seconds, not one of three presets: the range is the material's and the
    // api is the one that knows it.
    target_seconds: 137,
    orientation: 'portrait',
    // Trimmed on the way out: the api keeps what it is given, and trailing spaces are not a story.
    story_text: 'Сборы, церемония, танцы',
    include_media_ids: ['blurred'],
    exclude_media_ids: ['kept', 'dark'],
    // In the order they were taken, which is the order they play in — their own file and the shelf
    // in one list, exactly as the api reads it.
    music_tracks: ['music/own-1', 'night'],
    // A wish under its own track's key, trimmed the way the story is; the track nothing was said
    // about is simply not named.
    music_wishes: { 'music/own-1': 'Первым, на сборы' },
  });

  vi.unstubAllGlobals();
});

test('the music goes out even when there is none, and a wish only under its own track', () => {
  const start = blankOrder();
  // Empty and not missing: that is how the worker tells «без музыки, живой звук из видео» from an
  // order that simply said nothing about music.
  expect(wishes(gallery, start).music_tracks).toEqual([]);
  // Nothing was said about the length either, so the api picks its own and clamps it to what this
  // memory can carry — a body that named a number would be the app guessing at that range.
  expect(wishes(gallery, start)).not.toHaveProperty('target_seconds');
  // And no music is no wishes at all — not an empty object standing for them.
  expect(wishes(gallery, start)).not.toHaveProperty('music_wishes');

  // Three tracks, two of them with something said: the two go out, each under its own key, and
  // the third is not named. Blank is «не сказали», whatever it is made of.
  const three: Order = {
    ...start,
    tracks: [
      { key: 'warm', name: null, wish: 'На сборы, тихо, под голоса' },
      { key: 'calm', name: null, wish: '   ' },
      { key: 'music/own-2', name: 'song.mp3', wish: 'Под первый танец' },
    ],
  };
  expect(wishes(gallery, three)).toMatchObject({
    music_tracks: ['warm', 'calm', 'music/own-2'],
    music_wishes: { warm: 'На сборы, тихо, под голоса', 'music/own-2': 'Под первый танец' },
  });

  // A wish is held on its track, so taking the track out takes the wish out of the body with it —
  // a wish about a track the order does not name is the one thing the api answers 400 to.
  const dropped = { ...three, tracks: three.tracks.filter((track) => track.key !== 'warm') };
  expect(wishes(gallery, dropped).music_wishes).toEqual({ 'music/own-2': 'Под первый танец' });
  const none = { ...three, tracks: three.tracks.filter((track) => track.key === 'calm') };
  expect(wishes(gallery, none)).not.toHaveProperty('music_wishes');

  // The one line for the whole order is gone: the api drops it unread now.
  expect(wishes(gallery, three)).not.toHaveProperty('music_note');
  // Neither of the two old single-track fields is ever written again — a body carrying one of them
  // beside the list is «the music is named more than one way».
  expect(wishes(gallery, three)).not.toHaveProperty('music_track_id');
  expect(wishes(gallery, three)).not.toHaveProperty('music_track_key');
});

test('a walk with nothing said in it costs nothing to leave, and every answer is something said', () => {
  // The question «Отмена» asks before it throws the wizard away: walked into and straight back
  // out of, there is nothing to confirm, and a sheet asking anyway is a door held shut for nothing.
  const start = blankOrder();
  expect(entered(start)).toBe(false);
  // Whitespace is not an answer either — the same trim the body goes out under.
  expect(entered({ ...start, story: '   ' })).toBe(false);

  // Every field one of the steps can fill in, one at a time: each of them on its own is a walk
  // worth asking about.
  const said: Partial<Order>[] = [
    { dropped: new Set(['kept']) },
    { returned: new Set(['blurred']) },
    { story: 'Начни со сборов' },
    { template: 'parents' },
    { tracks: [{ key: 'calm', name: null }] },
    { tracks: [{ key: 'calm', name: null, wish: 'Погромче к финалу' }] },
    { seconds: 90 },
    { orientation: 'portrait' },
  ];
  for (const answer of said) expect(entered({ ...start, ...answer })).toBe(true);
});

test('a track is told from the shelf by its key, and everything else is somebody’s own file', () => {
  // The api hands the two kinds back in one list, so this is the only way a screen can name them:
  // the five have words in the dictionary, and a storage path never does.
  expect(TRACKS.map((track) => shelfTrack(track.id))).toEqual([
    'bright',
    'warm',
    'calm',
    'night',
    'road',
  ]);
  expect(shelfTrack('music/7d2e-own-file')).toBeNull();
  expect(shelfTrack('')).toBeNull();
});

test('the block of chosen tracks counts their time, and stays quiet about a file it never heard', () => {
  // The five are known to the second (`projects/montage/tracks/README.md`), so two of them add up.
  expect(pickedSeconds([{ key: 'warm', name: null }])).toBe(126);
  expect(
    pickedSeconds([
      { key: 'warm', name: null },
      { key: 'calm', name: null },
    ]),
  ).toBe(236);
  expect(pickedSeconds([])).toBe(0);
  // A track off somebody's phone has no length anywhere on this side, and a sum missing one of the
  // tracks in it would be a shorter film promised out loud.
  expect(
    pickedSeconds([
      { key: 'warm', name: null },
      { key: 'music/7d2e-own-file', name: 'sunrise.mp3' },
    ]),
  ).toBeNull();
});

test('dragging a chosen track by its name is the order the api plays them in', () => {
  const list = [
    { key: 'warm', name: null, wish: 'На сборы' },
    { key: 'calm', name: null },
    { key: 'road', name: null },
  ];
  const keys = (tracks: readonly { key: string }[]) => tracks.map((track) => track.key);

  // Down one, up one, and across the whole list: the row leaves its place and the rest close up.
  expect(keys(movedTrack(list, 0, 1))).toEqual(['calm', 'warm', 'road']);
  expect(keys(movedTrack(list, 2, 0))).toEqual(['road', 'warm', 'calm']);
  // Where it was is where it stays, and a drag off either end stops at that end.
  expect(keys(movedTrack(list, 1, 1))).toEqual(['warm', 'calm', 'road']);
  expect(keys(movedTrack(list, 0, 9))).toEqual(['calm', 'road', 'warm']);
  // The list handed in is never touched — the order is state, and it is replaced, not edited.
  expect(keys(list)).toEqual(['warm', 'calm', 'road']);

  // And what comes out of it is what goes out to the api, in that very order — the wish still
  // under the track it was written about, wherever that track now stands.
  expect(wishes(gallery, { ...blankOrder(), tracks: movedTrack(list, 2, 0) })).toMatchObject({
    music_tracks: ['road', 'warm', 'calm'],
    music_wishes: { warm: 'На сборы' },
  });
});

test('a dragged row passes a neighbour once it has gone over half of it, however tall that is', () => {
  // Rows of one height: the same answer as counting rows of 52 and rounding.
  const even = [52, 52, 52, 52];
  expect(landing(even, 0, 0)).toBe(0);
  expect(landing(even, 0, 26)).toBe(0);
  expect(landing(even, 0, 27)).toBe(1);
  expect(landing(even, 0, 78)).toBe(1);
  expect(landing(even, 0, 79)).toBe(2);
  expect(landing(even, 3, -79)).toBe(1);
  // Past either end it stops at that end.
  expect(landing(even, 1, 900)).toBe(3);
  expect(landing(even, 1, -900)).toBe(0);

  // A row with a wish is 60, and one with its field open is taller still: walked past by what they
  // measure, not counted as 52 — counted, five such rows put a drag a whole row out.
  const mixed = [52, 60, 112, 60];
  expect(landing(mixed, 0, 30)).toBe(0);
  expect(landing(mixed, 0, 31)).toBe(1);
  expect(landing(mixed, 0, 60 + 56)).toBe(1);
  expect(landing(mixed, 0, 60 + 57)).toBe(2);
  expect(landing(mixed, 3, -57)).toBe(2);
  expect(landing(mixed, 3, -(112 + 30))).toBe(2);
  expect(landing(mixed, 3, -(112 + 31))).toBe(1);
});

test('the length is nobody’s until it is moved by hand', () => {
  // An order opens with no length at all and with nothing said about whose it is; the length step
  // sets both together, which is what takes «из шаблона „…“» out from under the figure.
  expect(blankOrder().seconds).toBeNull();
  expect(blankOrder().ownLength).toBe(false);
  // And a length that was set still only goes out as the number itself.
  expect(wishes(gallery, { ...blankOrder(), seconds: 95, ownLength: true })).toMatchObject({
    target_seconds: 95,
  });
});

test('a template is an order already filled in, and it reaches the api as one', () => {
  const parents: MontageTemplate = {
    id: 'parents',
    story_text: 'Спокойно, по порядку: сборы, церемония, поздравления.',
    target_seconds: 150,
    orientation: 'landscape',
    music_tracks: ['warm', 'calm'],
    music_wishes: { warm: 'Тёплая на сборы' },
  };
  const fill = fromTemplate(parents);

  expect(fill).toEqual({
    template: 'parents',
    story: parents.story_text,
    // The words and the figure are the template's until somebody rewrites them — that is what
    // puts its plate over the story and its line under the length.
    ownStory: false,
    // The wish lands on the track it is about, and the track it says nothing of carries none.
    tracks: [
      { key: 'warm', name: null, wish: 'Тёплая на сборы' },
      { key: 'calm', name: null },
    ],
    seconds: 150,
    ownLength: false,
    orientation: 'landscape',
  });

  // And that is the whole of «заказ по шаблону доходит с тем, что выбрано»: the fill is the order,
  // so the body the api gets carries the template's own answers and nothing about the template
  // itself — a filled-in order is indistinguishable from a typed one, which is what a template is.
  const order: Order = { ...blankOrder(), ...fill };
  expect(wishes(gallery, order)).toEqual({
    target_seconds: 150,
    orientation: 'landscape',
    story_text: parents.story_text,
    music_tracks: ['warm', 'calm'],
    music_wishes: { warm: 'Тёплая на сборы' },
    // Which frames go in is the one thing a template says nothing about: what the automatic pass
    // dropped is out, because nobody overruled it, and step 1 is walked through rather than ruled.
    exclude_media_ids: ['blurred', 'dark'],
  });
  expect(order.dropped.size).toBe(0);
  expect(order.returned.size).toBe(0);
});

test('a template with two tracks puts each of its two wishes on its own track', () => {
  const dopamine: MontageTemplate = {
    id: 'dopamine',
    story_text: 'Максимально резко.',
    target_seconds: 45,
    orientation: 'portrait',
    music_tracks: ['bright', 'road'],
    music_wishes: { bright: 'Первым, склейки на каждый удар', road: 'Вторым, к финалу' },
  };
  expect(fromTemplate(dopamine).tracks).toEqual([
    { key: 'bright', name: null, wish: 'Первым, склейки на каждый удар' },
    { key: 'road', name: null, wish: 'Вторым, к финалу' },
  ]);
  expect(wishes(gallery, { ...blankOrder(), ...fromTemplate(dopamine) }).music_wishes).toEqual(
    dopamine.music_wishes,
  );
});

test('a template with nothing to say about its music carries no wish, nor one about another track', () => {
  const quiet: MontageTemplate = {
    id: 'for_myself',
    story_text: 'Для себя.',
    target_seconds: 180,
    orientation: 'portrait',
    music_tracks: ['calm'],
    music_wishes: {},
  };
  expect(fromTemplate(quiet).tracks).toEqual([{ key: 'calm', name: null }]);
  expect(wishes(gallery, { ...blankOrder(), ...fromTemplate(quiet) })).not.toHaveProperty(
    'music_wishes',
  );
  // A wish keyed to a track the template does not play has no track to stand on, and so never
  // reaches the api — which would answer it with 400.
  const stray = { ...quiet, music_tracks: [], music_wishes: { road: 'Потише' } };
  expect(fromTemplate(stray).tracks).toEqual([]);
  expect(wishes(gallery, { ...blankOrder(), ...fromTemplate(stray) })).not.toHaveProperty(
    'music_wishes',
  );
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

  // And the order then carries that key in the list beside the shelf, in the order the two were
  // taken: one list of both kinds is what the api reads, and what plays first plays first.
  const order: Order = {
    ...blankOrder(),
    tracks: [
      { key: 'warm', name: null },
      { key, name: 'song.mp3' },
    ],
  };
  expect(wishes(gallery, order).music_tracks).toEqual(['warm', 'music/track-1']);

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

test('a press that lost the speaker keeps its failure to itself', async () => {
  players.length = 0;
  let refuse: () => void = () => {};
  vi.stubGlobal('fetch', async (url: string) => {
    const track = url.split('/').pop();
    if (track === 'bright') {
      await new Promise<void>((resolve) => (refuse = () => resolve()));
      return new Response(JSON.stringify({ error: 'no bucket' }), { status: 503 });
    }
    return new Response(JSON.stringify({ url: `https://r2.example/tracks/${track}.mp3` }));
  });
  const preview = createPreview('session', () => {});

  // The same race, with the press that lost it coming back a failure rather than a link. Nobody is
  // waiting on that press any more — the row they pressed after it is sounding — so it is not a
  // banner: one over a track that is playing says the app is broken when it is doing exactly what
  // it was asked. The same goes for a step walked out of, which stops everything on the way out.
  const lost = preview.toggle('bright');
  await preview.toggle('night');
  refuse();
  await expect(lost).resolves.toBeUndefined();
  expect(players).toHaveLength(1);
  expect(players[0]?.removed).toBe(false);

  preview.stop();
  vi.unstubAllGlobals();
});

test('leaving the step while a link is still signing plays nothing when it lands', async () => {
  // The other half of the same guard (9a2cfae): not another row winning the race, but nobody
  // pressed anything at all — the music step went away while a link was still being asked for,
  // the way `useTrackPreview`'s own cleanup calls `stop()` on the way out.
  players.length = 0;
  let sign: () => void = () => {};
  const asked = new Promise<void>((asked) => {
    vi.stubGlobal('fetch', async (url: string) => {
      asked();
      await new Promise<void>((resolve) => (sign = resolve));
      const track = url.split('/').pop();
      return new Response(JSON.stringify({ url: `https://r2.example/tracks/${track}.mp3` }));
    });
  });
  const heard: Playing[] = [];
  const preview = createPreview('session', (playing) => heard.push(playing));

  const inFlight = preview.toggle('bright');
  // Wait for the link to actually be asked for before leaving — `stop()` racing ahead of the
  // request itself would prove nothing about the guard this test is aimed at.
  await asked;
  preview.stop();
  sign();
  await inFlight;

  // The link signed fine, but too late — nothing is waiting on it, so nothing plays.
  expect(players).toHaveLength(0);
  expect(heard.at(-1)).toBeNull();

  vi.unstubAllGlobals();
});

test('a link that failed after the step was left never surfaces its error', async () => {
  // Same departure, the other outcome: the fetch that outlived the step comes back refused rather
  // than signed. Thrown on, this is the exact banner the fix stopped — one about music somebody
  // already walked away from, met on whatever screen came after.
  players.length = 0;
  let refuse: () => void = () => {};
  const asked = new Promise<void>((asked) => {
    vi.stubGlobal('fetch', async () => {
      asked();
      await new Promise<void>((resolve) => (refuse = resolve));
      return new Response(JSON.stringify({ error: 'no bucket' }), { status: 503 });
    });
  });
  const preview = createPreview('session', () => {});

  const inFlight = preview.toggle('bright');
  await asked;
  preview.stop();
  refuse();

  await expect(inFlight).resolves.toBeUndefined();
  expect(players).toHaveLength(0);

  vi.unstubAllGlobals();
});

/**
 * And the other side of that one call — the waiting the order lands on (`MontageProgress`,
 * TASK-163). The api says one word about the whole job, so what the screen may say about it is
 * decided here, where it can be checked without a phone.
 */

test('a montage is the shape of the canvas it was cut onto, horizontal when none was asked for', () => {
  // TASK-178: the card is the shape of the video, and this is where that shape is known. The worker
  // cuts onto two fixed canvases (`projects/montage/assembly.py`: 1920 × 1080 and 1080 × 1920), so
  // these are the video's real proportions and not a guess off the poster — checked against a real
  // pair of finished montages, whose files measure exactly those two sizes.
  expect(shapeOf('portrait')).toBeCloseTo(1080 / 1920);
  expect(shapeOf('landscape')).toBeCloseTo(1920 / 1080);
  // An order that said nothing about which way up was cut horizontal — the worker's own default.
  expect(shapeOf(undefined)).toBe(shapeOf('landscape'));
});

test('the worker is owed a queued and a processing montage, and nothing else', () => {
  // What starts the re-reading, on the movies face and inside the journal's own hook both. A
  // `ready` or a `failed` row is the worker's last word on it, and a screen left polling over one
  // would ask the api the same question every few seconds for as long as it stays open.
  expect(beingMade('queued')).toBe(true);
  expect(beingMade('processing')).toBe(true);
  expect(beingMade('ready')).toBe(false);
  expect(beingMade('failed')).toBe(false);
});
