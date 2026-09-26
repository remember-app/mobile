import { api, flat } from '@tests/helpers/source';
import { expect, test } from 'vitest';

import upload from '@/app/memory/[id]/upload.tsx?raw';
import uploads from '@/lib/upload/send.ts?raw';
import noFeed from '@/screens/upload/message.tsx?raw';
import roll from '@/screens/upload/roll.ts?raw';
import { strings } from '@/strings';
import { board, height, uploadGaps } from '@/theme';

/**
 * «Ваши кадры» — the camera roll drawn the way a memory's own feed is (TASK-210). Read as text, the
 * way `tests/routes/memory/screen.test.ts` gives at length: this is an `expo-router` screen wired to a native
 * gallery module, and there is no renderer for one here. What is worth pinning is what the layout
 * decided and what a later reader would undo by accident.
 */

const ru = strings.ru;

test('the roll is the kit’s feed edge to edge, and the queue’s grid in the margins', () => {
  // Spec 7.8, detail 64: the feed three to a row with 2 of gutter and no margins; the queue (and the
  // wizard) in the screen's 16 with 3 of gutter and a 4 radius. The column is measured out of the
  // window rather than flexed — `flex: 1/3` hands a lone last frame a third of the row.
  expect(upload).toContain('const gap = glass ? FEED_GAP : GRID_GAP;');
  expect(upload).toContain(
    'const cell = { width: (width - (glass ? 0 : space.s4 * 2) - gap * 2) / 3 };',
  );
  expect(upload).toContain("lane={glass ? 'feed' : 'pick'}");
  expect(upload).toContain('ring={!glass}');
  expect(upload).toContain('grid: { flexGrow: 1, paddingHorizontal: space.s4');
  // `Upload.json`: the seam 108–128, the first frames at 128, the second row at 259 — a day's seam
  // is flush with its strips, and the gutter only stands between strips.
  expect(upload).toContain('feed: { flexGrow: 1 },');
  expect(upload).toContain('{ gap, marginTop: row.lead ? 0 : gap }');
  expect(upload).toContain('lead: i === 0,');
});

test('the queue and a partial grant are drawn in the plain face, and the feed is glass only with nothing said over it', () => {
  // `UploadQueue` and `UploadLimited` wear the plain bar with the memory named under the heading,
  // and no switch for the mode: picking is simply on there.
  expect(upload).toContain('const glass = feed && !limited && queued.length === 0;');
  expect(upload).toContain('const choosing = picking || !glass;');
  expect(flat(upload)).toContain('<Board style={glass ? styles.bleed : undefined}');
  expect(upload).toContain('footer={glass ? undefined : layer}');
  expect(upload).toContain('{glass ? layer : null}');
});

test('the bar over the feed is glass, and its capsule is a plate rather than a button', () => {
  const bar = upload.slice(upload.indexOf('<GlassBar'), upload.indexOf('{glass ? layer'));
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
  expect(upload).toContain("pick={choosing ? (picked.has(item.id) ? 'send' : 'off') : undefined}");
  // And a tap does the other thing — the frame opens full screen, in the dark room the kit keeps
  // for a photograph in both themes.
  expect(upload).toContain('onPress={() => (choosing ? toggle(item.id) : setOpen(item))}');
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
  expect(upload).toContain('day.assets.every((asset) => picked.has(asset.id));');
  expect(daymark).toContain('picked={dayTaken(day)}');
  expect(daymark).toContain('onPress={takes ? () => toggleDay(day) : undefined}');
  expect(upload).toContain('const takes = choosing && !limited && !reading;');
  // `Upload.json`: «13 сентября, суббота» and «61» — the day and its name, and a bare figure.
  expect(daymark).toContain('label={`${formatDay(at)}, ${formatWeekday(at)}`}');
  expect(daymark).toContain('count={String(frames)}');
  // Over the queue's grid the same press is a button at the end of the day's heading, and it says
  // which way it goes (`UploadQueue`: «Снято 13 сентября» … «Выбрать все 61»).
  const heading = upload.slice(upload.indexOf('<DayHead'), upload.indexOf('</DayHead>'));
  expect(heading).toContain('label={s.upload.shotOn(formatDay(at))}');
  expect(heading).toContain(
    'label={dayTaken(day) ? s.upload.unselectDay(frames) : s.upload.selectDay(frames)}',
  );
  expect(ru.upload.shotOn('13 сентября')).toBe('Снято 13 сентября');
  expect(ru.upload.selectDay(61)).toBe('Выбрать все 61');
  expect(ru.upload.unselectDay(61)).toBe('Снять все 61');
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
  // `reading` spans every page of the do-while, not just the first one. It is the roll's own now
  // (`@/screens/upload/roll`), and the screen reads it off the hook.
  const before = roll.slice(0, roll.indexOf('do {'));
  expect(before).toContain('setReading(true);');
  const loopEnd = roll.indexOf('} while (after !== undefined);');
  const finallyBlock = roll.slice(loopEnd, roll.indexOf('}, [granted, rereads]);'));
  expect(finallyBlock).toContain('finally {');
  expect(finallyBlock).toContain('setReading(false);');
  const loopBody = roll.slice(roll.indexOf('do {'), loopEnd);
  expect(loopBody).not.toContain('setReading(false)');
});

