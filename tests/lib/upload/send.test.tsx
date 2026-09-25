import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { Asset } from 'expo-media-library/legacy';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { UploadPlan } from '@/api';
import type { QueuedFile, UploadFailure } from '@/lib/upload/queue';
import { drop, enqueue, useUploads } from '@/lib/upload/send';

const { api, disk } = vi.hoisted(() => ({
  api: { startUpload: vi.fn(), refreshUpload: vi.fn(), finishUpload: vi.fn() },
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
vi.mock('expo-media-library/legacy', () => ({
  getAssetInfoAsync: async (id: string) => ({ id, uri: `ph://${id}`, localUri: `file:///${id}` }),
}));
// Twenty bytes at eight to a part is three parts: one before and one after the part a case is about.
// The queue's own file is the same class, and keeps what it is handed.
vi.mock('expo-file-system', () => ({
  Paths: { document: 'documents' },
  File: class {
    exists = true;
    size = 20;
    textSync = () => '[]';
    write = (text: string) => disk.push(text);
    open = () => ({ offset: 0, readBytes: (length: number) => new Uint8Array(length), close() {} });
  },
}));
// Off a phone `react-native-web` hands out no subscription at all, and the hook removes its own.
vi.mock('react-native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-native')>()),
  AppState: { addEventListener: () => ({ remove() {} }) },
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

/**
 * One photo through the pump, storage answering each part with `answer`. Done when the pump is: the
 * file sealed and gone from the queue, or parked in it with a reason.
 */
async function upload(answer: (url: string) => Response) {
  const put: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    put.push(url);
    return answer(url);
  });
  await act(async () => {
    mounted(TestRenderer.create(<Pump />));
  });
  await act(async () => {
    enqueue('m1', [PHOTO]);
    await vi.waitFor(() => expect(written().every((file) => file.error !== undefined)).toBe(true));
  });
  return { put, queue: written() };
}

beforeEach(() => {
  api.startUpload.mockResolvedValue(plan('first'));
  api.refreshUpload.mockResolvedValue(plan('fresh'));
  api.finishUpload.mockResolvedValue({ id: 'media-1', status: 'processing', first_upload: false });
});

afterEach(async () => {
  await act(async () => drop('m1', PHOTO.id));
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

it.each([
  ['403', () => new Response('', { status: 403 })],
  ['400 ExpiredToken', () => new Response(EXPIRED, { status: 400 })],
])(
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
