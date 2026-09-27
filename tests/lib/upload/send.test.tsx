import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { Asset } from 'expo-media-library/legacy';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { UploadPlan } from '@/api';
import { partDeadline, type QueuedFile, type UploadFailure } from '@/lib/upload/queue';
import { drop, enqueue, useUploads, wake } from '@/lib/upload/send';

const { api, library, foreground, disk } = vi.hoisted(() => ({
  api: { startUpload: vi.fn(), refreshUpload: vi.fn(), finishUpload: vi.fn() },
  library: { getAssetInfoAsync: vi.fn() },
  /** Whoever is listening for the app to come back to the foreground. */
  foreground: new Set<(state: string) => void>(),
  /** Every queue the pump wrote down, the last one last. */
  disk: [] as string[],
}));

vi.mock('@/api', () => ({
  ...api,
  ApiError: class extends Error {},
  apiReason: () => undefined,
  setContributionStatus: async () => {},
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ status: 'ready', token: 'session' }) }));
vi.mock('expo-media-library/legacy', () => library);
// Twenty bytes at eight to a part is three parts: one before and one after the part a case is about.
// The queue's own file is the same class, and keeps what it is handed. `ph://…` is the library's
// handle and not a path, which the real class cannot open either; a file under `locked/` opens and
// then will not give its bytes up.
vi.mock('expo-file-system', () => ({
  Paths: { document: 'documents' },
  File: class {
    uri: string;
    constructor(...path: string[]) {
      this.uri = path.join('/');
    }
    get exists() {
      return !this.uri.startsWith('ph://');
    }
    size = 20;
    textSync = () => '[]';
    write = (text: string) => disk.push(text);
    open = () => ({
      offset: 0,
      readBytes: (length: number) => {
        if (this.uri.includes('locked/')) throw new Error('The file couldn’t be opened.');
        return new Uint8Array(length);
      },
      close() {},
    });
  },
}));
// Off a phone `react-native-web` hands out no subscription at all, and the hook removes its own.
vi.mock('react-native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-native')>()),
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      foreground.add(listener);
      return { remove: () => foreground.delete(listener) };
    },
  },
}));

mountsTrees();

const PHOTO = {
  id: 'a1',
  filename: 'IMG_0001.HEIC',
  mediaType: 'photo',
  creationTime: 0,
  duration: 0,
} as Asset;

const plan = (links: string): UploadPlan => ({
  id: 'media-1',
  status: 'pending_upload',
  upload: {
    key: 'originals/media-1',
    upload_id: 'upload-1',
    part_size: 8,
    parts: [1, 2, 3].map((n) => ({ part_number: n, url: `https://storage/${links}/${n}` })),
    expires_at: '2026-09-25T13:00:00.000Z',
  },
});

/** A part taken, with a receipt named after the part so the seal can be read back. */
const receipted = (url: string) => new Response('', { headers: { etag: `"${url.slice(-1)}"` } });

const SEALED = [1, 2, 3].map((n) => ({ part_number: n, etag: `"${n}"` }));

/** Google's answer to a link past its time, as TASK-328 caught it live. */
const EXPIRED =
  "<?xml version='1.0' encoding='UTF-8'?><Error><Code>ExpiredToken</Code>" +
  '<Message>The provided token has expired.</Message>' +
  '<Details>Request signature expired at: 2026-09-18T12:00:00+00:00</Details></Error>';

const written = (): QueuedFile[] => JSON.parse(disk.at(-1) ?? '[]');

/** The pump only runs for a signed-in session, and this hook is what hands it one. */
function Pump() {
  useUploads();
  return null;
}

/** What storage says to a part: a response, or nothing yet. */
type Answer = (url: string, signal: AbortSignal) => Response | Promise<Response>;

/**
 * One photo through the pump, storage answering each part with `answer`. Done when the pump is: the
 * file sealed and gone from the queue, or parked in it with a reason. `wait` is how long the clock
 * is moved on first, for a case about storage that never answers.
 */
async function upload(answer: Answer, wait = 0) {
  const put: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    put.push(url);
    return answer(url, init.signal as AbortSignal);
  });
  await act(async () => {
    mounted(TestRenderer.create(<Pump />));
  });
  await act(async () => {
    enqueue('m1', [PHOTO]);
    if (wait > 0) await vi.advanceTimersByTimeAsync(wait);
    await vi.waitFor(() => expect(written().every((file) => file.error !== undefined)).toBe(true));
  });
  return { put, queue: written() };
}