test('the send button stands from the start and is simply out until something is marked', () => {
  const layer = upload.slice(upload.indexOf('<ActionBar'), upload.indexOf('</ActionBar>'));
  // Spec's `Upload`: «ничего не выбрано — кнопка недоступна». It never counts nothing out loud.
  expect(layer).toContain('disabled={picked.size === 0}');
  expect(layer).toContain('label={picked.size > 0 ? s.upload.send(picked.size) : s.action.send}');
  expect(ru.upload.send(12)).toBe('Отправить 12 файлов');
  // On the feed the deepest of the five footers, the one that lies over photographs (spec 2); under
  // the queue's grid the board's own, the 176 of `UploadLimited` with the count over the button.
  expect(layer).toContain("footer={glass ? 'upload' : undefined}");
  // With picking off there is nothing to send, and the faces with no feed carry no layer at all.
  // Spec 8, `UploadQueue` and 10.11: while something is going the layer stands only once something
  // is marked — a dead «Отправить» would argue with the sending the screen is about.
  expect(upload).toContain(
    'feed && choosing && (picked.size > 0 || queued.length === 0) ? (\n      <ActionBar',
  );
  // The count over the button is `UploadLimited`'s alone (spec 8, `Upload`: «Строки счёта … здесь
  // нет»), and its quiet «Снять» is 14 / 600 (`UploadLimited.json` e22).
  expect(layer).toContain('above={\n          limited && picked.size > 0 ? (');
  expect(layer).toContain('labelRole="controlSm"');
});

test('the four other faces are this screen with no feed under it', () => {
  // `UploadAccess`, `UploadEmpty` and the two waits: the plain bar with the memory under the
  // heading, which is what the layout draws where there are no photographs to float glass over.
  expect(upload).toContain('const feed = granted && rows.length > 0;');
  expect(upload).toContain('subtitle={subtitleFor(memory)}');
  expect(noFeed).toContain('label={access.canAskAgain ? s.upload.allow : s.action.openSettings}');
  // Both buttons of the message card say their words at 15 / 600 (spec detail 45; `UploadAccess.json`
  // e10), not the 16 a 52 says elsewhere.
  expect(noFeed.match(/size="md"\s+labelRole="controlMd"/g)).toHaveLength(2);
  expect(noFeed).toContain('sign="dashed"');
  expect(noFeed).toContain('title={s.upload.emptyTitle}');
  // The sending and the grant are blocks over the grid — and over whatever stands where a feed
  // would, so a queue is still visible on an empty roll.
  expect(upload).toContain('{queued.length > 0 ? (\n          <Upload');
  expect(upload).toContain('{s.upload.notSent.toUpperCase()}');
  expect(upload).toContain('<RowStuck');
  expect(upload).toContain('onDrop={() => drop(file.memoryId, file.assetId)}');
  expect(upload).toContain('{limited ? (\n          <HintNote');
});

test('the plain face’s body starts where the layout starts it: 124, and the message card at 132', () => {
  // Spec 4: «124 — тело после шапки с подзаголовком (`Upload*`)»; `UploadQueue.json` e5 and
  // `UploadLimited.json` e5 at 124, `UploadAccess.json` e6 at 132 — under a bar whose row ends at 96.
  expect(upload).toContain('const LEAD = board.bodyUpload - board.status - height.bar;');
  expect([board.bodyUpload, board.bodyUploadCard]).toEqual([124, 132]);
  expect(board.bodyUpload - board.status - height.bar).toBe(28);
  expect(upload).toContain('body: { paddingHorizontal: space.s4, paddingTop: LEAD }');
  expect(upload).toContain('lead: { paddingTop: LEAD }');
  expect(noFeed).toContain('message: { marginTop: board.bodyUploadCard - board.bodyUpload }');
  // «НЕ УШЛИ» 10 over its rows and the rows 10 apart (e12 → e13 → e19), the unseen plate 22 under
  // its strip (e12 ends at 455, e18 at 477).
  expect(uploadGaps).toEqual({ parked: 267 - (241 + 16), unseen: 477 - (338 + 117) });
  expect(upload).toContain('parked: { gap: uploadGaps.parked }');
  expect(upload).toContain('unseen: { marginTop: uploadGaps.unseen }');
});

test('`UploadEmpty` stands in the middle of the body down to the screen’s edge, not under the bar', () => {
  // `UploadEmpty.json`: the sign at 382, the paragraph ending at 586 — a block of 204 centred on
  // (124 + 844) / 2. The app pinned it under the bar, 239 higher.
  expect((124 + 844) / 2 - (586 - 382) / 2).toBe(382);
  const empty = noFeed.slice(noFeed.indexOf('<View style={styles.middle}>'));
  expect(empty).toContain('<Empty');
  expect(noFeed).toContain("middle: { flexGrow: 1, justifyContent: 'center' }");
});

test('a partial grant counts the day instead of offering to select all of it', () => {
  // `UploadLimited`: «Выбрать все» is gone because there is nothing to select all of, and the plate
  // under the strip says the rest is unseen rather than missing. The layout's «3 из 61» is not to be
  // had: under a partial grant the phone hands over the three and never says how many the day holds.
  const heading = upload.slice(upload.indexOf('<DayHead'), upload.indexOf('</DayHead>'));
  expect(heading).toContain('count={takes ? undefined : s.memory.frames(frames)}');
  expect(upload).toContain(
    '...(limited ? [{ key: `unseen-${day.at}`, unseen: true as const }] : []),',
  );
  expect(upload).toContain('<DashedNote text={s.upload.restUnseen} style={styles.unseen} />');
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
