import { expect, test, vi } from 'vitest';

// A day is written in the app's language now (m-13), and the module that holds it stands on two
// native expo modules vitest has nothing to run. Which language it lands on does not matter here:
// every day below is compared against `formatEventDates` itself.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

import type { FrameInfo, MediaItem, Member, Memory } from '@/api';
// The day is written by `@/dates` and read here from the same place: what is pinned below is which
// day the line carries, not how this phone's locale spells it.
import { formatEventDates, startOfDay } from '@/dates';
import {
  arranged,
  FILTER_NONE,
  filtering,
  frameFacts,
  frameIndex,
  frameOf,
  framesByDay,
  framesMatching,
  groupFrames,
  keepReady,
  mayOpen,
  mayPick,
  megabytes,
  openFrameOf,
  shotBy,
  SORT_DEFAULT,
  stillPreparing,
  type Filter,
} from '@/frames';
// The words of the sheet, read from the dictionary rather than repeated here: what is pinned below
// is which lines are drawn, and the wording is `strings.ts`'s own business.
import { ru } from '@/strings';

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
  // Null on both while the automatic pass has not looked: nothing the gallery draws reads them, and
  // the order screen is where they mean anything (TASK-162).
  screening_rejected: null,
  screening_reason: null,
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

// What the frame opened full screen is drawn from (TASK-120). It used to be the same 640px
// thumbnail the grid draws in a tile, stretched over the whole of a phone — the mush that was
// reported. The tiles above keep the thumbnail; only this reading changed.

test('the frame opened full screen is the big derivative and not the tile’s thumbnail', () => {
  const big = record({
    status: 'ready',
    thumbnail_url: 'https://r2.example/thumbnails/a.jpg?sig=1',
    preview_url: 'https://r2.example/previews/a.mp4?sig=1',
  });
  expect(openFrameOf(big)).toEqual({
    state: 'ready',
    uri: 'https://r2.example/previews/a.mp4?sig=1',
  });
  // The grid is untouched by it: a tile is still handed the miniature it is a miniature for.
  expect(frameOf(big).uri).toBe('https://r2.example/thumbnails/a.jpg?sig=1');
});

test('a record with no big derivative opens on its thumbnail rather than on nothing', () => {
  // Every photo, today: the worker makes a thumbnail for a photo and only a video gets a preview
  // (architecture.md). Read straight, `preview_url` would put «Показывать нечего» over a picture
  // that is right there — blurry beats absent until a large photo derivative exists.
  expect(openFrameOf(secondRead[0])).toEqual(frameOf(secondRead[0]));
});

test('a record with neither is the fallen frame however it is opened', () => {
  expect(openFrameOf(record({ status: 'ready' }))).toEqual({ state: 'failed', uri: null });
  expect(openFrameOf(firstRead[0])).toEqual({ state: 'processing', uri: null });
});

test('a record the worker gave up on stops the reading instead of being waited on forever', () => {
  const failed = [record({ status: 'failed' })];
  expect(stillPreparing(failed)).toBe(false);
  expect(frameOf(failed[0])).toEqual({ state: 'failed', uri: null });
});

test('one record still coming keeps the reading going for the whole sheet', () => {
  expect(stillPreparing([...secondRead, record({ id: 'b' })])).toBe(true);
});

// What that reading costs the phone, and what it must not cost it (TASK-119). Every answer signs
// every link again, so the same picture comes back under a url it has never seen — and a url it has
// never seen is a file it downloads. Three seconds later, again, for the whole sheet.

test('a finished frame keeps its own link while the sheet is still being read', () => {
  const [was] = secondRead;
  // The same record as the api sends it a moment later: nothing about it changed but the signature.
  const reSigned = [
    record({ id: 'a', status: 'ready', thumbnail_url: 'https://r2.example/thumbnails/a.jpg?sig=2' }),
  ];
  const [now] = keepReady(secondRead, reSigned);

  expect(now).toBe(was);
  expect(frameOf(now).uri).toBe('https://r2.example/thumbnails/a.jpg?sig=1');
});

test('the frame that was still developing is taken as it came — that is what the reading is for', () => {
  const [now] = keepReady(firstRead, secondRead);
  expect(frameOf(now)).toEqual({
    state: 'ready',
    uri: 'https://r2.example/thumbnails/a.jpg?sig=1',
  });
  // And with nothing left developing the reading stops, so the next link it draws is a fresh one.
  expect(stillPreparing(keepReady(firstRead, secondRead))).toBe(false);
});