/** The gallery's answer for an entry, as the phone gives it when all is well. */
const onPhone = async (id: string) => ({ id, uri: `ph://${id}`, localUri: `file:///${id}` });

beforeEach(() => {
  disk.length = 0;
  api.startUpload.mockResolvedValue(plan('first'));
  api.refreshUpload.mockResolvedValue(plan('fresh'));
  api.finishUpload.mockResolvedValue({ id: 'media-1', status: 'processing', first_upload: false });
  library.getAssetInfoAsync.mockImplementation(onPhone);
});

afterEach(async () => {
  await act(async () => drop('m1', PHOTO.id));
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('seals the file with the receipt storage gave for every part', async () => {
  const { put, queue } = await upload(receipted);
  expect(put).toEqual([1, 2, 3].map((n) => `https://storage/first/${n}`));
  expect(api.refreshUpload).not.toHaveBeenCalled();
  expect(api.finishUpload).toHaveBeenCalledWith('session', 'm1', 'media-1', SEALED);
  expect(queue).toEqual([]);
});

/** The two ways storage says a link has run out. */
const RUN_OUT: [string, () => Response][] = [
  ['403', () => new Response('', { status: 403 })],
  ['400 ExpiredToken', () => new Response(EXPIRED, { status: 400 })],
];

it.each(RUN_OUT)(
  'takes %s as a link run out: fresh links, and only what is missing goes again',
  async (_, expired) => {
    const { put, queue } = await upload((url) =>
      url === 'https://storage/first/2' ? expired() : receipted(url),
    );
    expect(api.refreshUpload).toHaveBeenCalledTimes(1);
    expect(put).toEqual([
      'https://storage/first/1',
      'https://storage/first/2',
      'https://storage/fresh/2',
      'https://storage/fresh/3',
    ]);
    expect(api.finishUpload).toHaveBeenCalledWith('session', 'm1', 'media-1', SEALED);
    expect(queue).toEqual([]);
  },
);

// A 403 that is not about time — a signature the storage will never match — must not turn into a
// loop of re-issues: one fresh set per pass, and a second refusal parks the file.
it.each(RUN_OUT)('parks the file when the fresh link gets %s too', async (_, refusal) => {
  const { put, queue } = await upload((url) => (url.endsWith('/2') ? refusal() : receipted(url)));
  expect(api.refreshUpload).toHaveBeenCalledTimes(1);
  expect(put).toEqual([
    'https://storage/first/1',
    'https://storage/first/2',
    'https://storage/fresh/2',
  ]);
  expect(api.finishUpload).not.toHaveBeenCalled();
  expect(queue.map((file) => file.error)).toEqual([{ reason: 'partNotTaken', part: 2 }]);
});

it.each<[string, () => Response, UploadFailure]>([
  [
    'a 400 with any other code',
    () => new Response('<Error><Code>InvalidArgument</Code></Error>', { status: 400 }),
    { reason: 'partRefused', part: 2, status: 400 },
  ],
  [
    'a 500',
    () => new Response('', { status: 500 }),
    { reason: 'partRefused', part: 2, status: 500 },
  ],
  ['a part taken without a receipt', () => new Response(''), { reason: 'noReceipt', part: 2 }],
])('parks the file on %s and asks for no fresh links', async (_, refusal, reason) => {
  const { put, queue } = await upload((url) => (url.endsWith('/2') ? refusal() : receipted(url)));
  expect(put).toEqual(['https://storage/first/1', 'https://storage/first/2']);
  expect(api.refreshUpload).not.toHaveBeenCalled();
  expect(api.finishUpload).not.toHaveBeenCalled();
  // Exactly the reason and nothing more: whatever storage wrote in the body stays out of the queue.
  expect(queue.map((file) => file.error)).toEqual([reason]);
});

// TASK-413: three different things all used to come out as «Cannot reach the API». Each is named
// where it happens now, and only a call to the api that got no answer is still that line.

it('names an api that never answered as the api, and sends storage nothing', async () => {
  api.startUpload.mockRejectedValue(new TypeError('Network request failed'));
  const { put, queue } = await upload(receipted);
  expect(put).toEqual([]);
  expect(queue.map((file) => file.error)).toEqual([{ reason: 'offline' }]);
  expect(console.warn).toHaveBeenCalledWith(
    'upload parks, the api does not answer:',
    expect.any(TypeError),
  );
});

/** Storage that takes the connection and never says a word — until the phone gives up on it. */
const silent: Answer = (_, signal) =>
  new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));

