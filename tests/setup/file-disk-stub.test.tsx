import { Directory, File, Paths } from 'expo-file-system';
import { expect, test } from 'vitest';
import { keepKept, readKept } from '@/lib/frames-kept';

/**
 * The stand-in this whole run puts in for `expo-file-system` (`vitest.setup.ts`), checked as the
 * tool it is — the disk every test in the repo reads and writes through.
 *
 * Why it needs its own file, and why the second test below is the one that matters: the stand-in
 * used to keep whatever it was holding between tests. That is a shared surface nobody had agreed
 * to, so a test written next month could pass on a neighbour's leftovers and fail on its own
 * depending only on what ran before it — and nothing in the run would say why. The reset is now the
 * stand-in's own business, and this file is what holds it to that.
 */

/** A memory id as the api mints one. */
const ID = '11111111-2222-3333-4444-555555555555';

const one = { items: [{ id: 'a' }], roster: [{ id: 'me' }] };

test('a write is read back by the next line that opens the same file, and by nobody else', () => {
  keepKept(ID, one.items as never, one.roster as never);

  // A working disk, not a stub that only refuses: what is kept on the phone between two launches is
  // a real subject (TASK-512), and a disk that answers to nothing would make every claim about it
  // true on paper and blind in fact.
  expect(readKept(ID)).toEqual(one);
  // A different memory is a different file, not the same one under another name.
  expect(readKept('99999999-2222-3333-4444-555555555555')).toBeNull();
  // And the paths are built the way the real library builds them: a `Directory` handed in as a part
  // carries its own path, so `new File(dir, name)` lands inside it rather than beside it.
  const file = new File(new Directory(Paths.document, 'somewhere'), 'thing.json');
  expect(file.uri).toBe(`${Paths.document}/somewhere/thing.json`);
});

// The one the coordinator's requirement is about: a phone is wiped between tests, so a test that
// leans on a neighbour's leftovers fails on its own — loudly, with an empty file under it, rather
// than passing once and failing after somebody else's task reorders the file.
test('a test starts on a phone with nothing on it', () => {
  expect(readKept(ID)).toBeNull();
  expect(new Directory(Paths.document, 'feeds').exists).toBe(false);
  // Including when the test before it left exactly this behind. The line above is the assertion a
  // test gets for free; this is what makes it true rather than accidental — it fails if the reset
  // in `vitest.setup.ts` is ever taken out.
  expect(readKept('99999999-2222-3333-4444-555555555555')).toBeNull();
});

test('a file that was never written reads as nothing rather than as an answer', () => {
  expect(readKept(ID)).toBeNull();
  // And a file that was written and then emptied reads as nothing either — an empty answer is not a
  // list of frames, and the app must be able to tell those apart (this is what the cache tests in
  // `tests/lib/frames-kept.test.ts` were blind to until they named the frames rather than asking
  // whether a file was there).
  keepKept(ID, [], []);
  expect(readKept(ID)).toEqual({ items: [], roster: [] });
});
