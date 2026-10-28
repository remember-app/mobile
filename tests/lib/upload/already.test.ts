import { photo } from '@tests/helpers/api';
import type { Asset } from 'expo-media-library/legacy';
import { beforeEach, expect, test, vi } from 'vitest';
import { alreadyThere, mayBeSame } from '@/lib/upload/already';

const { library, sizes } = vi.hoisted(() => ({
  library: { getAssetInfoAsync: vi.fn() },
  sizes: new Map<string, number>(),
}));

vi.mock('expo-media-library/legacy', () => library);
// The disk as far as this check reads it: a path to a file that either has a size or is not there.
vi.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return sizes.has(this.uri);
    }
    get size() {
      return sizes.get(this.uri) ?? 0;
    }
  },
}));

const shot = new Date(2026, 8, 13, 20).getTime();
const asset = (over: Partial<Asset> = {}): Asset => ({
  id: 'a1',
  uri: 'ph://a1',
  filename: 'IMG_a1.HEIC',
  mediaType: 'photo',
  creationTime: shot,
  modificationTime: shot,
  duration: 0,
  width: 4032,
  height: 3024,
  ...over,
});

const at = new Date(shot).toISOString();

beforeEach(() => {
  sizes.clear();
  library.getAssetInfoAsync.mockReset();
  library.getAssetInfoAsync.mockImplementation(async (one: Asset) => ({
    ...one,
    localUri: `file:///photos/${one.id}`,
  }));
});

test('the same kind, shot at the same instant: a size or a measurement the record has is a refinement, not a requirement', () => {
  expect(mayBeSame(asset(), photo('r', 'me', at))).toBe(true);
  // A record the worker has not measured yet says nothing about its dimensions — it cannot disagree.
  expect(mayBeSame(asset(), photo('r', 'me', at, { width: 1, height: 2 }))).toBe(false);
  expect(mayBeSame(asset(), photo('r', 'me', at, { width: 4032, height: 3024 }))).toBe(true);
  expect(mayBeSame(asset(), photo('r', 'me', at, { kind: 'video', duration_seconds: 5 }))).toBe(
    false,
  );
  expect(mayBeSame(asset(), photo('r', 'me', at, { captured_at: null }))).toBe(false);
  // A second apart is another frame; a rounding of the worker's is not.
  expect(mayBeSame(asset(), photo('r', 'me', new Date(shot + 1000).toISOString()))).toBe(false);
  expect(
    mayBeSame(
      asset({ mediaType: 'video', duration: 42 }),
      photo('r', 'me', at, { kind: 'video', duration_seconds: 42.4 }),
    ),
  ).toBe(true);
});

test('the size proves it where the phone can tell, and a different one rules the pair out', async () => {
  const record = photo('r', 'me', at, { size_bytes: '4000000' });
  sizes.set('file:///photos/a1', 4000000);
  expect([...(await alreadyThere([asset()], [record]))]).toEqual(['a1']);

  sizes.set('file:///photos/a1', 4000001);
  expect(await alreadyThere([asset()], [record])).toEqual(new Set());

  // An original still in iCloud has no local file to measure: the other fields are what is left.
  sizes.clear();
  expect([...(await alreadyThere([asset()], [record]))]).toEqual(['a1']);
});

test('a record with no date is never the same file, and a file this person never gave is not either', async () => {
  expect(await alreadyThere([asset()], [photo('r', 'me', at, { captured_at: null })])).toEqual(
    new Set(),
  );
  expect(await alreadyThere([asset()], [])).toEqual(new Set());
  expect(await alreadyThere([asset()], [photo('r', 'me', at, { kind: 'video' })])).toEqual(
    new Set(),
  );
});
