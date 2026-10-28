import { api, flat } from '@tests/helpers/source';
import { expect, test } from 'vitest';

import layout from '@/app/_layout.tsx?raw';
import queueRoute from '@/app/memory/[id]/queue.tsx?raw';
import upload from '@/app/memory/[id]/upload.tsx?raw';
import uploads from '@/lib/upload/send.ts?raw';
import noFeed from '@/screens/upload/message.tsx?raw';
import roll from '@/screens/upload/roll.ts?raw';
import { strings } from '@/strings';
import { uploadGaps } from '@/theme';

/**
 * «Добавить кадры» — the camera roll drawn the way a memory's own feed is (TASK-210). Read as text, the
 * way `tests/routes/memory/screen.test.ts` gives at length: this is an `expo-router` screen wired to a native
 * gallery module, and there is no renderer for one here. What is worth pinning is what the layout
 * decided and what a later reader would undo by accident.
 */

const ru = strings.ru;

test('every face with a feed is the kit’s feed edge to edge — the queue and a partial grant with the picking face', () => {
  // Spec 7.8, detail 64 (28 October): the feed, `UploadQueue` and `UploadLimited` are three to a row
  // with 2 of gutter, no margins and no radius — the queue's own 117 grid is gone, and the wizard's
  // 3 gutter with it. The column is measured out of the window rather than flexed — `flex: 1/3`
  // hands a lone last frame a third of the row. The gutter goes to nought at the single frame the
  // pinch walks the roll to (TASK-564, spec 10.14.2).
  expect(upload).toContain('const gap = density === 1 ? 0 : FEED_GAP;');
  expect(upload).toContain('const cell = { width: (width - gap * 2) / density };');
  expect(upload).toContain('lane="feed"');
  // `Upload.json`: the seam 108–128, the first frames at 128, the second row at 259 — a day's seam
  // is flush with its strips, and the gutter only stands between strips.
  expect(upload).toContain('feed: { flexGrow: 1 },');
  expect(upload).toContain('{ gap, marginTop: row.lead ? 0 : gap }');
  expect(upload).toContain('lead: i === 0,');
});

test('one look for every face with a feed, and the queue and the grant tell themselves apart by their blocks alone', () => {
  // 28 October: `UploadQueue` and `UploadLimited` are `Upload`'s own states, so they are the same
  // screen — the glass bar, the edge-to-edge grid and the floating button. There is no flag left that
  // sends them down a second layout: the only thing that knows which face this is, is what is said
  // over the roll. The queue's route is its own (27 September): `Upload` itself says nothing of the
  // sending.
  expect(upload).not.toContain('const glass');
  expect(upload).not.toContain('glass ?');
  expect(upload).toContain(
    'const queued = queue ? uploads.filter((file) => file.memoryId === id) : [];',
  );
  expect(queueRoute).toContain('<UploadScreen queue />');
  expect(layout).toContain('<Stack.Screen name="memory/[id]/queue"');
  // The switch on the glass bar is the word wherever there is a feed — the queue's bar carries it
  // too now; a face with no feed has nothing to pick and choosing is on there regardless.
  expect(upload).toContain('const choosing = picking || !feed;');
  expect(flat(upload)).toContain('<Board style={styles.bleed}');
  expect(upload).toContain('{feed ? layer : null}');
  // No plain bar is left anywhere in the family: the glass one stands over the roll and over a
  // message alike, and only a face with no feed keeps its right slot empty (28 October).
  expect(upload).not.toContain('<AppBar');
  // The blocks the queue and the grant add are what is left of the two old faces.
  expect(upload).toContain('{queued.length > 0 ? (\n          <Upload');
  expect(upload).toContain('<BlockStuck');
  expect(upload).toContain('{limited ? (\n          <HintNote');
});

