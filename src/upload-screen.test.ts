import { expect, test } from 'vitest';

import upload from './app/memory/[id]/upload.tsx?raw';

/**
 * The bug review just fixed: the camera roll arrives 500 assets at a time (`do…while` over
 * `getAssetsAsync`), and «Выбрать все N» for a day was pressable while later pages were still
 * landing — a day that straddles a page boundary looked whole (the button already named its final
 * count, since `assetsByDay` re-buckets whatever has arrived so far) but a tap only picked the
 * assets already in state, silently dropping the tail. The fix is `disabled={reading}`, and what
 * makes it correct is that `reading` spans every page of the do-while, not just the first one —
 * read as text, the way `login-screen.test.ts` gives at length: this is an `expo-router` screen
 * wired to a native gallery module, and there is no renderer for one here.
 */

test('«выбрать все N» for a day is out while any page of the roll is still arriving', () => {
  const button = upload.slice(upload.indexOf('label={s.upload.selectDay'), upload.indexOf('onPress={() => pickDay'));
  expect(button).toContain('disabled={reading}');
});

test('reading spans every page of the roll, not just the first', () => {
  // `setReading(true)` stands before the loop starts...
  const before = upload.slice(0, upload.indexOf('do {'));
  expect(before).toContain('setReading(true);');
  // ...and `setReading(false)` only after the loop that pages through `hasNextPage` has run its
  // course — in the `finally`, which the `do…while` above it reaches whether it finishes or throws.
  const loopEnd = upload.indexOf('} while (after !== undefined);');
  const finallyBlock = upload.slice(loopEnd, upload.indexOf('}, [granted, rereads]);'));
  expect(finallyBlock).toContain('finally {');
  expect(finallyBlock).toContain('setReading(false);');
  // Never inside the loop itself — that would flip it back on after the first page, which is
  // exactly the state the button's guard exists to rule out.
  const loopBody = upload.slice(upload.indexOf('do {'), loopEnd);
  expect(loopBody).not.toContain('setReading(false)');
});