/** How long the pump waits on one part of this test's file before storage counts as gone quiet. */
const DEADLINE = Math.ceil(partDeadline(8));

/** The two ways storage goes quiet on a part, and how long it takes the pump to see each. */
const QUIET: [string, Answer, number][] = [
  ['a dropped connection', () => Promise.reject(new TypeError('Network request failed')), 0],
  ['no answer within the deadline', silent, DEADLINE],
];

it.each(QUIET)(
  'takes %s as storage gone quiet: fresh links, and only that part goes again',
  async (_, quiet, deadline) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { put, queue } = await upload(
      (url, signal) => (url === 'https://storage/first/2' ? quiet(url, signal) : receipted(url)),
      deadline,
    );
    expect(api.refreshUpload).toHaveBeenCalledTimes(1);
    expect(put).toEqual([
      'https://storage/first/1',
      'https://storage/first/2',
      'https://storage/fresh/2',
      'https://storage/fresh/3',
    ]);
    expect(api.finishUpload).toHaveBeenCalledWith('session', 'm1', 'media-1', SEALED);
    expect(queue).toEqual([]);
  },
);

it.each(QUIET)(
  'parks the file on %s from the fresh link too, and names storage for it',
  async (_, quiet, deadline) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { put, queue } = await upload(
      (url, signal) => (url.endsWith('/2') ? quiet(url, signal) : receipted(url)),
      deadline * 2,
    );
    expect(api.refreshUpload).toHaveBeenCalledTimes(1);
    expect(put).toEqual([
      'https://storage/first/1',
      'https://storage/first/2',
      'https://storage/fresh/2',
    ]);
    expect(api.finishUpload).not.toHaveBeenCalled();
    expect(queue.map((file) => file.error)).toEqual([{ reason: 'storageOffline', part: 2 }]);
    expect(console.warn).toHaveBeenCalledWith('part 2 does not reach storage:', expect.anything());
  },
);

it('keeps storage’s code when the line goes after storage had answered', async () => {
  // A 400 is read to the end for `ExpiredToken`, and the connection can drop in the middle of that.
  const cut = () =>
    new Response(
      new ReadableStream({ start: (body) => body.error(new TypeError('Network request failed')) }),
      { status: 400 },
    );
  const { queue } = await upload((url) => (url.endsWith('/2') ? cut() : receipted(url)));
  expect(queue.map((file) => file.error)).toEqual([
    { reason: 'storageOffline', part: 2, status: 400 },
  ]);
});

it.each<[string, (id: string) => Promise<unknown>]>([
  [
    'the gallery will not answer for it',
    async () => {
      throw new Error('Missing MEDIA_LIBRARY permissions.');
    },
  ],
  // The entry with nothing behind it and not a word about iCloud: nothing to bring down, so
  // nothing to wait for either — a file the phone genuinely cannot read (TASK-419).
  ['the gallery has the entry and no file behind it', async (id) => ({ id, uri: `ph://${id}` })],
])('names the file and not a server when %s, and asks the api nothing', async (_, answer) => {
  library.getAssetInfoAsync.mockImplementation(answer);
  const { put, queue } = await upload(receipted);
  expect(api.startUpload).not.toHaveBeenCalled();
  expect(put).toEqual([]);
  expect(queue.map((file) => file.error)).toEqual([{ reason: 'unreadable' }]);
});

it('names the file when its bytes will not come off the phone, and sends storage nothing', async () => {
  library.getAssetInfoAsync.mockImplementation(async (id: string) => ({
    id,
    uri: `ph://${id}`,
    localUri: `file:///locked/${id}`,
  }));
  const { put, queue } = await upload(receipted);
  expect(put).toEqual([]);
  expect(queue.map((file) => file.error)).toEqual([{ reason: 'unreadable' }]);
});

/**
 * TASK-419: with «Оптимизация хранения» on, the gallery holds a thumbnail and the original is in
 * iCloud. iOS says which of the two only when it is told not to fetch — so that is the first
 * question — and hands the file over on the second, once it has come down.
 */
const inCloud = async (id: string, options: { shouldDownloadFromNetwork: boolean }) =>
  options.shouldDownloadFromNetwork
    ? { id, uri: `ph://${id}`, localUri: `file:///${id}` }
    : { id, uri: `ph://${id}`, isNetworkAsset: true };

