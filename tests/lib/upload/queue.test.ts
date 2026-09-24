import { describe, expect, it } from 'vitest';
import {
  failureText,
  missingParts,
  progress,
  type QueuedFile,
  type UploadFailure,
  uploadedParts,
} from '@/lib/upload/queue';
import { en, ru } from '@/strings';

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

/**
 * The bug behind this (TASK-93): the queue used to hold the finished sentence, worded at the moment
 * the upload broke and then kept on disk. Switch the language, or open the app in the other one,
 * and the banner sat there in the language of an upload that failed an hour ago. What is kept now
 * is the reason, and the words come from here — so the same failure has to answer in whichever
 * language it is asked in.
 */
describe('failureText', () => {
  const NAME = 'IMG_0001.HEIC';

  /** One of every way the pump parks a file, and the two answers the api gets worded by. */
  const every: UploadFailure[] = [
    { reason: 'gone' },
    { reason: 'partSizeChanged' },
    { reason: 'noReceipt', part: 2 },
    { reason: 'noLink', part: 2 },
    { reason: 'partNotTaken', part: 2 },
    { reason: 'partRefused', part: 2, status: 503 },
    { reason: 'offline' },
    { reason: 'api', status: 429 },
    { reason: 'api', status: 500 },
  ];

  it('says every reason in the language it is asked in', () => {
    for (const failure of every) {
      expect(failureText(ru, failure, NAME)).not.toBe(failureText(en, failure, NAME));
    }
  });

  it('names the file the phone no longer has', () => {
    expect(failureText(en, { reason: 'gone' }, NAME)).toBe(`${NAME} is no longer on this phone.`);
    expect(failureText(ru, { reason: 'gone' }, NAME)).toBe(`${NAME} больше нет на этом телефоне.`);
  });

  // The one reason nothing here translates: the api wrote it, and this side only carries it.
  it('hands the api’s own sentence on as it came', () => {
    const refused: UploadFailure = { reason: 'api', status: 403, said: 'Memory is closed' };
    expect(failureText(ru, refused, NAME)).toBe('Memory is closed');
    expect(failureText(en, refused, NAME)).toBe('Memory is closed');
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
    expect(progress(file({ size: 8 * MB, partSize: 8 * MB, parts: { 1: '"a"', 2: '"b"' } }))).toBe(
      1,
    );
  });
});
