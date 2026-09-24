import { afterEach, expect, test, vi } from 'vitest';

// The expo modules touch native code that does not exist under vitest, so the module under test
// cannot be imported without replacing them first. `vi.hoisted` is what lets the mock factories
// below (which vitest hoists above these imports) reach back into variables the tests also use.
const {
  downloadFileAsync,
  deleteMock,
  requestPermissionsAsync,
  saveToLibraryAsync,
  shareAsync,
  events,
} = vi.hoisted(() => ({
  downloadFileAsync: vi.fn(),
  deleteMock: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  saveToLibraryAsync: vi.fn(),
  shareAsync: vi.fn(),
  events: [] as string[],
}));

vi.mock('expo-file-system', () => {
  class File {
    parts: unknown[];
    constructor(...parts: unknown[]) {
      this.parts = parts;
    }
    delete() {
      deleteMock();
    }
  }
  (File as unknown as { downloadFileAsync: typeof downloadFileAsync }).downloadFileAsync =
    downloadFileAsync;
  return { File, Paths: { cache: 'CACHE' } };
});

vi.mock('expo-media-library/legacy', () => ({ requestPermissionsAsync, saveToLibraryAsync }));

// The phone's own share sheet. Only the one call is wanted here.
vi.mock('expo-sharing', () => ({ shareAsync }));

const { maySaveToPhone, saveToPhone, shareFile } = await import('@/downloads');

const UUID = '11111111-2222-3333-4444-555555555555';

afterEach(() => {
  vi.clearAllMocks();
  events.length = 0;
});

test('maySaveToPhone reports the one permission it asks for, granted for adding not reading', async () => {
  requestPermissionsAsync.mockResolvedValue({ granted: true });
  await expect(maySaveToPhone()).resolves.toBe(true);
  expect(requestPermissionsAsync).toHaveBeenCalledWith(true);
});

test('names the cached file after the record id when it is a uuid', async () => {
  downloadFileAsync.mockResolvedValue({ uri: 'file://cache/x.mp4' });
  await saveToPhone({ id: UUID, kind: 'video', url: 'https://example/x' });
  const target = downloadFileAsync.mock.calls[0][1] as { parts: unknown[] };
  expect(target.parts).toEqual(['CACHE', `${UUID}.mp4`]);
});

test('falls back to a plain name for an id that is not a uuid, so a crafted id cannot write outside the cache', async () => {
  downloadFileAsync.mockResolvedValue({ uri: 'file://cache/x.jpg' });
  await saveToPhone({ id: '../../etc/passwd', kind: 'photo', url: 'https://example/x' });
  const target = downloadFileAsync.mock.calls[0][1] as { parts: unknown[] };
  expect(target.parts).toEqual(['CACHE', 'download.jpg']);
});

test('runs andThen on the cached copy before deleting it', async () => {
  downloadFileAsync.mockResolvedValue({ uri: 'file://cache/a.mp4' });
  saveToLibraryAsync.mockImplementation(async () => events.push('library'));
  deleteMock.mockImplementation(() => events.push('delete'));
  const andThen = vi.fn(async (uri: string) => {
    events.push(`andThen:${uri}`);
  });

  await saveToPhone({ id: UUID, kind: 'video', url: 'https://example/x' }, andThen);

  expect(events).toEqual(['library', 'andThen:file://cache/a.mp4', 'delete']);
});

test('deletes the cached copy even when saving to the library fails, and still surfaces that error', async () => {
  downloadFileAsync.mockResolvedValue({ uri: 'file://cache/a.mp4' });
  saveToLibraryAsync.mockRejectedValue(new Error('disk full'));

  await expect(
    saveToPhone({ id: UUID, kind: 'video', url: 'https://example/x' }),
  ).rejects.toThrow('disk full');
  expect(deleteMock).toHaveBeenCalledTimes(1);
});

test('a frame handed on goes out as the local copy, and the phone’s gallery is left alone', async () => {
  // The signed link is never what goes out: it dies in a quarter of an hour, so whoever it reached
  // would get a refusal instead of a photograph. And sharing is not keeping — nothing is written to
  // the phone's own gallery, so nothing here asks for that permission either.
  downloadFileAsync.mockResolvedValue({ uri: 'file://cache/a.jpg' });
  shareAsync.mockImplementation(async () => events.push('share'));
  deleteMock.mockImplementation(() => events.push('delete'));

  await shareFile({ id: UUID, kind: 'photo', url: 'https://example/x' });

  expect(shareAsync).toHaveBeenCalledWith('file://cache/a.jpg');
  expect(events).toEqual(['share', 'delete']);
  expect(saveToLibraryAsync).not.toHaveBeenCalled();
  expect(requestPermissionsAsync).not.toHaveBeenCalled();
});

test('a share sheet that would not open is not a failure, is logged, and still sweeps the copy', async () => {
  // Nothing under the frame the person is looking at is theirs to fix, so the screen carries on —
  // but the reason is said where a developer reads it instead of vanishing.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  downloadFileAsync.mockResolvedValue({ uri: 'file://cache/a.jpg' });
  shareAsync.mockRejectedValue(new Error('no sheet'));

  await expect(
    shareFile({ id: UUID, kind: 'photo', url: 'https://example/x' }),
  ).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalledWith('share sheet skipped:', expect.any(Error));
  expect(deleteMock).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});

test('a delete that throws does not turn a save that already worked into a failure', async () => {
  downloadFileAsync.mockResolvedValue({ uri: 'file://cache/a.mp4' });
  saveToLibraryAsync.mockResolvedValue(undefined);
  deleteMock.mockImplementation(() => {
    throw new Error('already swept');
  });

  await expect(
    saveToPhone({ id: UUID, kind: 'video', url: 'https://example/x' }),
  ).resolves.toBeUndefined();
});
