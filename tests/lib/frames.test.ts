import { expect, test, vi } from 'vitest';

// A day is written in the app's language now (m-13), and the module that holds it stands on two
// native expo modules vitest has nothing to run. Which language it lands on does not matter here:
// every day below is compared against `formatEventDates` itself.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

import { ApiError, type FrameInfo, type MediaItem, type Member, type Memory } from '@/api';
// The day is written by `@/lib/dates` and read here from the same place: what is pinned below is which
// day the line carries, not how this phone's locale spells it.
import { formatEventDates, startOfDay } from '@/lib/dates';
import {
  allTaken,
  arranged,
  DAY_TILES,
  dateMarks,
  dayTiles,
  FILTER_NONE,
  type Filter,
  filterDays,
  filtering,
  frameFacts,
  frameIndex,
  frameOf,
  framesByDay,
  framesMatching,
  groupFrames,
  keepLabels,
  keepReady,
  mayOpen,
  mayPick,
  megabytes,
  megabytesOf,
  openFrameOf,
  removeFrames,
  SORT_DEFAULT,
  type Sort,
  shotBy,
  stillPreparing,
  toggleDay,
  toggleEvery,
} from '@/lib/frames';
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
  hidden: false,
  size_bytes: '1',
  captured_at: null,
  width: null,
  height: null,
  orientation: null,
  duration_seconds: null,
  created_at: '2026-09-06T10:00:00.000Z',
  label_ids: [],
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
    record({
      id: 'a',
      status: 'ready',
      thumbnail_url: 'https://r2.example/thumbnails/a.jpg?sig=2',
    }),
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
  media_count: 0,
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

test('a small file weighs a fraction, one decimal is all any file under ten gets, and ten is whole', () => {
  // Half a megabyte is a weight and not nothing: it is what a compressed photograph comes to, and
  // «0,5 МБ» is a line a person reads; only a size that is not there at all is dropped.
  expect(megabytes(record({ size_bytes: '500000' }), 'ru')).toBe('0,5');
  // One decimal and not two — the digit the phone’s own gallery shows.
  expect(megabytes(record({ size_bytes: '4250000' }), 'ru')).toBe('4,3');
  expect(megabytes(record({ size_bytes: '9960000' }), 'ru')).toBe('10');
  expect(megabytes(record({ size_bytes: '10400000' }), 'ru')).toBe('10');
  expect(megabytes(record({ size_bytes: '0' }), 'ru')).toBeNull();
});

test('a whole selection weighs what its frames weigh together', () => {
  // The capsule of `FramesPicking` says «38 МБ · 3 фото и 1 видео», which is the sum and not the
  // biggest of them — one rule with the line above, so a selection of one reads exactly like the
  // frame it holds.
  const marked = [
    record({ size_bytes: '4200000' }),
    record({ size_bytes: '4200000' }),
    record({ size_bytes: '2000000' }),
  ];
  expect(megabytesOf(marked, 'ru')).toBe('10');
  expect(megabytesOf([record({ size_bytes: '4200000' })], 'ru')).toBe('4,2');
  // Nothing marked weighs nothing, and nothing is what the capsule then says — never «0 МБ».
  expect(megabytesOf([], 'ru')).toBeNull();
  // A record whose size never came down the wire drags the sum to `NaN` rather than reading as
  // zero, so the line is dropped instead of lying about how much is about to be downloaded.
  expect(megabytesOf([record({ size_bytes: 'nonsense' })], 'ru')).toBeNull();
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
    // No name handed in: the point stands as the numbers it is.
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
  // Either side missing, either way round — never «null × 3024» or «4032 × null».
  for (const one of [{ height: 3024 }, { width: 4032 }, { latitude: 55.518 }]) {
    expect(frameFacts(told(one), ru, 'ru').map((fact) => fact.label)).toEqual(['Файл']);
  }
  // And a record whose size never came down the wire loses «Файл» too, rather than saying «0 МБ».
  expect(frameFacts(told({ size_bytes: '' }), ru, 'ru')).toEqual([]);
});

