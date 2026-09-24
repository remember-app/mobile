import { beforeEach, expect, test, vi } from 'vitest';

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
  shareFolder,
} = vi.hoisted(() => ({
  downloadFileAsync: vi.fn(),
  deleteMock: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  saveToLibraryAsync: vi.fn(),
  shareAsync: vi.fn(),
  // What happened, in the order it happened: the tests here are about that order.
  events: [] as string[],
  // Whether the folder for the share copies is on the phone yet.
  shareFolder: { exists: false },
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
  class Directory {
    parts: unknown[];
    constructor(...parts: unknown[]) {
      this.parts = parts;
    }
    get exists() {
      return shareFolder.exists;
    }
    delete() {
      events.push('wipe');
    }
    create() {
      events.push('create');
    }
  }
  return { File, Directory, Paths: { cache: 'CACHE' } };
});

vi.mock('expo-media-library/legacy', () => ({ requestPermissionsAsync, saveToLibraryAsync }));

// The phone's own share sheet. Only the one call is wanted here.
vi.mock('expo-sharing', () => ({ shareAsync }));

const { maySaveToPhone, saveAndShare, saveToPhone, shareFile, shareFiles } = await import(
  '@/downloads'
);

const UUID = '11111111-2222-3333-4444-555555555555';
const OTHER = '66666666-7777-8888-9999-000000000000';
const frame = { id: UUID, kind: 'photo', url: 'https://example/x' } as const;
const second = { id: OTHER, kind: 'photo', url: 'https://example/y' } as const;
const film = { id: UUID, kind: 'video', url: 'https://example/x' } as const;

beforeEach(() => {
  vi.resetAllMocks();
  events.length = 0;
  shareFolder.exists = false;
  downloadFileAsync.mockImplementation(async () => {
    events.push('download');
    return { uri: 'file://cache/copy' };
  });
  saveToLibraryAsync.mockImplementation(async () => events.push('library'));
  shareAsync.mockImplementation(async () => events.push('share'));
  deleteMock.mockImplementation(() => events.push('delete'));
});

test('maySaveToPhone reports the one permission it asks for, granted for adding not reading', async () => {
  requestPermissionsAsync.mockResolvedValue({ granted: true });
  await expect(maySaveToPhone()).resolves.toBe(true);
  expect(requestPermissionsAsync).toHaveBeenCalledWith(true);
});

test('names the cached file after the record id when it is a uuid', async () => {
  await saveToPhone(film);
  const target = downloadFileAsync.mock.calls[0][1] as { parts: unknown[] };
  expect(target.parts).toEqual(['CACHE', `${UUID}.mp4`]);
});

test('falls back to a plain name for an id that is not a uuid, so a crafted id cannot write outside the cache', async () => {
  await saveToPhone({ id: '../../etc/passwd', kind: 'photo', url: 'https://example/x' });
  const target = downloadFileAsync.mock.calls[0][1] as { parts: unknown[] };
  expect(target.parts).toEqual(['CACHE', 'download.jpg']);
});

test('the cached copy goes once the gallery has taken it', async () => {
  await saveToPhone(film);
  expect(events).toEqual(['download', 'library', 'delete']);
});

test('deletes the cached copy even when saving to the library fails, and still surfaces that error', async () => {
  saveToLibraryAsync.mockRejectedValue(new Error('disk full'));

  await expect(saveToPhone(film)).rejects.toThrow('disk full');
  expect(deleteMock).toHaveBeenCalledTimes(1);
});

test('a delete that throws does not turn a save that already worked into a failure', async () => {
  deleteMock.mockImplementation(() => {
    throw new Error('already swept');
  });

  await expect(saveToPhone(film)).resolves.toBeUndefined();
});

test('a frame handed on goes out as a local copy in the share folder, and the phone’s gallery is left alone', async () => {
  // The signed link is never what goes out: it dies in a quarter of an hour, so whoever it reached
  // would get a refusal instead of a photograph. And sharing is not keeping — nothing is written to
  // the phone's own gallery, so nothing here asks for that permission either.
  await shareFile(frame);

  const [url, target] = downloadFileAsync.mock.calls[0] as [string, { parts: unknown[] }];
  expect(url).toBe('https://example/x');
  const [folder, name] = target.parts as [{ parts: unknown[] }, string];
  expect(folder.parts).toEqual(['CACHE', 'shared']);
  expect(name).toBe(`${UUID}.jpg`);
  expect(shareAsync).toHaveBeenCalledWith('file://cache/copy');
  expect(saveToLibraryAsync).not.toHaveBeenCalled();
  expect(requestPermissionsAsync).not.toHaveBeenCalled();
});

test('the copy is still there when the sheet answers, and nothing deletes it later', async () => {
  // An answered sheet does not say the app it went to has read the file — so the copy stays for
  // that app, and is swept by the next share instead (below), never by the sheet's own answer.
  await shareFile(frame);
  expect(events).toEqual(['create', 'download', 'share']);
  expect(deleteMock).not.toHaveBeenCalled();
});

test('what an earlier share left is wiped before the next copy comes down', async () => {
  shareFolder.exists = true;
  await shareFile(frame);
  expect(events).toEqual(['wipe', 'create', 'download', 'share']);
});

test('all the files of one share are wiped for once, before the first and never between them', async () => {
  // The first file's copy is still being read by the app it was handed to while the second sheet
  // is coming up, so the second must not take it away.
  shareFolder.exists = true;
  await shareFiles([frame, second]);
  expect(events).toEqual(['wipe', 'create', 'download', 'share', 'download', 'share']);
});

test('leaving the screen breaks the chain of sheets after the one that is up', async () => {
  let asked = 0;
  await shareFiles([frame, second], () => ++asked === 1);
  expect(events).toEqual(['create', 'download', 'share']);
});

test('a share sheet that would not open is not a failure, is logged, and the copy stays', async () => {
  // Nothing under the frame the person is looking at is theirs to fix, so the screen carries on —
  // but the reason is said where a developer reads it instead of vanishing.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  shareAsync.mockRejectedValue(new Error('no sheet'));

  await expect(shareFile(frame)).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalledWith('share sheet skipped:', expect.any(Error));
  expect(deleteMock).not.toHaveBeenCalled();
  warn.mockRestore();
});

test('the film kept and handed on comes down once: the gallery first, then the sheet, from one copy', async () => {
  await saveAndShare(film);

  expect(downloadFileAsync).toHaveBeenCalledTimes(1);
  expect(events).toEqual(['create', 'download', 'library', 'share']);
  expect(saveToLibraryAsync).toHaveBeenCalledWith('file://cache/copy');
  expect(shareAsync).toHaveBeenCalledWith('file://cache/copy');
  expect(deleteMock).not.toHaveBeenCalled();
});

test('a film that could not be kept is not handed on', async () => {
  saveToLibraryAsync.mockRejectedValue(new Error('disk full'));

  await expect(saveAndShare(film)).rejects.toThrow('disk full');
  expect(shareAsync).not.toHaveBeenCalled();
});