test('the bar over the feed is glass, and its capsule is a plate rather than a button', () => {
  const bar = upload.slice(
    upload.indexOf('<GlassBar'),
    upload.indexOf('</View>', upload.indexOf('<GlassBar')),
  );
  // «Добавить кадры» over «в „Свадьба Лизы и Марка“» — the screen is about this phone's roll, and the
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
  expect(upload).toContain('const label = `${formatDay(at)}, ${formatWeekday(at)}`;');
  expect(daymark).toContain('label={label}');
  // Read out with that day, and which way it goes (spec detail 65).
  expect(daymark).toContain(
    'pressLabel={dayTaken(day) ? s.upload.leaveDay(label) : s.upload.takeDay(label)}',
  );
  expect(daymark).toContain('count={String(frames)}');
  // The queue's grid draws the same seam and not a heading with a button at its end (TASK-541): the
  // one heading left is the partial grant's, and it offers nothing to take.
  expect(upload).not.toContain('s.upload.selectDay');
  expect(upload).not.toContain('s.upload.unselectDay');
  const heading = upload.slice(
    upload.indexOf('<DayHead'),
    upload.indexOf('/>', upload.indexOf('<DayHead')),
  );
  expect(heading).toContain('label={s.upload.shotOn(formatDay(at))}');
  expect(heading).toContain('count={s.memory.frames(frames)}');
  expect(ru.upload.shotOn('13 сентября')).toBe('Снято 13 сентября');
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
  // On every face with a feed, the deepest of the five footers, the one that lies over photographs
  // (spec 2) — the queue's own grid and the grant's among them (28 October). Under the grant's count
  // the footer is left off, and `ActionBar` draws its own shallower 176.
  expect(layer).toContain("footer={limited ? undefined : 'upload'}");
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
  // `UploadAccess`, `UploadEmpty` and the two waits: the same glass bar over a message, as the
  // layout draws it (28 October). Only the roll is missing; the heading, the memory and the way
  // back are the feed's own.
  expect(upload).toContain('const feed = granted && rows.length > 0;');
  expect(flat(upload)).not.toContain('<AppBar');
  // The picking switch is the feed's alone: a face with no feed has nothing to pick, and the kit
  // keeps the empty 48 in its place.
  expect(flat(upload)).toContain('right={ feed ? (');
  expect(noFeed).toContain('label={access.canAskAgain ? s.upload.allow : s.action.openSettings}');
  // Both buttons of the message card say their words at 15 / 600 (spec detail 45; `UploadAccess.json`
  // e10), not the 16 a 52 says elsewhere.
  expect(noFeed.match(/size="md"\s+labelRole="controlMd"/g)).toHaveLength(2);
  expect(noFeed).toContain('sign="dashed"');
  expect(noFeed).toContain('title={s.upload.emptyTitle}');
  // The sending and the grant are blocks over the grid — and over whatever stands where a feed
  // would, so a queue is still visible on an empty roll.
  expect(upload).toContain('{queued.length > 0 ? (\n          <Upload');
  expect(upload).toContain('title={s.upload.notSent(stuck.length)}');
  expect(upload).toContain('<BlockStuck');
  // A line to a file (spec detail 51), and its cross lets go of that one file.
  expect(upload).toContain('onDrop: () => drop(id, file.assetId),');
  // «Ещё раз» is the queue's own wake, as «Повторить» was — the sending is not written anew.
  expect(upload).toContain('retry={{ label: s.upload.again, onPress: wake }}');
  expect(upload).toContain('{limited ? (\n          <HintNote');
});

test('a face with no feed puts its message on the feed’s own line: 108 under the glass bar', () => {
  // Spec 4 and `UploadAccess.json` e6 (28 October): the card starts where the roll would, the status
  // line, the bar's 48 and 8 under it — the same line both faces share. The card has nothing of the
  // old plain bar's 132 left.
  expect(upload).toContain('const underBar = insets.top + height.roundViewer + space.s2;');
  expect(upload).toContain('paddingTop: underBar,');
  expect(flat(upload)).toContain('top={said ? 0 : underBar}');
  expect(flat(noFeed)).toContain('style={{ marginTop: top }}');
  expect(noFeed).not.toContain('board.bodyUploadCard');
  // The unseen plate 22 under its strip (`UploadLimited.json`: e12 ends at 455, e18 at 477).
  expect(uploadGaps).toEqual({ unseen: 477 - (338 + 117) });
  expect(upload).toContain('unseen: { marginTop: uploadGaps.unseen }');
});

test('`UploadEmpty` stands in the middle of the whole body under the glass, at 422', () => {
  // `UploadEmpty` (TASK-565): the body under the glass bar is the whole screen, 0…844, so the empty
  // state is centred on it — 422 — as `FramesEmpty` is, and not counted from an old body height.
  expect((0 + 844) / 2).toBe(422);
  const empty = noFeed.slice(noFeed.indexOf('<View style={styles.middle}>'));
  expect(empty).toContain('<Empty');
  expect(noFeed).toContain("middle: { flexGrow: 1, justifyContent: 'center' }");
  // The body scrolls to the screen's edges under the glass: no top padding to count the empty state
  // from, and the screen's own 16 at the sides.
  expect(upload).toContain('body: { paddingHorizontal: space.s4 },');
  expect(upload).not.toContain('paddingTop: LEAD');
});

test('a partial grant counts the day instead of offering to select all of it', () => {
  // `UploadLimited`: «Выбрать все» is gone because there is nothing to select all of, and the plate
  // under the strip says the rest is unseen rather than missing. The layout's «3 из 61» is not to be
  // had: under a partial grant the phone hands over the three and never says how many the day holds.
  const heading = upload.slice(
    upload.indexOf('<DayHead'),
    upload.indexOf('/>', upload.indexOf('<DayHead')),
  );
  expect(heading).toContain('count={s.memory.frames(frames)}');
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
