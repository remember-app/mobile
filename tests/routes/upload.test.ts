import { expect, test } from 'vitest';

import api from '@/api/index.ts?raw';
import upload from '@/app/memory/[id]/upload.tsx?raw';
import uploads from '@/lib/upload/send.ts?raw';
import { strings } from '@/strings';

/**
 * «Ваши кадры» — the camera roll drawn the way a memory's own feed is (TASK-210). Read as text, the
 * way `memory-screens.test.ts` gives at length: this is an `expo-router` screen wired to a native
 * gallery module, and there is no renderer for one here. What is worth pinning is what the layout
 * decided and what a later reader would undo by accident.
 */

const ru = strings.ru;

test('the roll is the kit’s feed: three to a row, 2 of gutter, edge to edge', () => {
  // Spec 7.8's first lane, not the wizard's: no rounding, no margins, and the column measured out
  // of the window rather than flexed — `flex: 1/3` hands a lone last frame a third of the row.
  expect(upload).toContain('const cell = { width: (width - FEED_GAP * 2) / 3 };');
  expect(upload).toContain('lane="feed"');
  expect(upload).toContain('feed: { flexGrow: 1, gap: FEED_GAP }');
  expect(upload).toContain("strip: { flexDirection: 'row', gap: FEED_GAP }");
});

test('the bar over the feed is glass, and its capsule is a plate rather than a button', () => {
  const bar = upload.slice(upload.indexOf('<GlassBar'), upload.indexOf('{feed && picking ?'));
  // «Ваши кадры» over «в „Свадьба Лизы и Марка“» — the screen is about this phone's roll, and the
  // memory is the line under it.
  expect(bar).toContain('title={s.upload.title}');
  expect(bar).toContain('meta={memory ? s.upload.into(memory.title) : undefined}');
  expect(ru.upload.into('Свадьба Лизы и Марка')).toBe('в «Свадьба Лизы и Марка»');
  // Nothing to open behind it, so nothing is passed to open: the kit draws a plate when it is
  // handed no `onCapsule`, and a dead button would be worse than none.
  expect(bar).not.toContain('onCapsule');
  // The switch on the right is held in, which is what makes it a switch and not a button.
  expect(bar).toContain('on={picking}');
  expect(bar).toContain('label={s.upload.picking}');
});

test('picking is on from the first moment, and turning it off empties the feed of circles', () => {
  expect(upload).toContain('const [picking, setPicking] = useState(true);');
  // No circle at all rather than an empty one: a frame that is not being picked is not a checkbox.
  expect(upload).toContain("pick={picking ? (picked.has(item.id) ? 'send' : 'off') : undefined}");
  // And a tap does the other thing — the frame opens full screen, in the dark room the kit keeps
  // for a photograph in both themes.
  expect(upload).toContain('onPress={() => (picking ? toggle(item.id) : setOpen(item))}');
  expect(upload).toContain('const room = themes.dark.color;');
  expect(upload).toContain('room: { flex: 1, backgroundColor: room.ink }');
  expect(upload).toContain('<ThemePin value="dark">');
});

test('the date between two days takes the whole day and gives it back', () => {
  const daymark = upload.slice(
    upload.indexOf('<DayMark'),
    upload.indexOf('/>', upload.indexOf('<DayMark')),
  );
  // The seam itself is the button (spec 7.8), and the circle in front of the date is which of the
  // two states it is in — so the mark has to be told, not only pressed.
  expect(daymark).toContain('picked={row.day.assets.every((asset) => picked.has(asset.id))}');
  expect(daymark).toContain(
    'picking && !limited && !reading ? () => toggleDay(row.day) : undefined',
  );
  // A day already whole comes off; anything else goes on. Only this day either way.
  const toggling = upload.slice(upload.indexOf('function toggleDay'));
  expect(toggling.slice(0, toggling.indexOf('\n  }'))).toContain(
    'const whole = day.assets.every((asset) => have.has(asset.id));',
  );
});

test('«выбрать все N» for a day is out while any page of the roll is still arriving', () => {
  // The bug review fixed once (TASK-121): the roll arrives 500 assets at a time, and a day that
  // straddles a page boundary already named its final count while only its head was in state — a
  // tap took the head and dropped the tail in silence. Being out is having no press at all: a band
  // that cannot be pressed is not a checkbox, which is what a half-read day should be.
  // `reading` spans every page of the do-while, not just the first one.
  const before = upload.slice(0, upload.indexOf('do {'));
  expect(before).toContain('setReading(true);');
  const loopEnd = upload.indexOf('} while (after !== undefined);');
  const finallyBlock = upload.slice(loopEnd, upload.indexOf('}, [granted, rereads]);'));
  expect(finallyBlock).toContain('finally {');
  expect(finallyBlock).toContain('setReading(false);');
  const loopBody = upload.slice(upload.indexOf('do {'), loopEnd);
  expect(loopBody).not.toContain('setReading(false)');
});