/** Whether any queue the pump wrote down said this file was coming down from iCloud. */
const saidCloud = () =>
  disk.some((written) => (JSON.parse(written) as QueuedFile[]).some((file) => file.cloud === true));

it('brings a frame down from iCloud, says so while it does, and sends it', async () => {
  library.getAssetInfoAsync.mockImplementation(inCloud);
  const { put, queue } = await upload(receipted);
  // Asked with the fetch off first — the one answer that names iCloud — and then with it on.
  expect(library.getAssetInfoAsync.mock.calls.map(([, options]) => options)).toEqual([
    { shouldDownloadFromNetwork: false },
    { shouldDownloadFromNetwork: true },
  ]);
  // Said while it was coming down, and not left on the file afterwards.
  expect(saidCloud()).toBe(true);
  expect(put).toEqual([1, 2, 3].map((n) => `https://storage/first/${n}`));
  expect(api.finishUpload).toHaveBeenCalledWith('session', 'm1', 'media-1', SEALED);
  expect(queue).toEqual([]);
});

it('names iCloud and not the phone when the frame will not come down, and asks the api nothing', async () => {
  // The fetch was allowed and the original still is not here: the download did not finish now.
  library.getAssetInfoAsync.mockImplementation(async (id: string) => ({
    id,
    uri: `ph://${id}`,
    isNetworkAsset: true,
  }));
  const { put, queue } = await upload(receipted);
  expect(api.startUpload).not.toHaveBeenCalled();
  expect(put).toEqual([]);
  expect(saidCloud()).toBe(true);
  // Parked with its own reason, and not as a file the phone could not read — the queue's pause
  // brings it round again, by which time iOS has ordinarily finished the download in the background.
  expect(queue.map((file) => file.error)).toEqual([{ reason: 'iCloud' }]);
  expect(queue.map((file) => file.cloud)).toEqual([undefined]);
});

it('still calls a file the gallery no longer has gone', async () => {
  library.getAssetInfoAsync.mockResolvedValue(null);
  const { queue } = await upload(receipted);
  expect(queue.map((file) => file.error)).toEqual([{ reason: 'gone' }]);
});

// TASK-413, the other half: a parked file blinked off and on every second or two on the phone. The
// only things that clear a reason by themselves are the pause and the app coming back to the front,
// and the second used to do it on the spot — for every pulled-down notification, every system prompt.

/** README: «по таймеру раз в 15 секунд». */
const PAUSE = 15_000;

const tries = () => library.getAssetInfoAsync.mock.calls.length;

/** Moves the clock on, and lets whatever that set going run to its end. */
async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** The app back in front, heard by both places that listen: the root and the upload screen. */
const comeBack = () =>
  act(async () => {
    for (const listener of foreground) listener('active');
  });

/** A file the pump parks at once, and without a word to the log: the gallery no longer has it. */
async function parked() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  library.getAssetInfoAsync.mockResolvedValue(null);
  await act(async () => {
    mounted(
      TestRenderer.create(
        <>
          <Pump />
          <Pump />
        </>,
      ),
    );
  });
  await act(async () => enqueue('m1', [PHOTO]));
  await wait(0);
  expect(written().map((file) => file.error)).toEqual([{ reason: 'gone' }]);
}

it('tries a parked file again only after the pause, however often the app comes back to the front', async () => {
  await parked();
  await comeBack();
  await comeBack();
  await wait(PAUSE - 1);
  await comeBack();
  expect(tries()).toBe(1);
  // Nor did the reason go off and on in the meantime: nothing cleared it.
  expect(written().map((file) => file.error)).toEqual([{ reason: 'gone' }]);
  await wait(1);
  expect(tries()).toBe(2);
});

it('stops trying by itself once pause after pause sends nothing — until the person, or the front', async () => {
  await parked();
  await wait(60 * 60_000);
  const gaveUp = tries();
  expect(gaveUp).toBeGreaterThan(1);
  expect(gaveUp).toBeLessThan((60 * 60_000) / PAUSE);
  await wait(60 * 60_000);
  expect(tries()).toBe(gaveUp);

  // Back in front, the count starts over — one pause from now, not on the spot.
  await comeBack();
  expect(tries()).toBe(gaveUp);
  await wait(PAUSE);
  expect(tries()).toBe(gaveUp + 1);

  // «Повторить» waits for nothing.
  await act(async () => wake());
  await wait(0);
  expect(tries()).toBe(gaveUp + 2);
});
