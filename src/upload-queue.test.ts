import { describe, expect, it } from 'vitest';

import { missingParts, progress, uploadedParts, type QueuedFile } from '@/upload-queue';

const MB = 1024 * 1024;

describe('missingParts', () => {
  it('cuts the file into whole parts and a remainder', () => {
    expect(missingParts(20 * MB, 8 * MB, {})).toEqual([
      { number: 1, start: 0, length: 8 * MB },
      { number: 2, start: 8 * MB, length: 8 * MB },
      { number: 3, start: 16 * MB, length: 4 * MB },
    ]);
  });

  it('leaves a file smaller than one part in a single slice', () => {
    expect(missingParts(1000, 8 * MB, {})).toEqual([{ number: 1, start: 0, length: 1000 }]);
  });

  // The resume, and the one thing that must never regress: what R2 already took is not sent again.
  it('skips the parts R2 has answered for and keeps the rest at their own offsets', () => {
    expect(missingParts(20 * MB, 8 * MB, { 1: '"a"', 3: '"c"' })).toEqual([
      { number: 2, start: 8 * MB, length: 8 * MB },
    ]);
  });

  it('has nothing left once every part is in', () => {
    expect(missingParts(20 * MB, 8 * MB, { 1: '"a"', 2: '"b"', 3: '"c"' })).toEqual([]);
  });
});

describe('uploadedParts', () => {
  it('reports the parts in ascending number order, not in key order', () => {
    expect(uploadedParts({ 10: '"j"', 9: '"i"', 1: '"a"' })).toEqual([
      { part_number: 1, etag: '"a"' },
      { part_number: 9, etag: '"i"' },
      { part_number: 10, etag: '"j"' },
    ]);
  });
});

describe('progress', () => {
  const file = (over: Partial<QueuedFile>): QueuedFile => ({
    assetId: 'a',
    memoryId: 'm',
    filename: 'IMG_0001.HEIC',
    kind: 'photo',
    capturedAt: null,
    durationSeconds: null,
    parts: {},
    ...over,
  });

  it('is nought until the api has sized the file', () => {
    expect(progress(file({}))).toBe(0);
  });

  it('counts the parts that are in', () => {
    expect(progress(file({ size: 20 * MB, partSize: 8 * MB, parts: { 1: '"a"', 2: '"b"' } }))).toBe(
      2 / 3,
    );
  });

  it('never goes past whole', () => {
    expect(
      progress(file({ size: 8 * MB, partSize: 8 * MB, parts: { 1: '"a"', 2: '"b"' } })),
    ).toBe(1);
  });
});