test('what the last read never saw arrives whole, and what has gone does not come back', () => {
  const sent = record({ id: 'b' });
  expect(keepReady(secondRead, [...secondRead, sent])[1]).toBe(sent);
  // Somebody deleted the finished one between two reads: it is held nowhere, only kept if it comes.
  expect(keepReady(secondRead, [sent])).toEqual([sent]);
  // And the very first read has nothing to hold anything against.
  expect(keepReady(null, secondRead)).toEqual(secondRead);
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

test('how heavy a file is, written the way the language writes a number', () => {
  // The frame's own sheet says «4,2 МБ» beside who brought it — megabytes the way a phone counts
  // them, so the number stands beside the one the phone's own gallery shows for the same file.
  expect(megabytes(record({ size_bytes: '4200000' }), 'ru')).toBe('4,2');
  expect(megabytes(record({ size_bytes: '4200000' }), 'en')).toBe('4.2');
  // Past ten megabytes the decimal is noise: a video is hundreds of them.
  expect(megabytes(record({ size_bytes: '412300000' }), 'ru')).toBe('412');
  // A record whose size never came down the wire has nothing to say, and the line is built to drop
  // it rather than to write «0 МБ» under somebody's photograph.
  expect(megabytes(record({ size_bytes: '' }))).toBeNull();
  expect(megabytes(record({ size_bytes: 'nonsense' }))).toBeNull();
});

/**
 * The frame's own sheet (spec 8, `SheetFrameInfo`). Half of what it shows is written by the montage
 * worker out of the original's metadata, so «сервер этого не знает» is the ordinary case and not the
 * broken one — these pin the one rule the whole sheet stands on: a line nobody can fill is not drawn.
 */

/** One frame as its own route hands it over, with everything the worker writes left empty. */
const told = (over: Partial<FrameInfo> = {}): FrameInfo => ({
  id: 'a',
  size_bytes: '4200000',
  captured_at: '2026-09-13T18:47:00.000Z',
  created_at: '2026-09-15T09:12:00.000Z',
  width: null,
  height: null,
  camera_model: null,
  focal_length_mm: null,
  aperture: null,
  latitude: null,
  longitude: null,
  uploaded_by: { id: 'u', username: 'mark', name: 'Марк Ковалёв', media_count: 96 },
  montages: [],
  ...over,
});

test('the sheet says only what the server knows, and never a line with a dash in it', () => {
  const whole = frameFacts(
    told({
      file_name: 'IMG_4471.HEIC',
      width: 4032,
      height: 3024,
      camera_model: 'iPhone 15 Pro',
      focal_length_mm: 24,
      aperture: 1.8,
      latitude: 55.518,
      longitude: 37.53,
    }),
    ru,
    'ru',
  );
  expect(whole).toEqual([
    { label: 'Файл', value: 'IMG_4471.HEIC · 4,2 МБ' },
    { label: 'Размер', value: '4032 × 3024' },
    { label: 'Камера', value: 'iPhone 15 Pro · 24 мм · f/1.8' },
    // Coordinates as the numbers they are: naming a place takes a geocoder the product has not got.
    { label: 'Место', value: '55.518, 37.53' },
  ]);

  // The same frame as an older record: the worker never looked at it, and every field it fills is
  // empty. Three of the four lines go with them — and «Файл» keeps the one thing that is known.
  expect(frameFacts(told(), ru, 'ru')).toEqual([{ label: 'Файл', value: '4,2 МБ' }]);
});

test('a line is built out of the pieces that are there, and dropped when none are', () => {
  // A camera that stamped its name and nothing else is still a camera.
  expect(frameFacts(told({ camera_model: 'iPhone 15 Pro' }), ru, 'ru')[1]).toEqual({
    label: 'Камера',
    value: 'iPhone 15 Pro',
  });
  // Half a pair of sides is not a size, and a stray longitude is not a place.
  const half = frameFacts(told({ width: 4032, longitude: 37.53 }), ru, 'ru');
  expect(half.map((fact) => fact.label)).toEqual(['Файл']);
  // And a record whose size never came down the wire loses «Файл» too, rather than saying «0 МБ».
  expect(frameFacts(told({ size_bytes: '' }), ru, 'ru')).toEqual([]);
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
  member_count: 1,
  contributed_member_count: 0,
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

// The review fix in `dayFields` (m-12) stops an unreadable date at its one source instead of at
// every screen that prints one — this is the other caller `dates.test.ts` cannot see: a memory that
// *did* come back, but with an `event_start` the api sent garbled or empty. Before the guard this
// line would have read «Marina · NaN Invalid Date NaN»; the fix is only real if the separator goes
// with the date here too, the same way it does when the memory is missing outright.
test('a memory that came back with an unreadable event date is the name alone, not «NaN»', () => {
  const shot = record({ uploaded_by: 'u' });
  const roster = [member({ id: 'u' })];
  expect(shotBy(shot, roster, wedding({ event_start: 'not-a-day' }))).toBe('Marina');
  expect(shotBy(shot, roster, wedding({ event_start: '' }))).toBe('Marina');
});

// The sheet cut into the days it was shot over (TASK-121): the contact sheet drew one flat grid, so
// the kit's daymark had nowhere to stand and «Выбрать все N» nothing to count. The cut itself is
// here rather than in the screen, which no test in this project can render.
//
// Every instant below is built from a *local* date and never from a literal like
// '2026-09-03T00:00:00Z': the days are local days, so a test written in UTC would pass only for
// whoever ran it in London.

/** The instant a day began here — what a strip of the sheet is keyed by. */
const day = (date: number) => new Date(2026, 8, date).getTime();
/** A moment on one of those days, as the api writes it. */
const shotAt = (date: number, h = 12, m = 0, s = 0, ms = 0) =>
  new Date(2026, 8, date, h, m, s, ms).toISOString();

/** The sheet as the screen draws it: the days in order, each with its own frames in theirs. */
const strips = (items: MediaItem[]): [number, string[]][] =>
  framesByDay(items).map((one) => [one.at, one.frames.map((item) => item.id)]);

test('the sheet is cut into local days, the newest first, each keeping the order it arrived in', () => {
  // As `listMedia` hands it over: oldest shot first, the order a montage would play it in.
  const items = [
    record({ id: 'first-millisecond', captured_at: shotAt(3, 0) }),
    record({ id: 'noon', captured_at: shotAt(3, 12) }),
    record({ id: 'last-millisecond', captured_at: shotAt(3, 23, 59, 59, 999) }),
    record({ id: 'the-morning-after', captured_at: shotAt(4, 9) }),
  ];

  expect(strips(items)).toEqual([
    // Only the days are turned around — the sheet is read from the newest day down.
    [day(4), ['the-morning-after']],
    // Both edges of the day belong to it, and inside a day nothing is reordered.
    [day(3), ['first-millisecond', 'noon', 'last-millisecond']],
  ]);
});

test('the day is the one the frame was shot on, and the one it arrived on only if it has none', () => {
  // The same coalesce the api sorts the gallery by, so a day is one unbroken run of what it sends.
  const items = [
    record({ id: 'stamped', captured_at: shotAt(3, 12), created_at: shotAt(9, 12) }),
    record({ id: 'unstamped', captured_at: null, created_at: shotAt(9, 12) }),
  ];

  expect(strips(items)).toEqual([
    [day(9), ['unstamped']],
    [day(3), ['stamped']],
  ]);
});

test('a frame whose day will not parse sinks to the bottom and is not thrown away', () => {
  const items = [
    record({ id: 'garbled', captured_at: 'not-a-day', created_at: 'not-a-day' }),
    record({ id: 'dated', captured_at: shotAt(3, 12) }),
  ];
  const [dated, garbled] = strips(items);

  expect(dated).toEqual([day(3), ['dated']]);
  // On the epoch day, under everything — somebody sent it and it is in the memory.
  expect(garbled).toEqual([startOfDay(new Date(0)).getTime(), ['garbled']]);
});

test('an empty gallery is no days at all, which is what the sheet draws its «empty» for', () => {
  expect(framesByDay([])).toEqual([]);
});

// What a day's «Выбрать все N» counts, and what a single tap marks — one question, one answer
// («ждущие и упавшие кадры не отмечаются: скачивать нечего»).

test('only a frame with something behind it can be marked for taking home', () => {
  expect(mayPick(secondRead[0])).toBe(true);
  // Still being developed: there is nothing to download yet.
  expect(mayPick(firstRead[0])).toBe(false);
  expect(mayPick(record({ status: 'failed' }))).toBe(false);
  // And the frame's reading rather than the record's status: `ready` with no derivative is fallen,
  // so it is out of the picking too even though the api calls it finished.
  expect(mayPick(record({ status: 'ready' }))).toBe(false);
});

test('the count on a day is what a tap on each of its frames would mark, never the day’s size', () => {
  const shot = shotAt(3, 12);
  const [{ frames }] = framesByDay([
    record({
      id: 'ready',
      status: 'ready',
      thumbnail_url: 'https://r2.example/a.jpg',
      captured_at: shot,
    }),
    record({ id: 'developing', captured_at: shot }),
    record({ id: 'fallen', status: 'failed', captured_at: shot }),
  ]);

  // A day of three frames offering «Выбрать все 1», because that is all a tap could reach.
  expect(frames).toHaveLength(3);
  expect(frames.filter(mayPick).map((item) => item.id)).toEqual(['ready']);
});

test('a name nobody claimed is the username, and somebody off the roster is «Someone»', () => {
  const shot = record({ uploaded_by: 'u' });
  const day = wedding();
  expect(shotBy(shot, [member({ id: 'u', name: null })], day).startsWith('marina · ')).toBe(true);
  // Whoever left the memory is off the roster, and the frame they brought stays.
  expect(shotBy(shot, [member({ id: 'other' })], day).startsWith('Someone · ')).toBe(true);
  expect(shotBy(shot, null, day).startsWith('Someone · ')).toBe(true);
});

// What the two sheets at the foot of the gallery decide (TASK-144): `SheetSort` cuts it into groups
// and picks the direction each one reads in, `SheetFilter` decides what is in it at all. Both live
// here for the reason the cut into days does — the screen that draws them cannot be rendered by any
// test in this project, and the counts on both sheets have to agree with what they then show.

/** The sheet as the face draws it: each heading with the frames standing under it. */
const groups = (items: MediaItem[], sort = SORT_DEFAULT) =>
  groupFrames(items, sort).map((group) => [group.key, group.frames.map((item) => item.id)]);

/** Three days of a wedding, as `listMedia` hands them over: oldest shot first. */
const wedding3 = [
  record({ id: 'morning', uploaded_by: 'liza', captured_at: shotAt(3, 9) }),
  record({ id: 'vows', uploaded_by: 'mark', kind: 'video', captured_at: shotAt(3, 17) }),
  record({ id: 'dancing', uploaded_by: 'liza', captured_at: shotAt(4, 1) }),
  record({ id: 'breakfast', uploaded_by: 'anya', captured_at: shotAt(4, 10) }),
  record({ id: 'goodbyes', uploaded_by: 'liza', captured_at: shotAt(5, 12) }),
];

test('by day, the newest day is on top and the newest frame of it first', () => {
  expect(groups(wedding3)).toEqual([
    [`day-${day(5)}`, ['goodbyes']],
    [`day-${day(4)}`, ['breakfast', 'dancing']],
    [`day-${day(3)}`, ['vows', 'morning']],
  ]);
});

test('«Сначала старые» turns the whole sheet around, the days as well as their frames', () => {
  // The direction is one answer for the sheet: a strip read one way under headings read the other
  // is nobody's idea of an order.
  expect(groups(wedding3, { by: 'day', order: 'oldest' })).toEqual([
    [`day-${day(3)}`, ['morning', 'vows']],
    [`day-${day(4)}`, ['dancing', 'breakfast']],
    [`day-${day(5)}`, ['goodbyes']],
  ]);
});

test('by people, whoever brought the most stands first — `FramesByPeople`', () => {
  expect(groups(wedding3, { by: 'person', order: 'newest' })).toEqual([
    ['who-liza', ['goodbyes', 'dancing', 'morning']],
    // Two people who brought the same amount fall in the sheet's own direction: Anya's one frame is
    // the newer of the two, and reading newest first that is the heading that comes first.
    ['who-anya', ['breakfast']],
    ['who-mark', ['vows']],
  ]);
});

test('by kind, photos before videos, and a kind nobody brought is not a heading', () => {
  expect(groups(wedding3, { by: 'kind', order: 'newest' }).map(([key]) => key)).toEqual([
    'kind-photo',
    'kind-video',
  ]);
  const photos = wedding3.filter((item) => item.kind === 'photo');
  expect(groups(photos, { by: 'kind', order: 'newest' }).map(([key]) => key)).toEqual([
    'kind-photo',
  ]);
  expect(groupFrames([], { by: 'kind', order: 'newest' })).toEqual([]);
});

test('the filter holds back by who brought it, what it is, and which day it is from', () => {
  const only = (over: Partial<Filter>) =>
    framesMatching(wedding3, { ...FILTER_NONE, ...over }).map((item) => item.id);

  expect(only({})).toEqual(wedding3.map((item) => item.id));
  expect(only({ kind: 'video' })).toEqual(['vows']);
  expect(only({ people: new Set(['liza']) })).toEqual(['morning', 'dancing', 'goodbyes']);
  expect(only({ days: new Set([day(4)]) })).toEqual(['dancing', 'breakfast']);
  // Several chips of one row are «any of these», and the three rows narrow each other.
  expect(only({ people: new Set(['liza', 'anya']), days: new Set([day(4)]) })).toEqual([
    'dancing',
    'breakfast',
  ]);
  // The combination the sheet will not let anybody apply — the count on its button is what says so
  // before the press, and this is the question that count is asked.
  expect(only({ people: new Set(['mark']), kind: 'photo' })).toEqual([]);
});

test('the spark dot means «no longer at its default», and nothing else', () => {
  expect(filtering(FILTER_NONE)).toBe(false);
  expect(filtering({ ...FILTER_NONE, kind: 'video' })).toBe(true);
  expect(filtering({ ...FILTER_NONE, people: new Set(['liza']) })).toBe(true);
  expect(filtering({ ...FILTER_NONE, days: new Set([day(4)]) })).toBe(true);

  expect(arranged(SORT_DEFAULT)).toBe(false);
  expect(arranged({ by: 'person', order: 'newest' })).toBe(true);
  expect(arranged({ by: 'day', order: 'oldest' })).toBe(true);
});
