import { expect, test } from 'vitest';

import upload from './app/memory/[id]/upload.tsx?raw';
import uploads from './uploads.ts?raw';

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

/**
 * The screen rebuilt to the layout (TASK-146). Its five faces are one file and differ only in what
 * the body holds, so what is worth pinning is the three switches between them — read as text, for
 * the reason above.
 */

test('«Это всё?» waits until everything this visit sent is actually in', () => {
  // The api decides whether to ask at all (`first_upload`), this decides when: the layout has the
  // sending block give way to the sheet, so a sheet counting «12 файлов ушли» while nine are still
  // going would be contradicting the bar right behind it.
  expect(upload).toContain("const asking = useAskAll() === id && sent > 0 && queued.length === 0;");
  // The count is what this visit handed over, counted where it is handed over.
  expect(upload).toContain('setSent((n) => n + chosen.length);');
  expect(upload).toContain('{s.upload.sentToMemory(sent)}');
  // Both answers close the question; only «Больше ничего» moves a standing, because the first
  // upload already left them on «планирует загрузить» (doc-06).
  expect(uploads).toContain('if (!all || memoryId === null || session === null) return;');
  expect(uploads).toContain("setContributionStatus(session, memoryId, 'done')");
  // And the question is a sheet on the screen now, never a system dialog raised from the queue.
  expect(uploads).not.toContain('Alert');
});

test('the bottom layer stands only while something is picked', () => {
  // `UploadQueue` and `UploadEmpty` are drawn without one at all — there is nothing to send and
  // nothing to clear, so the layout puts no dead button under either.
  expect(upload).toContain('{picked.size > 0 ? (\n        <ActionBar');
  expect(upload).toContain('label={s.upload.send(picked.size)}');
  // The one glowing button of the screen, and it never says «Отправить 0 файлов».
  expect(upload).not.toContain('disabled={picked.size === 0}');
});

test('a partial grant counts the day instead of offering to select all of it', () => {
  // `UploadLimited`: «Выбрать все» is gone because there is nothing to select all of, the count is
  // drawn back (`limited`) because the rest is unseen rather than missing, and the plate under the
  // strip says so in words.
  const daymark = upload.slice(upload.indexOf('<DayMark'), upload.indexOf('</DayMark>'));
  expect(daymark).toContain('count={limited ? s.memory.frames(row.day.assets.length) : undefined}');
  expect(daymark).toContain('limited={limited}');
  expect(daymark).toContain('{limited ? null : (');
  expect(upload).toContain('...(limited ? [{ key: `unseen-${day.at}`, unseen: true as const }] : []),');
  expect(upload).toContain('{s.upload.restUnseen}');
});