test('the send button stands from the start and is simply out until something is marked', () => {
  const layer = upload.slice(upload.indexOf('<ActionBar'), upload.indexOf('</ActionBar>'));
  // Spec's `Upload`: «ничего не выбрано — кнопка недоступна». It never counts nothing out loud.
  expect(layer).toContain('disabled={picked.size === 0}');
  expect(layer).toContain('label={picked.size > 0 ? s.upload.send(picked.size) : s.action.send}');
  expect(ru.upload.send(12)).toBe('Отправить 12 файлов');
  // The deepest of the five footers, and the one that lies over photographs (spec 2).
  expect(layer).toContain('footer="upload"');
  // With picking off there is nothing to send, and the faces with no feed carry no layer at all.
  expect(upload).toContain('{feed && picking ? (\n        <ActionBar');
});

test('the four other faces are this screen with no feed under it', () => {
  // `UploadAccess`, `UploadEmpty` and the two waits: the plain bar with the memory under the
  // heading, which is what the layout draws where there are no photographs to float glass over.
  expect(upload).toContain('const feed = granted && rows.length > 0;');
  expect(upload).toContain('<Board style={feed ? styles.bleed : undefined}>');
  expect(upload).toContain('subtitle={subtitleFor(memory)}');
  expect(upload).toContain('label={access.canAskAgain ? s.upload.allow : s.action.openSettings}');
  expect(upload).toContain('sign="dashed"');
  expect(upload).toContain('title={s.upload.emptyTitle}');
  // `UploadQueue` and `UploadLimited` are not faces of their own but blocks over the feed — and
  // over whatever stands where a feed would, so a queue is still visible on an empty roll.
  expect(upload).toContain('{queued.length > 0 ? (\n          <Upload');
  expect(upload).toContain('{s.upload.notSent.toUpperCase()}');
  expect(upload).toContain('<RowStuck');
  expect(upload).toContain('onPress={() => drop(file.memoryId, file.assetId)}');
  expect(upload).toContain('{limited ? (\n          <HintNote');
});

test('a partial grant counts the day instead of offering to select all of it', () => {
  // `UploadLimited`: «Выбрать все» is gone because there is nothing to select all of, the count is
  // drawn back (`limited`) because the rest is unseen rather than missing, and the plate under the
  // strip says so in words.
  const daymark = upload.slice(
    upload.indexOf('<DayMark'),
    upload.indexOf('/>', upload.indexOf('<DayMark')),
  );
  expect(daymark).toContain('count={s.memory.frames(row.day.assets.length)}');
  expect(daymark).toContain('limited={limited}');
  expect(daymark).toContain('!limited');
  expect(upload).toContain(
    '...(limited ? [{ key: `unseen-${day.at}`, unseen: true as const }] : []),',
  );
  expect(upload).toContain('{s.upload.restUnseen}');
});

test('«Это всё?» waits until everything this visit sent is actually in', () => {
  // The api decides whether to ask at all (`first_upload`), this decides when: the layout has the
  // sending block give way to the sheet, so a sheet counting «12 файлов ушли» while nine are still
  // going would be contradicting the bar right behind it.
  expect(upload).toContain('const asking = useAskAll() === id && sent > 0 && queued.length === 0;');
  // The count is what this visit handed over, counted where it is handed over.
  expect(upload).toContain('setSent((n) => n + chosen.length);');
  expect(upload).toContain('{s.upload.sentToMemory(sent)}');
});

test('both answers to it are a standing, and closing it is not', () => {
  // TASK-190 opened the status route to `more_coming`, so «Ещё будет» is now said out loud rather
  // than left to whatever the first upload put there — it is the person's own word either way.
  expect(upload).toContain("onPress={() => answerAskAll('done')}");
  expect(upload).toContain("onPress={() => answerAskAll('more_coming')}");
  expect(upload).toContain('onCancel={() => answerAskAll(null)}');
  expect(uploads).toContain(
    'if (answer === null || memoryId === null || session === null) return;',
  );
  expect(uploads).toContain('setContributionStatus(session, memoryId, answer)');
  expect(api).toContain("status: 'more_coming' | 'done' | 'nothing',");
  // And the question is a sheet on the screen, never a system dialog raised from the queue.
  expect(uploads).not.toContain('Alert');
});

test('the upload intent carries the phone’s own name for the file', () => {
  // TASK-191: the one line «сведения о кадре» has no other source for. Optional on the api's side,
  // cut to the 255 it takes — a 400 here would park a file that has nothing wrong with it.
  expect(api).toContain('file_name?: string;');
  expect(uploads).toContain('file_name: file.filename.slice(0, 255),');
});

test('the screen brings no colours of its own to either theme', () => {
  // Spec 2 and the kit's rule: a screen takes its colours from `@/theme` through the kit, so the
  // light theme is a substitution and not a second screen. The one pinned exception is the dark
  // room a photograph is looked at in, and it is spelled out above.
  expect(upload).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
  expect(upload).not.toMatch(/rgba?\(/);
});