test('the place is the name the phone gave it — the coordinates until then, and when it gave none', () => {
  const at = told({ latitude: 55.518, longitude: 37.53 });
  const place = (name?: string | null) =>
    frameFacts(at, ru, 'ru', name).filter((fact) => fact.label === 'Место');
  expect(place('Усадьба «Остафьево», Москва')).toEqual([
    { label: 'Место', value: 'Усадьба «Остафьево», Москва' },
  ]);
  // Not answered yet, answered with nothing, or never asked: the row is the coordinates, not a
  // blank and not a placeholder.
  for (const none of [undefined, null, '']) {
    expect(place(none)).toEqual([{ label: 'Место', value: '55.518, 37.53' }]);
  }
  // The name has no row of its own: a frame with no point, or half of one, has no place line at
  // all, whatever the geocoder is holding.
  for (const partial of [{}, { latitude: 55.518 }, { longitude: 37.53 }]) {
    expect(frameFacts(told(partial), ru, 'ru', 'Москва')).toEqual([
      { label: 'Файл', value: '4,2 МБ' },
    ]);
  }
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
  cover_media_id: null,
  cover_thumbnail_url: null,
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
  const line = shotBy(
    record({ uploaded_by: 'u' }),
    [member({ id: 'u' })],
    wedding({
      event_end: '2026-09-05T20:59:59.000Z',
    }),
  );
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

// The «День» block of `SheetFilter` (spec 8, detail 74; TASK-294): what each tile counts and how
// long its bar is, and which days get a tile at all.

/** `n` frames shot on one day, each `bytes` heavy. */
const shots = (date: number, n: number, bytes = '1000000') =>
  Array.from({ length: n }, (_, at) =>
    record({ id: `${date}-${at}`, captured_at: shotAt(date, 10), size_bytes: bytes }),
  );

test('a day counts its frames, and its bar is its bytes beside the heaviest day of the memory', () => {
  // The 13th: 312 photos of a megabyte. The 12th: 88 of them. The 14th: four videos of 80 MB each.
  const items = [...shots(12, 88), ...shots(13, 312), ...shots(14, 4, '80000000')];
  expect(filterDays(items)).toEqual([
    // Newest first, like every cut of the gallery; the tiles put them back in date order.
    { at: day(14), count: 4, fill: 320 / 320 },
    { at: day(13), count: 312, fill: 312 / 320 },
    { at: day(12), count: 88, fill: 88 / 320 },
  ]);
  // Every record carries its size, so four long videos are the heavy day and not a thin one.
  expect(filterDays(items)[0].count).toBeLessThan(filterDays(items)[1].count);
});

test('where no size adds up to anything, a day is weighed by its frames instead', () => {
  const items = [...shots(12, 88, '0'), ...shots(13, 312, 'not a number')];
  expect(filterDays(items)).toEqual([
    { at: day(13), count: 312, fill: 1 },
    { at: day(12), count: 88, fill: 88 / 312 },
  ]);
  expect(filterDays([])).toEqual([]);
});

/** Days as the sheet is handed them: the day of the month and how many frames it holds. */
const offered = (...counts: [number, number][]) =>
  filterDays(counts.flatMap(([date, n]) => shots(date, n)));
const tiled = (...counts: [number, number][]) =>
  dayTiles(offered(...counts)).map((one) => new Date(one.at).getDate());

test('every day gets a tile up to three, in date order', () => {
  expect(DAY_TILES).toBe(3);
  expect(tiled([13, 5])).toEqual([13]);
  expect(tiled([14, 2], [12, 9])).toEqual([12, 14]);
  expect(tiled([14, 86], [13, 312], [12, 88])).toEqual([12, 13, 14]);
  expect(dayTiles([])).toEqual([]);
});

test('past three days the three fullest get the tiles, and the rest are left to the calendar', () => {
  // Four days: the thinnest one goes, whichever end of the event it is at.
  expect(tiled([11, 3], [12, 88], [13, 312], [14, 86])).toEqual([12, 13, 14]);
  expect(tiled([11, 40], [12, 88], [13, 1], [14, 86])).toEqual([11, 12, 14]);
  // A week: the three fullest by frames, still in date order.
  expect(tiled([8, 10], [9, 70], [10, 5], [11, 60], [12, 20], [13, 80], [14, 1])).toEqual([
    9, 11, 13,
  ]);
  // Two equally full days for the last place: the later one keeps it, the way the feed reads.
  expect(tiled([11, 7], [12, 7], [13, 50], [14, 40])).toEqual([12, 13, 14]);
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

/**
 * The sheet as the face draws it: each heading with the frames standing under it. `dates` is the
 * account's «Даты между днями», off as on a new account.
 */
const groups = (items: MediaItem[], sort = SORT_DEFAULT, dates = false) =>
  groupFrames(items, sort, dates).map((group) => [group.key, group.frames.map((item) => item.id)]);

/**
 * Three days of a wedding, as `listMedia` hands them over: oldest shot first. Two boxes lie over
 * them — the shared «Лучшее» and a private one of somebody's own — and a frame lies in as many of
 * them as it likes, or in none (doc-13, api README «Лейблы кадра»).
 */
const wedding3 = [
  record({ id: 'morning', uploaded_by: 'liza', captured_at: shotAt(3, 9), label_ids: ['best'] }),
  record({
    id: 'vows',
    uploaded_by: 'mark',
    kind: 'video',
    captured_at: shotAt(3, 17),
    label_ids: ['best', 'mine'],
  }),
  record({ id: 'dancing', uploaded_by: 'liza', captured_at: shotAt(4, 1) }),
  record({ id: 'breakfast', uploaded_by: 'anya', captured_at: shotAt(4, 10) }),
  record({ id: 'goodbyes', uploaded_by: 'liza', captured_at: shotAt(5, 12), label_ids: ['mine'] }),
];

test('the feed nobody has arranged is one wall with no seam in it at all', () => {
  // `MemoryFrames` and `MemoryScrub`: nothing grouped, newest first, and not one row of the screen
  // spent on saying which day it is — that is the spine's business, out at the edge.
  expect(groups(wedding3)).toEqual([
    ['all', ['goodbyes', 'breakfast', 'dancing', 'vows', 'morning']],
  ]);
  expect(groupFrames([], SORT_DEFAULT, false)).toEqual([]);
});

test('the account’s dates between the days cut that wall into days — `MemoryDated`', () => {
  expect(groups(wedding3, SORT_DEFAULT, true)).toEqual([
    [`day-${day(5)}`, ['goodbyes']],
    [`day-${day(4)}`, ['breakfast', 'dancing']],
    [`day-${day(3)}`, ['vows', 'morning']],
  ]);
});

test('«Сначала старые» turns the whole sheet around, the days as well as their frames', () => {
  // The direction is one answer for the sheet: a strip read one way under headings read the other
  // is nobody's idea of an order.
  expect(groups(wedding3, { by: 'none', order: 'oldest' }, true)).toEqual([
    [`day-${day(3)}`, ['morning', 'vows']],
    [`day-${day(4)}`, ['dancing', 'breakfast']],
    [`day-${day(5)}`, ['goodbyes']],
  ]);
  expect(groups(wedding3, { by: 'none', order: 'oldest' }, false)).toEqual([
    ['all', ['morning', 'vows', 'dancing', 'breakfast', 'goodbyes']],
  ]);
});

test('by people, whoever brought the most stands first — `FramesByPeople`', () => {
  expect(groups(wedding3, { by: 'person', order: 'newest' }, true)).toEqual([
    ['who-liza', ['goodbyes', 'dancing', 'morning']],
    // Two people who brought the same amount fall in the sheet's own direction: Anya's one frame is
    // the newer of the two, and reading newest first that is the heading that comes first.
    ['who-anya', ['breakfast']],
    ['who-mark', ['vows']],
  ]);
  // A seam about somebody is already saying where their frames begin, so the account's dates have
  // nothing left to give here — the cut answers the same either way.
  expect(groups(wedding3, { by: 'person', order: 'newest' }, false)).toEqual(
    groups(wedding3, { by: 'person', order: 'newest' }, true),
  );
});

test('by kind, photos before videos, and a kind nobody brought is not a heading', () => {
  const byKind: Sort = { by: 'kind', order: 'newest' };
  expect(groups(wedding3, byKind).map(([key]) => key)).toEqual(['kind-photo', 'kind-video']);
  const photos = wedding3.filter((item) => item.kind === 'photo');
  expect(groups(photos, byKind).map(([key]) => key)).toEqual(['kind-photo']);
  expect(groupFrames([], byKind, false)).toEqual([]);
});

test('every day of the wall is a mark on the spine, on the seam between two rows', () => {
  // Spec 7.8, detail 66 — `MemoryScrub`. The wall in the order it is actually drawn in, three
  // across: «goodbyes», «breakfast» and «dancing» make the first row, «vows» and «morning» the
  // second. So the last day opens the feed at its very top, and the first day opens the second row
  // one pitch down.
  const wall = groupFrames(wedding3, SORT_DEFAULT, false)[0].frames;
  expect(dateMarks(wall, { top: 100, row: 131 })).toEqual([
    { at: day(5), top: 100 },
    { at: day(3), top: 231 },
  ]);
  // And the day in between gets no pill of its own: it begins in the middle of the first row, on a
  // seam that already carries one. A mark stands between rows and never inside one, and a seam
  // holds a single pill — the day that opened it.
  expect(dateMarks([], { top: 100, row: 131 })).toEqual([]);
});

test('the wall is three across: a day that begins in the same row as another gives its seam up to it', () => {
  // `wedding3` above comes out the same under two columns and under three, so it cannot say how wide
  // a row is. Here it does: the 12th begins on the third frame — still the first row of three, on
  // the seam the 13th opened — and the 11th begins on the fifth, in the second.
  const wall = [
    record({ id: 'a', captured_at: shotAt(13, 10) }),
    record({ id: 'b', captured_at: shotAt(13, 9) }),
    record({ id: 'c', captured_at: shotAt(12, 15) }),
    record({ id: 'd', captured_at: shotAt(12, 14) }),
    record({ id: 'e', captured_at: shotAt(11, 10) }),
  ];
  expect(dateMarks(wall, { top: 0, row: 100 })).toEqual([
    { at: day(13), top: 0 },
    { at: day(11), top: 100 },
  ]);
  // And a day that begins a row of its own is a pill of its own, one pitch further down each time.
  const each = [
    record({ id: 'a', captured_at: shotAt(13, 10) }),
    record({ id: 'b', captured_at: shotAt(13, 9) }),
    record({ id: 'c', captured_at: shotAt(13, 8) }),
    record({ id: 'd', captured_at: shotAt(12, 10) }),
    record({ id: 'e', captured_at: shotAt(12, 9) }),
    record({ id: 'f', captured_at: shotAt(12, 8) }),
    record({ id: 'g', captured_at: shotAt(11, 8) }),
  ];
  expect(dateMarks(each, { top: 10, row: 50 })).toEqual([
    { at: day(13), top: 10 },
    { at: day(12), top: 60 },
    { at: day(11), top: 110 },
  ]);
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

test('wide or tall is its own axis: a square frame and one never measured stand only under «Все»', () => {
  // Spec 8, `SheetFilter`, «Ориентация»: the api's `orientation`, a separate axis from `kind`.
  const shaped = [
    record({ id: 'wide', orientation: 'landscape' }),
    record({ id: 'tall', orientation: 'portrait' }),
    record({ id: 'tallVideo', kind: 'video', orientation: 'portrait' }),
    record({ id: 'square', orientation: 'square' }),
    record({ id: 'unmeasured', orientation: null }),
  ];
  const only = (over: Partial<Filter>) =>
    framesMatching(shaped, { ...FILTER_NONE, ...over }).map((item) => item.id);

  expect(only({})).toEqual(['wide', 'tall', 'tallVideo', 'square', 'unmeasured']);
  expect(only({ orientation: 'landscape' })).toEqual(['wide']);
  expect(only({ orientation: 'portrait' })).toEqual(['tall', 'tallVideo']);
  // «и» between sections: the tall ones of the videos.
  expect(only({ orientation: 'portrait', kind: 'video' })).toEqual(['tallVideo']);
  expect(filtering({ ...FILTER_NONE, orientation: 'portrait' })).toBe(true);
});

test('a label is looked at by narrowing the feed to it — there is no screen of its own', () => {
  // Spec 10.8.2. The frames are read by the boxes they say they are in, which is what the api hands
  // the gallery; a box this person may not see left no id there to match in the first place.
  const only = (over: Partial<Filter>) =>
    framesMatching(wedding3, { ...FILTER_NONE, ...over }).map((item) => item.id);

  expect(only({ labels: new Set(['best']) })).toEqual(['morning', 'vows']);
  // Several boxes are «any of these», the same «or» the people row is — «vows» lies in both and is
  // still one frame on the feed.
  expect(only({ labels: new Set(['best', 'mine']) })).toEqual(['morning', 'vows', 'goodbyes']);
  // And the groups narrow each other the way they always did: the video of «Лучшее», and then the
  // combination the sheet will not let anybody apply at all.
  expect(only({ labels: new Set(['best']), kind: 'video' })).toEqual(['vows']);
  expect(only({ labels: new Set(['mine']), people: new Set(['anya']) })).toEqual([]);
  expect(only({ labels: new Set(['best']), days: new Set([day(3)]) })).toEqual(['morning', 'vows']);
  // A box nothing is in is not a box that shows everything.
  expect(only({ labels: new Set(['empty']) })).toEqual([]);
});

test('a box that has gone takes itself out of the filter, and nothing else with it', () => {
  // The chip is off the sheet the moment the label is deleted, so nothing is left to press it off
  // with — and every frame has just lost the id as well (`filed`), which would leave the feed
  // narrowed to nothing at all.
  const had: Filter = {
    ...FILTER_NONE,
    labels: new Set(['best', 'mine']),
    people: new Set(['liza']),
  };
  const left = keepLabels(had, (one) => one !== 'best');
  expect([...left.labels]).toEqual(['mine']);
  expect(left.people).toBe(had.people);
  // Deleted by somebody else: the list read afresh no longer has it, and that is what is kept.
  const listed = new Set(['mine', 'other']);
  expect([...keepLabels(had, (one) => listed.has(one)).labels]).toEqual(['mine']);
  // Nothing to drop comes back as it is — the screen holding it re-renders over nothing otherwise.
  expect(keepLabels(had, (one) => one !== 'other')).toBe(had);
  const only: Filter = { ...FILTER_NONE, labels: new Set(['best']) };
  expect(filtering(keepLabels(only, (one) => one !== 'best'))).toBe(false);
});

test('the spark dot means «no longer at its default», and nothing else', () => {
  expect(filtering(FILTER_NONE)).toBe(false);
  expect(filtering({ ...FILTER_NONE, kind: 'video' })).toBe(true);
  expect(filtering({ ...FILTER_NONE, people: new Set(['liza']) })).toBe(true);
  expect(filtering({ ...FILTER_NONE, days: new Set([day(4)]) })).toBe(true);
  // One rule over every group of the sheet, the labels included (spec 10.8.2).
  expect(filtering({ ...FILTER_NONE, labels: new Set(['best']) })).toBe(true);

  expect(arranged(SORT_DEFAULT)).toBe(false);
  expect(arranged({ ...SORT_DEFAULT, by: 'person' })).toBe(true);
  expect(arranged({ ...SORT_DEFAULT, order: 'oldest' })).toBe(true);
  // The dates between the days are not asked at all: they are the account's setting and not this
  // feed's arrangement, so `MemoryDated` at the default order burns no dot (spec 8).
  expect(SORT_DEFAULT).toEqual({ by: 'none', order: 'newest' });
});

// «Выбрать все» in the capsule of the picking mode (spec 8, `FramesPicking`): every frame a mark could
// mean something on, and the same press gives them back once they are all taken.

const ready = (id: string) =>
  record({ id, status: 'ready', thumbnail_url: `https://r2.example/${id}` });

test('the capsule takes every frame, and once they are all taken it gives them back', () => {
  const feed = [ready('a'), ready('b'), ready('c')];
  expect(toggleEvery(feed, new Set())).toEqual(new Set(['a', 'b', 'c']));
  expect(toggleEvery(feed, new Set(['a']))).toEqual(new Set(['a', 'b', 'c']));
  expect(toggleEvery(feed, new Set(['a', 'b', 'c']))).toEqual(new Set());
});

test('ids of frames that are gone do not make «все взято» true while a frame is still bare', () => {
  // Three markable frames, three ids held — but two of the ids are frames somebody else deleted. Read
  // as a count, that was «everything is taken» and the press wiped the selection instead of taking `c`.
  const feed = [ready('a'), ready('b'), ready('c')];
  expect(toggleEvery(feed, new Set(['a', 'gone-1', 'gone-2']))).toEqual(new Set(['a', 'b', 'c']));
});

test('a strip of one frame is a whole strip: full when that frame is marked, and given back on the next press', () => {
  // A day of a single frame is the commonest seam there is, and «every» of one is that one — not
  // «nothing», which is what a count of more than one would make of it.
  const one = [ready('a')];
  expect(allTaken(one, new Set(['a']))).toBe(true);
  expect(toggleEvery(one, new Set(['a']))).toEqual(new Set());
  expect(toggleDay(one, new Set(['a', 'other']))).toEqual(new Set(['other']));
  expect(toggleDay(one, new Set(['other']))).toEqual(new Set(['other', 'a']));
});

test('nothing to take is nothing taken, never a selection made of stale ids', () => {
  expect(toggleEvery([], new Set())).toEqual(new Set());
  expect(toggleEvery([], new Set(['gone']))).toEqual(new Set());
});

// The seam over a strip (spec 7.8) is a switch over that strip's frames: it takes them, and once the
// whole strip is taken the same press gives them back — without touching a mark made anywhere else.

test('a seam takes its whole strip and keeps what is marked elsewhere', () => {
  const strip = [ready('a'), ready('b')];
  expect(toggleDay(strip, new Set())).toEqual(new Set(['a', 'b']));
  expect(toggleDay(strip, new Set(['other']))).toEqual(new Set(['other', 'a', 'b']));
});

test('a seam with part of its strip taken completes it instead of clearing it', () => {
  expect(toggleDay([ready('a'), ready('b')], new Set(['a']))).toEqual(new Set(['a', 'b']));
});

test('a second press on a fully taken seam gives back its own strip and nothing else', () => {
  expect(toggleDay([ready('a'), ready('b')], new Set(['a', 'b', 'other']))).toEqual(
    new Set(['other']),
  );
});

test('the seam’s circle is full only when every frame of its strip is marked', () => {
  const strip = [ready('a'), ready('b')];
  expect(allTaken(strip, new Set(['a', 'b', 'other']))).toBe(true);
  expect(allTaken(strip, new Set(['a']))).toBe(false);
  // Nothing markable is not «everything marked»: an empty strip never shows a full circle.
  expect(allTaken([], new Set(['a']))).toBe(false);
  expect(toggleDay([], new Set(['a']))).toEqual(new Set(['a']));
});

// Taking marked frames out of the memory, one call after another.

test('every frame that goes is reported gone, in the order it went', async () => {
  const sent: string[] = [];
  const { gone, failure } = await removeFrames([ready('a'), ready('b')], async (item) => {
    sent.push(item.id);
  });
  expect(sent).toEqual(['a', 'b']);
  expect(gone).toEqual(new Set(['a', 'b']));
  expect(failure).toBeUndefined();
});

test('a frame the api no longer has is gone all the same, and the run carries on past it', async () => {
  // Somebody else deleted `b` a moment ago: 404 is what was wanted, not a reason to leave `c` behind.
  const sent: string[] = [];
  const { gone, failure } = await removeFrames(
    [ready('a'), ready('b'), ready('c')],
    async (item) => {
      sent.push(item.id);
      if (item.id === 'b') throw new ApiError(404, { error: 'not found' });
    },
  );
  expect(sent).toEqual(['a', 'b', 'c']);
  expect(gone).toEqual(new Set(['a', 'b', 'c']));
  expect(failure).toBeUndefined();
});

test('a refusal stops the run, and what went before it still leaves the feed', async () => {
  const sent: string[] = [];
  const denied = new ApiError(403, { error: 'forbidden' });
  const { gone, failure } = await removeFrames(
    [ready('a'), ready('b'), ready('c')],
    async (item) => {
      sent.push(item.id);
      if (item.id === 'b') throw denied;
    },
  );
  // `c` would have met the same answer, so it is not asked; `b` stayed, so it is not gone.
  expect(sent).toEqual(['a', 'b']);
  expect(gone).toEqual(new Set(['a']));
  expect(failure).toBe(denied);
});

test('no connection is a failure of the run too, not a frame that went', async () => {
  const offline = new TypeError('Network request failed');
  const { gone, failure } = await removeFrames([ready('a'), ready('b')], async () => {
    throw offline;
  });
  expect(gone).toEqual(new Set());
  expect(failure).toBe(offline);
});

test('a screen that has been left stops the errand between frames, not inside one', async () => {
  let here = true;
  const sent: string[] = [];
  const { gone } = await removeFrames(
    [ready('a'), ready('b'), ready('c')],
    async (item) => {
      sent.push(item.id);
      here = false; // walked out while `a` was in flight
    },
    () => here,
  );
  expect(sent).toEqual(['a']);
  expect(gone).toEqual(new Set(['a']));
});
