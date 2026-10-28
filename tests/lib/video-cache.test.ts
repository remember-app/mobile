import { beforeEach, expect, test, vi } from 'vitest';

/**
 * Doc-15 — a watched video is kept on the phone under its record's id, so the second opening plays
 * off the disk and needs no connection. The disk is a map here because that is all these functions
 * ask of it: a file exists, it does not, it is written or it is not.
 */
const { disk, downloadFileAsync } = vi.hoisted(() => ({
  disk: new Map<string, string>(),
  downloadFileAsync: vi.fn(),
}));

vi.mock('expo-file-system', () => {
  const at = (parts: unknown[]) =>
    parts
      .map((one) => {
        if (typeof one !== 'object' || one === null) return String(one);
        const uri = (one as { uri?: unknown }).uri;
        return typeof uri === 'string' ? uri : String(one);
      })
      .join('/');

  class Directory {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = at(parts);
    }
    get exists() {
      return true;
    }
    create() {}
  }
  class File {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = at(parts);
    }
    get exists() {
      return disk.has(this.uri);
    }
    delete() {
      disk.delete(this.uri);
    }
  }
  (File as unknown as { downloadFileAsync: typeof downloadFileAsync }).downloadFileAsync =
    downloadFileAsync;
  return { Directory, File, Paths: { cache: 'cache' } };
});

const { cachedVideo, keepVideo } = await import('@/lib/video-cache');

const UUID = '11111111-2222-3333-4444-555555555555';
const URL = 'https://r2.example/v.mp4?X-Amz-Signature=aaa';
const LOCAL = `cache/video/${UUID}.mp4`;

beforeEach(() => {
  disk.clear();
  downloadFileAsync.mockReset();
  downloadFileAsync.mockImplementation(async (_url: string, target: { uri: string }) => {
    disk.set(target.uri, 'bytes');
    return target;
  });
});

test('the first watching leaves the file under the record’s id, and answers where it is', async () => {
  expect(cachedVideo(UUID)).toBeNull();
  await expect(keepVideo(UUID, URL)).resolves.toBe(LOCAL);
  expect(downloadFileAsync).toHaveBeenCalledTimes(1);
  expect(downloadFileAsync.mock.calls[0][0]).toBe(URL);
  // The file is named by the record, not by the signed link: a fresh signature is the same file.
  expect((downloadFileAsync.mock.calls[0][1] as { uri: string }).uri).toBe(LOCAL);
  // `idempotent`, so two openings racing over one file share the first download.
  expect(downloadFileAsync.mock.calls[0][2]).toEqual({ idempotent: true });
  expect(cachedVideo(UUID)).toBe(LOCAL);
});

test('opening it again reads the disk and does not go to the network', async () => {
  await keepVideo(UUID, URL);
  expect(cachedVideo(UUID)).toBe(LOCAL);

  // The second opening, and a third, and one under a link signed afresh — the file is already there
  // and nothing is downloaded for any of them. This is also the offline case: the link could not be
  // reached and the local file is all the player needs.
  await expect(keepVideo(UUID, URL)).resolves.toBe(LOCAL);
  await expect(keepVideo(UUID, `${URL}&again`)).resolves.toBe(LOCAL);
  expect(downloadFileAsync).toHaveBeenCalledTimes(1);
});

test('a failed download is the signed stream’s problem, not the play’s — the caller keeps its link', async () => {
  downloadFileAsync.mockRejectedValue(new Error('no connection'));
  await expect(keepVideo(UUID, URL)).resolves.toBeNull();
  expect(cachedVideo(UUID)).toBeNull();
});

test('an id that is not a uuid names no file at all, and is never downloaded', async () => {
  for (const id of ['../../etc/passwd', 'a/b', '']) {
    expect(cachedVideo(id)).toBeNull();
    await expect(keepVideo(id, URL)).resolves.toBeNull();
  }
  expect(downloadFileAsync).not.toHaveBeenCalled();
});
