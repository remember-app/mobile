import { beforeEach, expect, test, vi } from 'vitest';

/**
 * The phone's disk, watched. The stand-in in `vitest.setup.ts` works and hands its map away to
 * nobody, so this file brings a map of its own: what the app wrote to it is the whole of what is
 * being claimed here, and a test that could only ask the app whether it thinks it wrote something
 * would pass on a write that went nowhere.
 */
const disk = vi.hoisted(() => ({
  files: new Map<string, string>(),
  folders: new Set<string>(),
}));
vi.mock('expo-file-system', () => {
  // A `Directory` handed in as a part carries its own path — `new File(dir, name)` is how every
  // caller in this repo writes, so reading it as a string would put every file outside its folder.
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
      return disk.folders.has(this.uri);
    }
    create() {
      disk.folders.add(this.uri);
    }
    delete() {
      // What a directory delete really does, and the half this file exists to check: a stand-in
      // that dropped the folder and left the files inside it would report a session gone while
      // every photograph stayed exactly where it was.
      for (const key of [...disk.files.keys()])
        if (key.startsWith(`${this.uri}/`)) disk.files.delete(key);
      disk.folders.delete(this.uri);
    }
  }
  class File {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = at(parts);
    }
    get exists() {
      return disk.files.has(this.uri);
    }
    create() {
      disk.files.set(this.uri, '');
    }
    textSync() {
      const held = disk.files.get(this.uri);
      if (held === undefined) throw new Error('no such file');
      return held;
    }
    write(content: string) {
      disk.files.set(this.uri, content);
    }
  }
  return { Directory, File, Paths: { document: 'documents' } };
});

import { member, photo } from '@tests/helpers/api';
import type { MediaItem, Member } from '@/api';
import { forgetKept, keepKept, readKept } from '@/lib/frames-kept';

/**
 * What a memory's feed leaves on the phone (TASK-512, part 2). How it goes, and what takes it away
 * again, is `tests/lib/frames-kept-session.test.tsx` — that one mounts the gate to reach `forget()`,
 * which is where the session actually ends.
 *
 * Two questions are kept apart on purpose, because they break apart: *was the cache read* (the file
 * was opened and answered) and *was it shown* (the answer reached a screen). A test that watched
 * only the file would be green over a screen drawing nothing, and the other way round. The screen
 * half is `tests/screens/memory/frames-kept-flow.test.tsx`.
 */

/** A memory id as the api mints one — the store keeps nothing under anything else, by design. */
const ID = '11111111-2222-3333-4444-555555555555';

const at = new Date(2026, 8, 13, 10).toISOString();
const frames = (): MediaItem[] => [
  photo('a', 'me', at),
  photo('b', 'liza', at, { kind: 'video', duration_seconds: 12 }),
];
const people = (): Member[] => [member('me', 'organizer'), member('liza', 'contributor')];

/** The file one memory's feed is written to, or null where nothing was written for it. */
const onDisk = (memoryId = ID): unknown => {
  const held = disk.files.get(`documents/feeds/${memoryId}.json`);
  return held === undefined ? null : JSON.parse(held);
};

beforeEach(() => {
  disk.files.clear();
  disk.folders.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

test('the feed is written as it came back, and read back whole', () => {
  keepKept(ID, frames(), people());

  // Written and read back: this is the whole of the cache, and it is the same list.
  expect(onDisk()).toEqual({ items: frames(), roster: people() });
  expect(readKept(ID)).toEqual({ items: frames(), roster: people() });
  // The two lists are not one object handed about — a second launch parses its own copy out of the
  // file, which is what "survives a restart" means, and is why the roster is kept beside the frames
  // and not read again on the way in.
  expect(readKept(ID)!.items).not.toBe(frames());
});

test('a memory this phone kept nothing for is nothing, and not a failure', () => {
  expect(readKept(ID)).toBeNull();
  // And a name that is not a memory id is not written at all: it comes off a deep link, and a `..`
  // in it would put the file outside the folder `forgetKept` takes.
  keepKept('../../escaped', frames(), people());
  expect(readKept('../../escaped')).toBeNull();
  expect([...disk.files.keys()]).toEqual([]);
});

// The rule as the human set it (decision-23): a hidden frame is not cleaned out of the cache
// afterwards, it never gets in. Anything else would leave a frame its owner took out of the shared
// feed sitting in a file the next launch draws from without asking.
test('a frame its owner hid is not written at all', () => {
  keepKept(ID, [...frames(), photo('hush', 'me', at, { hidden: true })], people());

  const kept = onDisk() as { items: MediaItem[] };
  expect(kept.items.map((one) => one.id)).toEqual(['a', 'b']);
  expect(JSON.stringify(kept)).not.toContain('hush');
  // And it is the writing that filters, not a sweep afterwards: the answer went in whole and the
  // hidden one did not come out.
  expect(readKept(ID)!.items.map((one) => one.id)).toEqual(['a', 'b']);
});

test('a file that will not read is no answer rather than a broken screen', () => {
  // What a phone running a build from before this one leaves behind: a file of another shape, or
  // nothing readable at all. Both are a feed the api answers, which is where it stood before.
  disk.files.set(`documents/feeds/${ID}.json`, '{"items": "nope"}');
  expect(readKept(ID)).toBeNull();
  disk.files.set(`documents/feeds/${ID}.json`, 'not json at all');
  expect(readKept(ID)).toBeNull();
});

// The one that matters most — the list dies with the session — is in the session file beside it.
test('forgetting takes every memory at once', () => {
  const other = '99999999-2222-3333-4444-555555555555';
  keepKept(ID, frames(), people());
  keepKept(other, frames(), people());

  forgetKept();

  expect(readKept(ID)).toBeNull();
  expect(readKept(other)).toBeNull();
  // The folder itself is gone too — nothing is left that names a session that has ended.
  expect(disk.folders.has('documents/feeds')).toBe(false);
  expect(disk.files.size).toBe(0);
});
