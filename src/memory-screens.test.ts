import { expect, test } from 'vitest';

import create from './app/create.tsx?raw';
import memory from './app/memory/[id].tsx?raw';
import edit from './app/memory/[id]/edit.tsx?raw';
import settings from './app/memory/[id]/settings.tsx?raw';
import live from './app/memory/[id]/montage/[montageId]/index.tsx?raw';
import stageLog from './app/memory/[id]/montage/[montageId]/stage/[stage].tsx?raw';
import upload from './app/memory/[id]/upload.tsx?raw';
import home from './app/index.tsx?raw';
import invite from './app/invite.tsx?raw';
import layout from './app/_layout.tsx?raw';
import api from './api.ts?raw';
// The kit files read here: the sheet's offset from the header is the appbar's own padding, and the
// montage card is where the poster a face hands over actually lands.
import bars from './kit/bars.tsx?raw';
import cardMontage from './kit/card-montage.tsx?raw';
// The viewer's strip is the library's own part, and what it does with a finger was learned three
// times over on a real phone — so it is read here, beside the window that mounts it.
import filmstrip from './kit/filmstrip.tsx?raw';
import member from './kit/member.tsx?raw';
// Where both gutters of spec 7.8 are named, so a screen that measures a column out of one of them
// is measuring it out of the library rather than out of a number it chose.
import tile from './kit/tile.tsx?raw';
import toggle from './kit/toggle.tsx?raw';
import cover from './memory/cover.tsx?raw';
// The one player this product has: the strip on the feed and the film's own page both raise it,
// which is why neither of them holds a `Modal` of its own any more (TASK-222).
import player from './memory/film-player.tsx?raw';
import done from './app/memory/[id]/montage/[montageId]/done.tsx?raw';
import films from './memory/films.tsx?raw';
import viewer from './memory/frame-viewer.tsx?raw';
// The card one record of the journal opens — a piece of two screens, so it lives beside neither.
import liveFile from './memory/live-file.tsx?raw';
// And the five rows of the making, which those same two screens draw.
import stageRows from './memory/stage-rows.tsx?raw';
import frames from './memory/frames.tsx?raw';
import sheets from './memory/frames-sheets.tsx?raw';
import head from './memory/head.tsx?raw';
import inviteSheet from './memory/invite-sheet.tsx?raw';
import when from './memory/when.tsx?raw';
// The arithmetic both the movies face and the waiting screen ask their «is it still being made»
// question through, so the two cannot drift apart about what the answer is.
import montage from './montage.ts?raw';
// Everything both screens of the making work out of one answer — where a stage stands, how long the
// whole of it took, the three numbers of «Как собирался».
import journalOf from './montage-journal.ts?raw';
import push from './push.ts?raw';
import { en, ru } from '@/strings';

/**
 * A memory is one screen and no tabs (spec 8, `MemoryFrames`, TASK-207): the feed of frames runs the
 * width and the height of the phone, the films stand first on it, and the glass bar floats over it.
 * The three faces of TASK-101 are gone — the people moved to the memory's own settings, and the
 * films became a block of the feed. These read off the route and the pieces it is drawn from: what
 * went where, what the bar carries, and what still points at what.
 *
 * Their text and not their rendered output, because this file has no renderer: every test here
 * runs pure logic, and a screen would need `react-native` transformed and `expo-router`,
 * `expo-video` and the safe area all faked before its first line ran. What is worth pinning about a
 * reorganisation is the shape of it — that much the text answers. A render harness has arrived since
 * (`react-test-renderer`, README «Истории»), and what these screens *do* — the picking mode, the
 * delete, the roster, the save, the sheets — is read there, in `*-flow.test.tsx`. What stays here is
 * what only the text can say: where a thing stands, and what is no longer in the file.
 */

/**
 * What each bottom layer of a face holds, in the order they stand in the file — the props of the
 * opening tag included, because the kind with a line of counting over the button carries that line
 * as one (`above`).
 */
function actionBars(face: string): string[] {
  return face
    .split('<ActionBar')
    .slice(1)
    .map((rest) => rest.slice(0, rest.indexOf('</ActionBar>')));
}

test('one memory is one route, behind the same gate as the rest of the app', () => {
  expect(layout).toContain('<Stack.Screen name="memory/[id]"');
  // The two that were faces of it and are not routes any more.
  expect(layout).not.toContain('name="memory/[id]/gallery"');
  expect(layout).not.toContain('name="memory/[id]/montage"');
  // Picking material off the phone stays a screen of its own — it is one somebody comes back from.
  expect(layout).toContain('<Stack.Screen name="memory/[id]/upload"');
  // And so are the settings and the one screen that edits the memory (TASK-209): the people used to
  // be a face and are a route now, which is what the capsule over the feed leads to.
  expect(layout).toContain('<Stack.Screen name="memory/[id]/settings"');
  expect(layout).toContain('<Stack.Screen name="memory/[id]/edit"');
  // Inside `Stack.Protected` — a screen declared outside it exists signed out too.
  expect(layout.indexOf('name="memory/[id]"')).toBeLessThan(layout.indexOf('</Stack.Protected>'));
  expect(layout.indexOf('name="memory/[id]/settings"')).toBeLessThan(
    layout.indexOf('</Stack.Protected>'),
  );
});

test('the memory is one screen: the feed, with the films standing first on it', () => {
  // No tabs and no faces: the route draws the feed, and the feed draws the films at its head.
  expect(memory).toContain('<Frames id={id} head=');
  expect(memory).not.toContain('<People');
  expect(memory).not.toContain('<Films');
  expect(frames).toContain('<Films id={id} memory={memory} />');
  // The memory itself is read once, above everything, so nothing about it blinks while the feed
  // underneath moves.
  expect(memory.match(/listMemories\(/g)).toHaveLength(1);
  for (const part of [frames, films]) expect(part).not.toContain('listMemories');
  // And each block reads what is its own.
  expect(frames).toContain('listMedia(');
  expect(films).toContain('listMontages(');
  // The roster is the settings screen's own list now. The frames still read it, and for something
  // else entirely — the name under a group and the caller's own level — never to show who is here.
  expect(settings).toContain('listMembers(');
  expect(films).not.toContain('listMembers(');
  expect(frames).not.toContain('RowMember');
  for (const moved of ['retryMontage', 'CardMontage']) {
    expect(films).toContain(moved);
    expect(settings).not.toContain(moved);
    expect(frames).not.toContain(moved);
  }
  // Asking for a movie is a wizard of its own since TASK-162, and a route per step since TASK-216:
  // the block offers it and reads its list again when that screen goes, and nothing on this screen
  // orders anything itself. The wizard's own half of this rule is in `order-screens.test.ts`.
  for (const part of [frames, films, settings]) expect(part).not.toContain('orderMontage');
  for (const stayed of ['RowMember', 'removeMember']) {
    expect(settings).toContain(stayed);
    expect(films).not.toContain(stayed);
  }
  // Putting somebody in is the sheet's, and the sheet is a file: the settings raise it and the
  // layout hangs the same one off a memory just created.
  expect(inviteSheet).toContain('inviteByUsername(');
  expect(settings).not.toContain('inviteByUsername(');
  expect(settings).toContain('<InviteSheet');
});

test('nothing is left of the tabs, the old appbar or the people inside this screen', () => {
  // What TASK-207 took out, named so it cannot come back by habit: the switch between faces, the
  // `?face=` that asked for one by link, and the inner appbar the three of them shared.
  for (const part of [memory, frames, films]) {
    expect(part).not.toContain('<Segment');
    expect(part).not.toContain('type Face');
    expect(part).not.toContain('face:');
    expect(part).not.toContain('face=');
    expect(part).not.toContain('<AppBar');
  }
  // And the roads in ask for nothing but the memory itself.
  for (const road of [invite, push, live]) expect(road).not.toContain("face: '");
  // The people are a screen of their own (TASK-209) and this one only points at it.
  expect(settings).toContain('<RowMember');
  expect(frames).not.toContain('<RowMember');
});

test('the glass bar floats over the feed, with a door in the middle and a slot at each end', () => {
  // Spec 7.1, detail 4 — the bar that replaced the tabs. It is drawn over the frames rather than
  // above them, which is what its own darkening is for.
  expect(head).toContain('<GlassBar');
  expect(head).toContain('head: { position: \'absolute\', left: 0, right: 0, top: 0 }');
  expect(frames).toContain('<MemoryHead');
  // The way out of a memory is the bar's own, because it is the same on every state of it: a tapped
  // push and a followed invite both open this screen with nothing behind it to go back to.
  expect(head).toContain("router.canGoBack() ? router.back() : router.replace('/')");
  // The capsule is a door in the feed and an action while picking, and only the door wears a
  // chevron (spec 7.1). The kit draws one or the other; it never invents the words.
  expect(head).toContain('chevron={chevron}');
  expect(bars).toContain('{onCapsule && chevron ? <Icon icon={ChevronDown}');
  expect(frames).toContain('chevron={!picking}');
  // Where the capsule leads: the memory's settings, which is where the people went.
  expect(frames).toContain("router.push({ pathname: '/memory/[id]/settings', params: { id } })");
  expect(ru.memory.settings('Свадьба')).toBe('Свадьба. Настройки воспоминания и люди');
  // And the right slot is the switch into picking — absent while there is nothing to pick, which is
  // what `FramesEmpty` draws.
  expect(frames).toContain('label={picking ? s.gallery.leaveSelect : s.gallery.select}');
  expect(frames).toContain('picking || any ? (');
  expect(frames).not.toContain('gallery.downloadAll');
});

test('the capsule says what the memory holds, and what is marked while picking', () => {
  // «12–14 сентября · 6 человек» under the name, and «3 октября · пока пусто» where nothing has
  // been brought yet (`FramesEmpty`) — one line, built from the memory the route read.
  expect(frames).toContain('formatEventDates(memory.event_start, memory.event_end)');
  expect(frames).toContain('s.memory.people(memory.member_count) : s.memory.nothingYet');
  expect(ru.memory.nothingYet).toBe('пока пусто');
  // And while picking the same capsule counts what is marked and weighs it — «38 МБ · 3 фото и
  // 1 видео» — with the press taking every frame or giving them all back.
  expect(frames).toContain('? s.gallery.pickNothing\n      : s.gallery.picked(marked.length)');
  expect(frames).toContain('megabytesOf(marked)');
  expect(frames).toContain('s.gallery.pickedKinds(');
  expect(ru.gallery.pickedKinds(3, 1)).toBe('3 фото и 1 видео');
  expect(ru.gallery.pickedKinds(3, 0)).toBe('3 фото');
  expect(en.gallery.pickedKinds(0, 1)).toBe('1 video');
  // What the press does to the selection is `toggleEvery` (`frames.test.ts`), asked of the frames on
  // the feed and not of how many ids the set happens to hold.
  const everything = frames.slice(frames.indexOf('function pickEverything'));
  expect(everything.slice(0, everything.indexOf('\n  }'))).toContain(
    'setPicked((have) => toggleEvery(markable, have));',
  );
});

test('the footer of the frames is one wide button, «Add more» off the picking mode', () => {
  // Two footers in the file — the picking one first, the ordinary one after it — and each of them
  // holds exactly one wide button. «Нижняя кнопка остаётся на месте и в том же весе».
  const bars = actionBars(frames);
  expect(bars).toHaveLength(2);
  for (const bar of bars) expect(bar.match(/wide/g)).toHaveLength(1);
  // One action in two places, and the only difference is whether there is anything here yet
  // (spec 9): «Добавить ещё» over a sheet with frames on it, «Добавить кадры» over `FramesEmpty`.
  expect(bars[1]).toContain('label={any ? s.gallery.addMore : s.gallery.add}');
  expect(ru.gallery.addMore).toBe('Добавить ещё');
  expect(ru.gallery.add).toBe('Добавить кадры');
  // And that button is the only way to the upload screen there is.
  expect(frames).toContain('/memory/[id]/upload');
  expect(films).not.toContain('/memory/[id]/upload');
  expect(settings).not.toContain('/memory/[id]/upload');
});

test('the ordinary footer is the filters, the one action, and the arrangement', () => {
  // The layout's second kind of bottom layer (spec 7.1): a round 56 at either end with the screen's
  // one action between them. Both round buttons wear the spark dot when what they open is no longer
  // at its default — and both are asked the same question, off `@/frames` rather than off a flag
  // this face keeps beside the state (spec 7.4).
  const bar = actionBars(frames)[1];
  expect(bar).toContain('icon={Funnel}');
  expect(bar).toContain('icon={ArrowUpDown}');
  expect(bar).toContain('dot={filtering(filter)}');
  expect(bar).toContain('dot={arranged(sort)}');
  expect(bar).toContain('size={height.round}');
  // Nothing brought yet is nothing to sift or lay out, so `FramesEmpty` carries neither of them —
  // and whoever may only look keeps both, with nothing in the middle where the action would be.
  expect(bar.match(/\{any \? \(/g)).toHaveLength(2);
  expect(bar).toContain('{mayUpload ? (');
  expect(bar).toContain('<View style={styles.grow} />');
});

test('an empty gallery is the sign, what is missing, and what to do about it', () => {
  // `FramesEmpty`: the dashed circle with the frame glyph, «Ни одного кадра», and a line that sends
  // the person to their own phone. The action is in the bottom layer and never inside the block
  // (spec 7.8), which is what the footer above already pins.
  expect(frames).toContain(
    '<Empty icon={ImageIcon} title={s.gallery.emptyTitle} text={s.gallery.empty} />',
  );
  expect(ru.gallery.emptyTitle).toBe('Ни одного кадра');
  expect(ru.gallery.empty).toBe(
    'Всё, что добавит любой участник, появится здесь. Начните со своих.',
  );
  // And it stands in the middle of the body rather than at the top of a list that has nothing in it.
  expect(frames).toContain('rows.length === 0 ? styles.feedEmpty : null');
  // With nothing brought there is no film to cut and nothing to count, so neither block is drawn
  // over it: `FramesEmpty` is the sign, the words and one button, and nothing else.
  expect(frames).toContain('ListHeaderComponent={\n          any ? (');
});

test('a memory with no film says what one is, and offers it to the one who can order it', () => {
  // `FilmsEmpty` (spec 8): the dashed block where the strip would be, not an empty state — the two
  // leaning frames are the reward itself and the words say what a montage is.
  expect(films).toContain('<EmptyMontages');
  expect(films).toContain('text={s.montage.emptyNote}');
  expect(films).toContain("role === 'organizer' ? (");
  expect(films).toContain('label={s.montage.makeIt}');
  expect(ru.montage.emptyNote).toBe('Нейросеть выберет лучшие моменты и положит на музыку.');
  expect(ru.montage.makeIt).toBe('Смонтировать');
  // And the counter beside the heading says the same silence in one word.
  expect(films).toContain('s.montage.noneYet');
  expect(ru.montage.noneYet).toBe('пока нет');
  // The dashed tile stands first in the strip, always — the one place a new film is started, and
  // the one road out of this screen into the order as it stands today.
  expect(films).toContain('<CardMontageNew label={s.montage.newOne} onPress={askForOne} />');
  expect(ru.montage.newOne).toBe('Новый ролик');
  expect(films.indexOf('<CardMontageNew')).toBeLessThan(films.indexOf('montages.map('));
});

/**
 * The picking mode of the frames (TASK-108, kit «Экраны» 4 «Выбор»): the corner icon is a switch,
 * a tap marks instead of opening while it is on, and the one button at the bottom changes what it
 * is about — «меняется слово и дело».
 */

test('the corner icon is a switch, and leaving it drops every mark', () => {
  // Held in rather than fired: the kit draws it filled while the mode is on, which is `on=` and
  // nothing else — a plain `IconButton` has no state that survives the finger.
  expect(frames).toContain('on={picking}');
  expect(frames).toContain('onPress={togglePicking}');
  // Both halves of the switch in one function, so leaving cannot forget the marks. Order matters
  // only in that both run: what the kit asks is «нажали ещё — вышли, отметки сняты».
  const toggling = frames.slice(frames.indexOf('function togglePicking'));
  expect(toggling.slice(0, toggling.indexOf('}'))).toContain('setPicked(new Set());');
  // An empty sheet has nothing to pick from, so it carries no switch at all — not a greyed one:
  // `FramesEmpty` has an empty corner. Unless the mode is already on: the switch is the only way
  // out of it, and the last frame can go from under it while somebody else is deleting.
  expect(frames).toContain('const any = items !== null && items.length > 0;');
  expect(frames).toContain('picking || any ? (');
});

test('while picking, a tap marks the frame instead of opening it — and only a ready one', () => {
  // «Ждущие и упавшие кадры не отмечаются: скачивать нечего». Read off the frame and not the
  // record's status, so a `ready` record whose derivative never arrived is out of it too — and
  // asked of `@/frames` rather than spelled out here, because the day's «Выбрать все N» above the
  // strip counts with the same rule and the two must not drift (TASK-121). `mayPick` is where that
  // reading lives, and `frames.test.ts` pins it.
  expect(frames).toContain('const pickable = picking && mayPick(item);');
  expect(frames).toContain(
    "pick={pickable ? (picked.has(item.id) ? 'keep' : 'off') : undefined}",
  );
  // The mark is the tile's own — one ring and one circle, never a second mark drawn by a face.
  expect(frames).not.toContain('tile--selected');
  // And on the upload screen the same rule with the mode of its own: picking off, a frame carries
  // no circle at all and a tap opens it (spec, `Upload`).
  expect(upload).toContain("pick={picking ? (picked.has(item.id) ? 'send' : 'off') : undefined}");
});

test('the picking footer is share, a download that carries its count, and delete', () => {
  const picking = actionBars(frames)[0];
  // `FramesPicking` (spec 8): three buttons, the count riding in the middle one — the line of
  // counting moved up into the capsule, which is where the layout puts it now.
  expect(picking).toContain('label={s.action.share}');
  expect(picking).toContain('label={s.action.delete}');
  expect(picking).not.toContain('above={');
  expect(ru.gallery.picked(3)).toBe('Выбрано 3');
  // Spec 7.2 — the dangerous round one is glass with a red glyph, never a red fill.
  expect(picking).toContain('tint={color.dangerText}');
  expect(picking).toContain('s.gallery.download(marked.length)');
  expect(picking).toContain('s.gallery.nothingPicked');
  expect(picking).toContain('onPress={() => void savePicked()}');
  // Both off with nothing marked, and both off while something is already coming down.
  expect(picking.match(/disabled=\{busy \|\| marked\.length === 0\}/g)).toHaveLength(2);
  // Counted off the feed and never off the raw set. `picked` is emptied only by leaving the mode or
  // by the capsule, while the feed moves on its own — the three-second re-read, the focus, the
  // pull. A frame somebody else deleted stayed in the set and stayed in the count: the button
  // offered «Скачать 3 файла», signed the whole gallery to find out, and came back «Сохранено 0
  // файлов». Found in review. What the button counts is what the download will find.
  expect(frames).toContain('const marked = items?.filter((item) => picked.has(item.id)) ?? [];');
  expect(picking).not.toContain('picked.size');
  // The download itself is the whole-gallery route cut to what is marked — one ask, not one per
  // file, which is what «скачать всё» already did. Sharing takes the same links.
  expect(frames).toContain(
    '(await downloadAllMedia(session, id)).filter((file) => picked.has(file.id))',
  );
  // All of one armful is one share, so the folder the copies go to is wiped once for the lot
  // (`downloads.test.ts`), and leaving the screen is what breaks the chain of sheets.
  expect(frames).toContain('await shareFiles(await markedFiles(token), () => onScreen.current);');
});

test('deleting an armful asks first, counts the price, and takes only what may be taken', () => {
  // Criterion of the card and spec 9 both: the number is named before the press, and it is the
  // number that will actually go — one's own frames, or anybody's for the organizer. The api is the
  // authority either way; this only decides what the sheet promises.
  expect(frames).toContain('const deletable = marked.filter(mayDelete);');
  expect(frames).toContain('const mayDelete = (item: MediaItem) =>');
  expect(frames).toContain("item.uploaded_by === user?.id || role === 'organizer'");
  expect(frames).toContain('<ConfirmSheet');
  expect(frames).toContain('s.gallery.deleteAskMany(deletable.length)');
  expect(frames).toContain('meta={deletable.length < marked.length ? s.gallery.deleteDenied');
  expect(ru.gallery.deleteAskMany(4)).toBe('Удалить 4 кадра?');
  expect(ru.gallery.deleteAskMany(1)).toBe('Удалить 1 кадр?');
  // One frame is named the way the open frame names it, rather than counted at it.
  expect(frames).toContain('s.gallery.deleteAsk(deletable[0].kind)');
  // Whatever did go leaves the feed even if the run stopped halfway: those records are gone on the
  // server, and a feed still drawing them would open windows onto nothing.
  const deleting = frames.slice(frames.indexOf('async function deletePicked'));
  expect(deleting.slice(0, deleting.indexOf('\n  }'))).toContain(
    'setItems((have) => have?.filter((one) => !gone.has(one.id)) ?? null);',
  );
  expect(deleting.slice(0, deleting.indexOf('\n  }'))).toContain('if (gone.size > 0) {');
  expect(frames).toContain('deleteMedia(token, id, item.id)');
});

test('the words of the picking mode count in Russian and say why the button is off', () => {
  expect(ru.gallery.download(1)).toBe('Скачать 1 файл');
  expect(ru.gallery.download(4)).toBe('Скачать 4 файла');
  expect(ru.gallery.download(11)).toBe('Скачать 11 файлов');
  expect(en.gallery.download(1)).toBe('Download 1 file');
  expect(en.gallery.download(4)).toBe('Download 4 files');
  // The kit's own line for the button with nothing marked, and the kit's own word for the quiet one.
  expect(ru.gallery.nothingPicked).toBe('Ничего не выбрано');
  expect(ru.action.clear).toBe('Снять');
});

/**
 * The contact sheet cut into groups (TASK-121 cut it into days, TASK-144 into whatever the sort
 * asks for): the face drew one flat grid, so there was no heading over a strip and no «Выбрать все
 * N» to mark a whole one with. The cut itself is `groupFrames` and pinned in `frames.test.ts`;
 * these read how the sheet is wired to it — the same way the «Выбор кадров» screen is wired to
 * `assetsByDay`.
 */

test('the sheet is one flat list of headings and strips, never a three-column grid', () => {
  // `numColumns` lays out the list underneath, and it cannot do it *around* the headings standing
  // between the strips — so the three across are cut by hand, the way the upload screen cuts them.
  for (const sheet of [frames, upload]) {
    // The props and not the word: both files name `numColumns` in the comment that says why they
    // do without it.
    expect(sheet).not.toContain('numColumns={');
    expect(sheet).not.toContain('columnWrapperStyle={');
    expect(sheet).toContain('data={rows}');
    expect(sheet).toContain('keyExtractor={(row) => row.key}');
  }
  // The phone's own roll is cut into the days it was shot on; this face's cut is the answer the
  // sort sheet gave, and it comes off `@/frames` rather than off `@/media-window` — this face has
  // no event window to sort by, every frame in it is already the event's.
  expect(upload).toContain('frames: day');
  expect(frames).toContain('groupFrames(kept, sort)');
  expect(frames).toContain('frames: group.frames.slice(i * COLUMNS, i * COLUMNS + COLUMNS)');
  expect(frames).not.toContain('assetsByDay');
  // What is laid out is what the filter left, and both are asked of `@/frames` so the sheet, the
  // strip under the open frame and the count on the filter's own button cannot come apart.
  expect(frames).toContain('framesMatching(items ?? [], filter)');
  // Cut once per read and held, not on every tap: marking a frame is a render, and the sheet of a
  // whole wedding is re-cut in it.
  expect(frames).toContain('const rows = useMemo(');
  expect(frames).toContain('[kept, sort],');
});

test('the seam over a strip says what is under it, and takes the whole day while picking', () => {
  const daymark = frames.slice(frames.indexOf('<DayMark'), frames.indexOf('/>', frames.indexOf('<DayMark')));
  // Three kinds of seam, one component, and which one it is comes from the group itself.
  expect(daymark).toContain('{...headingOf(group)}');
  // Spec 7.8 — a figure and never a sentence: «128» after a person's name, and over a day nothing
  // at all, because `MemoryDated` draws the date by itself. While the mode is on every seam counts:
  // the band itself is then the button that takes the group.
  expect(daymark).toContain(
    "picking || group.by !== 'day'\n                    ? String(picking ? markable.length : group.frames.length)\n                    : undefined",
  );
  expect(daymark).toContain('onPress={');
  expect(daymark).toContain('pressLabel={s.gallery.selectDay(markable.length)}');
});

/**
 * The days on the feed (TASK-208, spec 8): off by default and read off the spine at the right edge
 * while a finger is moving the feed (`MemoryScrub`), on by the switch in the sort sheet and then
 * written into a 20px seam between the days (`MemoryDated`). Never both.
 */

test('the feed nobody arranged is one wall, and the days are only on the spine', () => {
  // The ungrouped cut has no seam of its own, so the feed spends no row at all on saying what day
  // it is — that is the whole of `MemoryFrames` and `MemoryScrub`.
  expect(frames).toContain("...(group.by === 'all' ? [] : [{ key: group.key, group }])");
  // And the spine is drawn only there: cut by people or by kind the days interleave, and a rail of
  // them would point at nothing. A feed shorter than the screen has no spine either (spec 8).
  expect(frames).toContain("sort.by !== 'none' || sort.dates || headerHeight === 0 || reach <= 0");
  expect(frames).toContain('const reach = feed.content - feed.view;');
  expect(frames).toContain('dateMarks(sheet, { top: feedTop, row: rowPitch })');
  // Where the first row of frames stands: the top the feed is pushed down by, the block of films
  // over it measured rather than guessed, and the one gutter between them.
  expect(frames).toContain(
    'const feedTop = insets.top + height.roundViewer + space.s4 + headerHeight + FEED_GAP;',
  );
  expect(frames).toContain('const rowPitch = cell.width + FEED_GAP;');
  // And the pill is centred on the seam and not hung from the row (`MemoryScrub`: the pills stand at
  // 195 and 588 over rows that start at 204 and 597 — 9 above, which is half a gutter and half a
  // pill).
  expect(frames).toContain('const SEAM_LIFT = FEED_GAP / 2 + 8;');
  expect(frames).toContain('top: mark.top - SEAM_LIFT,');
});

test('the spine rides the scroll itself, and is grabbed only while it can be seen', () => {
  // Spec 6: 120 coming, 400 going, a second after the feed stops — and nothing under «уменьшить
  // движение», where it simply is or is not.
  expect(frames).toContain('duration: reduced ? 0 : ms');
  expect(frames).toContain('fade(1, duration.spineIn)');
  expect(frames).toContain('fade(0, duration.spineOut)');
  expect(frames).toContain('}, SPINE_HOLD_MS);');
  // The marks stand on the feed's own seams, so they are moved by the scroll on the native side
  // rather than by this screen re-rendering sixty times a second — and the handler is hung once,
  // because re-attaching it mid-flick is a dropped frame under the finger.
  expect(frames).toContain('useNativeDriver: true,');
  expect(frames).toContain('transform: [{ translateY: Animated.multiply(scrolled, -1) }]');
  expect(frames).toContain('const onScroll = useMemo(');
  expect(frames).toContain('onScroll={onScroll}');
  // Dragging it throws the feed (spec 7.8), and it answers only touches that begin on the strip —
  // a flick along the right edge must not stop being a flick halfway through.
  expect(frames).toContain('list.current?.scrollToOffset({ offset: part * reach, animated: false })');
  expect(frames).toContain('onStartShouldSetPanResponder: () => true,');
  expect(frames).not.toContain('onMoveShouldSetPanResponder');
  // What is drawn at nought opacity is still a thing in the way of the feed underneath.
  expect(frames).toContain("pointerEvents={scrolling ? 'box-none' : 'none'}");
});

test('a heading is a day, a person with their circle, or one of the two kinds', () => {
  const heading = frames.slice(frames.indexOf('function headingOf'), frames.indexOf('/** Tap to'));
  // `MemoryDated` — «13 сентября, суббота»: the day and its name, and no year in it. Which year
  // this was is settled by the memory the feed belongs to, not repeated over every strip.
  expect(heading).toContain('`${formatDayShort(at)}, ${formatWeekday(at)}`');
  expect(heading).toContain("if (group.by === 'kind') return { label: s.media[group.kind] };");
  // `FramesByPeople`: the name, their circle in front of it, and the spark collar on the
  // organizer's — read off the roster this face already holds for the open frame's own line.
  expect(heading).toContain('avatar: name');
  expect(heading).toContain("organizer: who?.role === 'organizer'");
  // The material's one word counts every kind of group, «174 кадра» over a day and over a person
  // alike (TASK-76's key).
  expect(frames).toContain('group.frames.length');
  expect(frames).toContain('s.memory.frames(');
});

test('«Выбрать все N» counts the frames a tap could reach, and the seam is a switch over them', () => {
  // The count, the gate and the press all read the one list, so the button cannot say «9» and mark
  // eight. The rule itself is `mayPick` — the same one the single tap is gated on.
  expect(frames).toContain('const markable = group.frames.filter(mayPick);');
  // A seam with nothing a tap could reach takes no press at all — the same answer the footer
  // gives to the same emptiness, and the band is the press now (spec 7.8).
  const daymark = frames.slice(frames.indexOf('<DayMark'), frames.indexOf('/>', frames.indexOf('<DayMark')));
  expect(daymark).toContain('picking && markable.length > 0');
  // The circle says whether the whole group is taken and a second press gives it back — the kit's
  // contract for `DayMark`, and what «Ваши кадры» does. What the press does to the selection is
  // `toggleDay` (`frames.test.ts`), which only ever touches this group's frames.
  expect(daymark).toContain('picked={allTaken(markable, picked)}');
  expect(daymark).toContain('setPicked((have) => toggleDay(markable, have))');
  // The kit's quiet action of the day, and the same words on both sheets that have one — «тем же
  // тихим действием дня, что и на „Выборе кадров“». Two keys because each face keeps its own words,
  // held equal here so they cannot drift apart in one language only.
  for (const set of [en, ru]) expect(set.gallery.selectDay(9)).toBe(set.upload.selectDay(9));
  expect(ru.gallery.selectDay(9)).toBe('Выбрать все 9');
});

test('nothing on this screen pushes the screen it is already on', () => {
  // The open frame's window is a part of the memory's route too: its «В роликах» sets a parameter
  // on the screen instead of pushing the route again, which stacked a second feed of the memory.
  for (const part of [frames, films, viewer]) {
    expect(part).not.toContain("pathname: '/memory/[id]'");
    expect(part).not.toContain('/memory/[id]/gallery');
  }
  expect(viewer).not.toContain('router.push');
  // The roads out of it are four, and each belongs to the piece that offers it: the settings and
  // the upload to the feed, the order and the waiting over one montage to the strip of films.
  expect(frames).toContain('/memory/[id]/settings');
  expect(frames).toContain('/memory/[id]/upload');
  expect(films).toContain('/memory/[id]/order');
  expect(films).toContain('/memory/[id]/montage/[montageId]');
  expect(frames).not.toContain('/memory/[id]/montage');
});

test('the platform switch is spelled out once, in the kit', () => {
  // TASK-56: the same four colour props stood word for word on two screens, and one of them is the
  // kind nobody notices missing. The invite sheet takes the kit's component now.
  expect(inviteSheet).toContain('<Toggle');
  for (const face of [frames, films, settings, inviteSheet]) {
    expect(face).not.toContain('thumbColor');
  }
  expect(toggle).toContain('activeThumbColor');
});

test('every face shuts its own windows when it loses focus', () => {
  // TASK-94, off a device: `useFocusEffect(load)` re-read the roster on the way in and did nothing
  // on the way out, so a sheet nobody closed — a push, a deep link, anything that is not the cross
  // or the scrim — stayed a mounted Modal over whatever screen came next. The cleanup the hook runs
  // on blur is the whole fix; the re-read on focus is the same call it always was.
  //
  // Written for the invite sheet and carried to the other two faces in review: the frame opened
  // full screen and the montage being played are the same kind of window, reached by the same
  // `router.push` that leaves the whole memory mounted behind it. Since TASK-124 they cost a second
  // thing — `useTurnsWithPhone` follows the modal and not the mount, so nothing put the app back in
  // portrait and every screen after that one was left free to turn with the phone.
  //
  // Only those two are left here. Every sheet — the invite, the montage order, both delete
  // confirmations — is the kit's own `Sheet`, and since TASK-129 a sheet shuts itself when the
  // screen under it loses focus (`kit/sheet.test.tsx`); the settings screen's line is the plain
  // read it was before. That is the whole point of the rule living in one place: a screen that puts
  // up a new sheet gets it with no line of its own, which is how the confirmation on the settings —
  // never touched by hand, the hole TASK-129 was reported for — is shut too.
  for (const face of [frames, films]) expect(face).not.toContain('useFocusEffect(load)');
  expect(settings).toContain('useFocusEffect(load);');
  expect(frames).toMatch(
    /useFocusEffect\(\s*useCallback\(\(\) => \{\s*load\(\);\s*loadLabels\(\);\s*return \(\) => setOpen\(null\);\s*\}, \[load, loadLabels\]\),\s*\);/,
  );
  expect(films).toMatch(
    /useFocusEffect\(\s*useCallback\(\(\) => \{\s*load\(\);\s*return \(\) => setPlaying\(null\);\s*\}, \[load\]\),\s*\);/,
  );
  // And the explicit ways out are untouched: each window's own way out still closes it, the
  // hardware key and both confirmations included.
  expect(settings).toContain('onCancel={() => setInviting(false)}');
  expect(settings).toContain('onCancel={() => setDropping(null)}');
  // The screen that edits a memory has two of its own — the cover picker and the sheet that asks
  // about edits nobody saved — and both are shut the same way.
  expect(edit).toContain('onCancel={() => setPicking(false)}');
  expect(edit).toContain('onCancel={() => setLeaving(false)}');
  // The open frame is a window of its own now (TASK-147): the hardware key goes through the same
  // `onClose` the face hands it, which is the same `setOpen(null)` the blur above runs.
  expect(viewer).toContain('onRequestClose={onClose}');
  expect(frames).toContain('onClose={() => setOpen(null)}');
  expect(viewer).toContain('onCancel={() => setConfirming(false)}');
  // The player is a window of its own file now (TASK-222) and takes the same treatment: the hardware
  // key goes through the `onClose` it is handed, and both screens that raise it shut it on blur.
  expect(player).toContain('onRequestClose={onClose}');
  expect(films).toContain('onClose={() => setPlaying(null)}');
  expect(done).toMatch(
    /useFocusEffect\(\s*useCallback\(\(\) => \{\s*read\(\);\s*return \(\) => setPlaying\(false\);\s*\}, \[read\]\),\s*\);/,
  );
});

// The roads into a memory, and the face each of them lands on.

test('every road into a memory lands on the one screen it has', () => {
  // The card on the home screen, an accepted invite and a «ролик готов» push: all three used to ask
  // for a face by name, and there is nothing left to ask for — the films are on the feed and the
  // people are a press away on the capsule.
  expect(home).toContain("router.push({ pathname: '/memory/[id]', params: { id: item.id } })");
  expect(invite).toContain('params: { id: memory.id }');
  expect(push).toContain('params: { id: memoryId }');
  for (const road of [invite, push]) expect(road).not.toContain("face: '");
  // The «вас позвали» push still opens the screen that takes material.
  expect(push).toContain("router.push({ pathname: '/memory/[id]/upload'");
});

test('the ember on a face is the one action that face is for', () => {
  // The kit gives the glow to one action per surface. Each face draws two surfaces at most — itself
  // and a sheet over it — so two is the number, never one for the screen and one for a shortcut to
  // another screen (which is what the guest list's «Movie» button was).
  // Two on the frames because the footer has two shapes and only ever one of them is on screen:
  // «Скачать N файлов» while picking, «Добавить кадры» the rest of the time.
  expect(frames.match(/variant="primary"/g)).toHaveLength(2);
  // None on the strip of movies: ordering one is the dashed tile and the paper button on the empty
  // block, and the one ember a film has — «Сохранить и поделиться» — is in the player's own window
  // (TASK-222), which is a surface of its own and carries exactly one.
  expect(films.match(/variant="primary"/g)).toBeNull();
  expect(player.match(/variant="primary"/g)).toHaveLength(1);
  // And one on the film's own page: «Сохранить» beside «Поделиться» in the outline, as the layout
  // draws them (`MontageLiveDone`).
  expect(done.match(/variant="primary"/g)).toHaveLength(1);
  // The wizard of the order is four screens now and counts its own embers, a surface at a time
  // (`order-screens.test.ts`).
  // One on the settings and one on the sheet it raises: «Пригласить» in the footer, «Позвать» at
  // the foot of `SheetInvite`. The sheet had none of its own while every press that put somebody in
  // sat on that person's own row (TASK-131); the layout's `SheetInvite` is one of the five «одна
  // главная кнопка» sheets of spec 7.1, so the press moved back to the bottom.
  expect(settings.match(/variant="primary"/g)).toHaveLength(1);
  expect(inviteSheet.match(/variant="primary"/g)).toHaveLength(1);
  // And the settings' own is in the footer the kit draws, not inline in the roster.
  const footer = settings.slice(settings.indexOf('<ActionBar>'), settings.indexOf('</ActionBar>'));
  expect(footer).toContain('label={s.action.invite}');
  // Two on the screen that edits a memory — «Сохранить» in its footer and «Поставить обложкой» at
  // the foot of the sheet that picks one — and they are on two surfaces, never at once.
  expect(edit.match(/variant="primary"/g)).toHaveLength(1);
  expect(cover.match(/variant="primary"/g)).toHaveLength(1);
});

test('nobody is shown a way out of a memory, and the organizer keeps the crosses', () => {
  // TASK-113: the human took leaving off the design. The call behind it is untouched and still the
  // one the organizer's cross makes on somebody else — what went is the button that aimed it at
  // oneself, and with it the only red thing the screen had.
  expect(settings).not.toContain('variant="danger"');
  expect(settings).not.toContain('s.members.leave');
  expect(settings).toContain('removeMember(session, id, target.id)');
  expect(settings).toContain('label={s.members.remove(memberName(member))}');
});

// The settings screen (spec 8, `MemorySettings`, TASK-209): what the event is and who is in it.
// The roster below it carries the two things reported off a live device long before it moved here
// (TASK-110, TASK-111) — the standings read as bookkeeping, and nothing said how much anybody had
// actually brought.

test('the settings are the memory named, counted and covered, under one pencil', () => {
  // Spec 8: the card is what this memory is — the 68 cover, the name, «12–14 сентября · 486
  // кадров» — and the one round button on it changes all three at once (spec 10.8.3).
  expect(settings).toContain('<CoverSlot uri={memory.cover_thumbnail_url}');
  expect(settings).toContain('formatEventDates(memory.event_start, memory.event_end)');
  expect(settings).toContain('s.memory.frames(memory.media_count)');
  expect(settings).toContain('label={s.settings.edit}');
  expect(settings).toContain("router.push({ pathname: '/memory/[id]/edit', params: { id } })");
  // «Не организатор — круглой 44 „править“ и кнопки „Править состав“ нет вовсе (не недоступны — не
  // рисуются)»: a greyed-out button would promise that one day it presses.
  expect(settings).toContain('{organizer ? (');
  expect(settings).toContain('{organizer && members.length > 1 ? (');
  expect(settings).not.toContain('disabled={!organizer}');
});

test('the cover a memory has is the one chain everywhere it is shown', () => {
  // Spec 6 and 10.8.3: the chosen frame, else the mosaic of the first frames, else the dashed
  // frame — in the 68 slot and on both cards of the list, which is the kit's own `cover` prop.
  expect(cover).toContain('shots.length > 0 ? (');
  expect(cover).toContain('<Mosaic photos={shots} layout="strip" />');
  expect(cover).toContain('<DashedFrame');
  expect(home).toContain('const cover = item.cover_thumbnail_url ?? null;');
  expect(home).toContain('cover={cover}');
});

test('a standing is one of three words, and «nothing to add» is not one of the other two', () => {
  for (const set of [en, ru]) {
    // Four api values, three things a person is told: «has not started» and «is still adding» are
    // the same news to whoever is waiting, and the count beside the standing says the rest.
    expect(set.standing.not_started).toBe(set.standing.more_coming);
    expect(new Set(Object.values(set.standing)).size).toBe(3);
    // The one the person says about themselves keeps its own words — it is not a stage of
    // uploading, it is the end of it (doc-06).
    expect(set.standing.nothing).not.toBe(set.standing.done);
    expect(set.standing.nothing).not.toBe(set.standing.not_started);
  }
  expect(ru.standing.more_coming).toBe('Планирует загрузить');
  expect(ru.standing.done).toBe('Всё загрузил');
  // And the three a person may actually ask for: `not_started` is what an invite leaves behind and
  // the api refuses it back, so it is not on the way round either.
  expect(api).toContain("status: 'more_coming' | 'done' | 'nothing',");
});

test('the line over the roster counts «скинувшие» by the one rule both screens read', () => {
  // Review of m-21, on one memory: the card on the main screen and this line said different
  // numbers, because the card is counted by the api and this line counted «всё загрузил» alone.
  // Now both ask `hasShared` (doc-06, TASK-167) — the rule, not a copy of it, so the day a fifth
  // standing exists neither screen can be the one that missed it.
  expect(settings).toContain('bringers.filter((member) => hasShared(member.contribution_status))');
  expect(settings).not.toContain("contribution_status === 'done').length");
  // The other half of the line was never the argument: whoever may not bring material is owed
  // nothing and is counted on neither side of the «из» (doc-01).
  expect(settings).toContain('(members ?? []).filter((member) => mayContribute(member.role))');
  expect(settings).toContain('s.members.brought(brought, bringers.length)');
  expect(ru.members.brought(3, 5)).toBe('3 из 5 всё скинули');
});

test('viewers stand in a block of their own, with no standing and no count', () => {
  // Spec 8: «блок „Зрители“ — те же строки без меты и значка», and with nobody only watching the
  // block is not drawn at all. The api answers `null` for their standing on purpose (TASK-190):
  // «ничего не загрузил» over somebody never asked to bring anything is a reproach.
  expect(settings).toContain(
    "const viewers = (members ?? []).filter((member) => member.role === 'viewer');",
  );
  expect(settings).toContain('{viewers.length > 0 ? (');
  expect(settings).toContain("meta={member.role === 'viewer' ? undefined : framesOf(member)}");
  expect(settings).toContain('const standing = member.contribution_status;');
  expect(settings).toContain('if (standing === null) return null;');
  expect(api).toContain('contribution_status: ContributionStatus | null;');
});

test('every row says how many frames that person brought, and the api is what counted them', () => {
  // It used to be counted here, off the whole gallery, because the api kept no tally on a member.
  // It does now (TASK-190), so the roster is one read again and the number on a row is the same one
  // the gallery itself would show.
  // `?? 0` and not a bare read, the way the main screen guards its own new field: the app ships
  // over the air and the api deploys on its own, and «undefined кадров» under every name is what a
  // build meeting an older api would print.
  expect(settings).toContain('s.memory.frames(member.media_count ?? 0)');
  expect(settings).not.toContain('listMedia(');
  expect(settings).not.toContain('uploaded_by');
  // The role is not written into the row at all (spec 8, «роли в строке не выделяем»): the organizer
  // is told by the `spark` collar on their circle, and one fact said twice in a 56 row is what the
  // layout took out.
  expect(settings).toContain("ring={member.role === 'organizer'}");
  expect(settings).not.toContain('s.role[member.role]');
  // `spark` belongs to «Всё загрузил» alone (spec 1.2): that mark is what the organizer scans for,
  // and spec 7.4 leaves the circle two states — brought, or still coming.
  expect(settings).toContain("hasShared(standing) ? 'done' : 'planned'");
  expect(settings).toContain('<BadgeContribution');
});

test('one’s own standing is a button that turns it, and only one’s own', () => {
  // Spec 7.4: «тот же круг внутри круглой кнопки 44 — нажатие меняет статус в любой момент». Three
  // answers in a ring, so no press is ever the last one: doc-06 keeps every door it opens open.
  expect(settings).toContain('<StandingButton');
  expect(settings).toContain('label={s.settings.yourStanding(word)}');
  expect(settings).toContain('onPress={() => void turnStanding(standing)}');
  expect(settings).toContain("not_started: 'done',");
  expect(settings).toContain("more_coming: 'done',");
  expect(settings).toContain("done: 'nothing',");
  expect(settings).toContain("nothing: 'more_coming',");
  // Nobody else's is a button, and nothing here sets a standing on somebody else — which is why the
  // api has no `:userId` in that route at all.
  expect(settings).toContain('setContributionStatus(session, id, NEXT[from])');
  // The row is held to the spec's own height (7.5: a member stands 56), so nothing that goes into
  // it — the button, the cross, a bare circle — can change how tall it is.
  expect(member).toContain('minHeight: 56');
  // And spec 10.8.4 gives the right edge one thing at a time: while the roster is being edited that
  // thing is the 36 cross, and on one's own row it is never the cross.
  expect(settings).toContain('size={36}');
  expect(settings).toContain('if (editing && organizer && !self)');
});

test('the mode of editing the roster does not outlive the last person there is to take out', () => {
  // Spec 10.8.4: «убирать некого — кнопки нет вовсе». The button is drawn only over a roster of more
  // than one, and the mode itself is switched off with it — otherwise it waits, on, for the next
  // person to be invited and shows their cross before anybody has asked for crosses.
  expect(settings).toContain('{organizer && members.length > 1 ? (');
  expect(settings).toContain('if (members !== null && members.length <= 1) setEditing(false);');
});

test('taking somebody out names the price, and a viewer has none to name', () => {
  // `SheetConfirmMember` as it is drawn: the face, «@anya.p · принесла 54 кадра», the paragraph and
  // the plate with the figure on it. Spec 10.8.4 gives a viewer a different paragraph and no plate —
  // there is no material behind them, and «0 кадров исчезнут» names no price at all.
  expect(settings).toContain(
    'dropping.media_count ? s.members.priceFrames(dropping.media_count) : undefined',
  );
  expect(settings).toContain(
    "text={dropping.role === 'viewer' ? s.members.removeViewerText : s.members.removeText}",
  );
  expect(ru.members.removeViewerText).toBe('Этот человек больше не увидит воспоминание.');
});

// The one screen that changes a memory (spec 10.8.3, `MemoryEdit` and `SheetCover`): three things
// at once, applied by one button and by nothing else.

test('the name, the days and the cover leave in one call, and only what was touched', () => {
  expect(edit).toContain('await updateMemory(token, id, {');
  expect(edit).toContain('...(named === memory.title ? {} : { title: named }),');
  expect(edit).toContain('...(cover === memory.cover_media_id ? {} : { cover_media_id: cover }),');
  expect(edit).toContain('event_start: startOfDay(span.from).toISOString(),');
  expect(edit).toContain('event_end: span.to === null ? null : endOfDay(span.to).toISOString(),');
  // The api refuses an empty body on purpose, and «Сохранить» is unavailable until there is one
  // thing to send — the screen says that by being off, without a line explaining itself.
  expect(edit).toContain("disabled={!changed || named === ''}");
  // A name wiped out is a field error and not a silent refusal (spec 10.8.3).
  expect(edit).toContain("hint={named === '' ? s.edit.noTitle : undefined}");
  // Nothing here deletes a memory, and nothing ever will: in MVP there is no deleting one (doc-01).
  expect(edit).not.toContain('deleteMemory');
});

test('a cover is picked on a sheet, waits in the slot, and comes off again quietly', () => {
  expect(edit).toContain('<CoverSheet');
  expect(edit).toContain('label={s.edit.coverDrop}');
  expect(edit).toContain('onPress={() => setCover(null)}');
  // Spec 10.8.3: «кадров в воспоминании нет вовсе — листа не бывает», so the button that opens it is
  // unavailable and a line under the card says what is missing.
  expect(edit).toContain('disabled={saving || pickable.length === 0}');
  // Said only once the gallery has answered: before that, and when it never does, there is nothing
  // to say about how many frames the memory holds.
  expect(edit).toContain(
    '{media !== null && pickable.length === 0 ? <Hint>{s.edit.coverNeedsFrames}</Hint> : null}',
  );
  // One frame at a time on that sheet: a tap moves the pick rather than adding to it.
  expect(cover).toContain("picked === item.id ? 'send' : 'off'");
  expect(cover).toContain('onPress={takeable ? () => setPicked(item.id) : undefined}');
  // Newest first, the way the feed reads — and no day gaps: here a picture is chosen, not a day.
  expect(cover).toContain('[...media].sort((a, b) => shotAt(b) - shotAt(a))');
  expect(cover).not.toContain('Daymark');
});

test('a memory that is not on the list is an error, not a spinner that never ends', () => {
  // The listing answered and the memory is not in it — removed from it, or never there. That is a
  // failure to say out loud with the api's own «404» line; only a read still in flight is «Loading».
  expect(edit).toContain('if (one === null) return setError(errorMessage(new ApiError(404, null)));');
  expect(ru.error.status(404)).toBe('Сервер ответил 404.');
});

test('walking away from unsaved edits asks, and asks gently', () => {
  // Spec 7.1, detail 8: nothing is lost by leaving, so there is no red on this sheet and the way on
  // is the paper button. With nothing changed «Назад» simply goes.
  expect(edit).toContain('onPress={() => (changed ? setLeaving(true) : leave())}');
  expect(edit).toContain('variant="gentle"');
  expect(edit).toContain('title={s.edit.leaveAsk}');
  expect(ru.edit.leaveText).toBe('Название, даты и обложка останутся прежними.');
});

test('«Когда это было» is one block, and both screens draw that one', () => {
  // Spec 10.8.3: «блок из `Create` целиком, без единой правки». It used to be drawn twice — `Create`
  // held its own copy of the arrangement, and the two were kept level by a test that read both — and
  // is now one file the two screens hand their days to. What each of them sends is theirs.
  expect(edit).toContain('<EventWhen value={span} onChange={setSpan} disabled={saving} />');
  expect(create).toContain('<EventWhen value={span} onChange={setSpan} disabled={busy} />');
  expect(create).not.toContain('<Calendar');
  expect(edit).not.toContain('<Calendar');
  // The block itself: the same words, the same day arithmetic, the same ceiling on tomorrow.
  expect(when).toContain('<Calendar');
  expect(when).toContain('max={today}');
  expect(when).toContain('weekdays={weekdayLetters()}');
  expect(when).toContain('monthLabel={formatMonth(month)}');
  expect(when).toContain('s.create.dateHint');
  // The second tap is the switch for «больше дня», so there is no switch.
  expect(when).not.toContain('multiDay');
  // One day is one tap, a span is two, a third starts over — and a tap before the first day is that
  // first tap being corrected, never a span running backwards (behaviour: `memory/when.test.tsx`).
  expect(when).toContain('export function pickDay(span: Span, day: Date): Span {');
  expect(ru.create.dateHint).toBe('Один день — одно касание. Несколько — первый и последний.');
});

test('the way into an order is offered to the organizer and to nobody else', () => {
  // Ordering is theirs alone (doc-03), so the dashed tile and the paper button on the empty block
  // are drawn for them only: offering either to anybody else is a door into a 403. The api is the
  // authority; this is what the screen draws.
  expect(films.match(/role === 'organizer'/g)?.length).toBeGreaterThanOrEqual(3);
  expect(films).toContain("router.push({ pathname: '/memory/[id]/order', params: { id } })");
  // Nothing is drawn over a list still in flight: `montages === null` is neither empty nor full, so
  // neither the strip nor the block that invites an order is on screen yet.
  expect(films).toContain('montages === null ? null : montages.length === 0 ? (');
});

test('the montage on air is a route of one row, with the journal of a stage under it', () => {
  // TASK-163, spec 8: what was just asked for is the only thing on the mind of whoever asked, so it
  // gets a screen — and a route of one montage, not a block of the memory. The file moved into a
  // folder of its own in TASK-221, because the journal of one stage lives under it; what the wizard
  // hands it on the way in is checked with the wizard (`order-screens.test.ts`).
  expect(layout).toContain('name="memory/[id]/montage/[montageId]/index"');
  expect(layout).toContain('name="memory/[id]/montage/[montageId]/stage/[stage]"');
  expect(layout.indexOf('name="memory/[id]/montage/[montageId]/stage/[stage]"')).toBeLessThan(
    layout.indexOf('</Stack.Protected>'),
  );

  // The screen itself (`MontageLive`, TASK-221): the frame in the director's hands, and under it
  // all five stages as the worker actually reports them. The stages are named and never counted —
  // «73 %» tells a person nothing.
  expect(live).toContain('<CardNow');
  expect(live).toContain('<StageRows');
  expect(stageRows).toContain('MONTAGE_STAGES.map((code, at)');
  expect(stageRows).toContain('<RowStep');
  expect(stageRows).toContain('s.montage.stage[code]');
  // The guess this screen used to draw instead is gone from the arithmetic as well: the api says
  // which stage is running, so nothing infers it from the one word about the whole job.
  for (const guessed of ['export const STAGES', 'export function stages', 'DONE_AT_ORDER']) {
    expect(montage).not.toContain(guessed);
  }
  // And the dictionary is exactly the api's five: the two names the waiting screen had of its own
  // («story», «cut») went with it, so one stage cannot be spelled two ways any more.
  for (const set of [en, ru]) {
    expect(Object.keys(set.montage.stage)).toEqual([
      'screening',
      'understanding',
      'directing',
      'rhythm',
      'assembly',
    ]);
  }
});

test('a card still being made is the second road onto the montage being watched', () => {
  // TASK-169, spec 7.6: that screen existed from TASK-163 with exactly one way in — having just
  // placed the order. A card saying «Собирается» in the list did nothing under a finger, so anybody
  // who walked out of the waiting, or came back to the app an hour later, could not get back to
  // where the making had got to.
  expect(films).toContain('beingMade(montage.status)');
  expect(films).toContain('() => watchMaking(montage)');
  const leads = films.slice(films.indexOf('const watchMaking'));
  const road = leads.slice(0, leads.indexOf('});'));
  // A push and not a replace: the face is what that screen's own `back()` comes home to.
  expect(road).toContain('router.push({');
  expect(road).toContain("pathname: '/memory/[id]/montage/[montageId]',");
  expect(road).toContain('params: { id, montageId: montage.id },');
  // Neither road carries anything of its own: the screen at the end of both reads the montage, the
  // memory and the journal for itself, so what it says does not depend on how somebody got there.
  expect(road).not.toContain('frames');
  expect(live).not.toContain('frames?: string;');

  // The other two states keep their own roads: a finished montage has a page of its own since
  // TASK-222 — spec 7.6 gives the whole card to that press, and it is the journal of how it was cut
  // that made the page necessary — and a fallen one is started again from its own button.
  expect(films).toContain('() => openFilm(montage)');
  expect(films).toContain('onPress={() => void retry(montage)}');
  // And the kit is what makes that true: without a press handed over, the card is not a button and
  // takes no finger at all.
  expect(cardMontage).toContain('if (!onPress) return <View');
  expect(cardMontage).toContain('accessibilityRole="button"');
});

test('the montage being watched is read through the journal’s own hook and nothing else', () => {
  // TASK-220 holds the whole of the reading — the poll, the cursor, what a broken connection does —
  // so this screen keeps no clock of its own. The three reads it does make are the things the
  // journal does not carry: who is watching it, what was ordered, and who the authors are by name.
  expect(live).toContain('useMontageJournal(token, id, montageId)');
  expect(live).not.toContain('setInterval');
  for (const read of ['listMemories(token)', 'listMontages(token, id)', 'listMembers(token, id)']) {
    expect(live).toContain(read);
  }

  // Ready while somebody sat here watching: the reward is the video, and it is watched where it
  // lies. One place says so, which is the line TASK-222 repoints at «Ролик готов».
  expect(live).toContain("if (journal.status === 'ready') leave();");
  expect(live).toContain("router.replace({ pathname: '/memory/[id]', params: { id } });");
});

test('the four standings of a montage on air are four different screens', () => {
  // In the queue with nothing in hand — and the first answer not yet landed, which is a different
  // wait and says so rather than promising a queue nobody has confirmed; nor does a worker still
  // fetching the material before its first frame, which is making it and not queueing.
  expect(live).toContain("journal.status === 'queued'");
  expect(live).toContain('s.montage.live.inQueue');
  expect(live).toContain('journal.status === null');
  expect(live).toContain('s.state.loading');
  expect(live).toContain(': s.montage.status.processing');

  // The connection went: what was read stays exactly where it is and one line stands under it.
  expect(live).toContain("journal.standing === 'offline'");
  expect(live).toContain('s.montage.live.lost');
  expect(live).toContain('<Spinner size={16} />');

  // It fell over: the card goes only when there is no frame left to hold, and the stage that broke
  // is what says where.
  expect(live).toContain("const failed = journal.standing === 'failed';");
  expect(live).toContain('{held === null && failed ? null : (');
  expect(live).toContain('{failed && montage?.error_text ? (');

  // And the thing chief struck off this screen: there is no «Сообщить, когда будет готово» on it,
  // because the notification goes to every member anyway (decision noted on TASK-221).
  for (const absent of ['<Toggle', 'Switch', 'notify']) expect(live).not.toContain(absent);
});

test('only the organizer starts a fallen montage again', () => {
  // doc-03 gives the montage to the organizer, and the api answers 403 to anybody else — so the
  // button is not drawn for them rather than drawn and refused.
  expect(live).toContain("failed && memory?.role === 'organizer' ?");
  expect(live).toContain('label={s.montage.live.retry}');
  expect(live).toContain('retryMontage(token, id, montageId)');
  // The two answers a second press can get, said in words rather than as a status.
  expect(live).toContain('409: s.montage.movedOn');
  expect(live).toContain('403: s.montage.retryDenied');
  // Queued again — by this press or an earlier one (409) — the fallen attempt's journal is gone on
  // the api, and the hook polls nothing at `failed`: the journal starts over, or the screen would
  // stay «не собрался» with the button still under it.
  const again = live.slice(live.indexOf('async function again()'));
  expect(again).toContain('journal.restart();');
  expect(again).toContain("if (!(e instanceof ApiError && e.status === 409)) return;");
  // Where each stage stands is the api's own word, never this screen's reading of the montage — and
  // it is worked out in the journal's own module, because the finished film's page asks the same
  // question of the same five rows (TASK-222).
  expect(stageRows).toContain('state={stageStanding(row)}');
  expect(journalOf).toContain(
    "if (stage === undefined || stage.state === 'pending') return 'waiting';",
  );
});

test('the open stage carries its last records and the way into the whole of its journal', () => {
  expect(stageRows).toContain('const last = lastOfStage(journal.entries, code);');
  expect(stageRows).toContain('open={opens(code) && last.length > 0}');
  expect(live).toContain('opens={(code) => code === stage?.stage}');
  expect(stageRows).toContain('<StepNote');
  expect(stageRows).toContain('label={s.montage.live.wholeStage(recordsOf(row))}');
  // Both roads out of a stage row go to the same place — the stage's own journal.
  expect(stageRows.match(/pathname: '\/memory\/\[id\]\/montage\/\[montageId\]\/stage\/\[stage\]'/g))
    .toHaveLength(1);
  expect(stageRows.match(/onPress=\{\(\) => toStage\(code\)\}/g)).toHaveLength(2);
  expect(stageRows).toContain('params: { id: memoryId, montageId, stage: code },');
});

test('the stage journal is one stage’s records, cut the way the api counts them', () => {
  // Narrowed at the source and not filtered on arrival: the screen scrolls one stage's journal, so
  // the api is asked for one stage's journal.
  expect(stageLog).toContain('useMontageJournal(token, id, montageId, { stage: code })');
  expect(stageLog).toContain('sifted(journal.entries, sift)');
  for (const chip of ['all', 'thoughts', 'took', 'skip']) {
    expect(stageLog).toContain(`s.montage.live.${chip}`);
  }
  // The counts on the chips are the api's tally over the whole stage, not over the page on screen.
  expect(stageLog).toContain('count={row ? String(row.taken_count) : undefined}');
  expect(stageLog).toContain('count={row ? String(row.skipped_count) : undefined}');

  // Hundreds of records: a windowed list, paged backwards by cursor as it is scrolled, and a record
  // landing on top does not move what somebody is reading.
  expect(stageLog).toContain('<FlatList');
  expect(stageLog).toContain('maintainVisibleContentPosition={{ minIndexForVisible: 1');
  expect(stageLog).toContain('journal.loadOlder();');
  // Only the freshest record is still being said — the rest of a page stands there finished.
  expect(stageLog).toContain('newest={index === 0}');
  // Empty is «loading» until the first answer and nothing after it: rhythm and assembly write no
  // records at all, and a finished film's stage is not waiting for any queue.
  expect(stageLog).toContain('journal.status === null ? <Text role="note">{s.state.loading}</Text> : null');
  expect(stageLog).not.toContain('s.montage.live.inQueue');
});

test('a record about a file opens that file’s card, and a deleted file is still a record', () => {
  expect(stageLog).toContain('onPress={() => setOpened(item.id)}');
  expect(stageLog).toContain('<SheetLiveFile');
  // A file that has gone leaves the record without a picture and the sheet without one — the api
  // says in as many words that this is not an error.
  expect(stageLog).toContain('uri={file?.thumbnail_url ?? undefined}');
  expect(liveFile).toContain('uri={file?.thumbnail_url ?? undefined}');
  expect(liveFile).toContain('{file === undefined ? author : s.media[file.kind]}');

  // Its own component, because the finished montage raises the same card off the same journal
  // (TASK-222) — so it is handed a record and a file and reads nothing for itself.
  expect(liveFile).toContain('export function SheetLiveFile');
  expect(liveFile).toContain('entry: JournalEntry;');
  expect(liveFile).toContain('file?: JournalFile;');
  for (const reading of ['listMembers', 'listMontages', 'useMontageJournal']) {
    expect(liveFile).not.toContain(reading);
  }
  // The thought is drawn whatever was decided — a frame the director left out («мимо», `left_out`)
  // carries its words about why in it — on the journal, under the stage row and on the sheet.
  expect(stageLog).toContain('useTypedThought(entry.thought, now)');
  expect(stageRows).toContain("text={entry.thought ?? ''}");
  expect(liveFile).toContain('<NoteThought text={entry.thought} outcome={outcomeLine(entry, file, s)} />');
  // «Что увидел» in tags, and under the thought where the frame ended up.
  expect(liveFile).toContain('s.montage.live.saw.toUpperCase()');
  // Keyed by place: the words are the model's, and the same one twice is two tags, not one key.
  expect(liveFile).toContain('<Tag key={at} label={label} />');
  expect(liveFile).toContain('outcome={outcomeLine(entry, file, s)}');
});

/**
 * `MontageLiveDone` (TASK-222) — the finished film's own page: the reward at the top of it and the
 * whole of how it came about under that. The journal does not disappear with the making of it, and
 * these pin the two things that would quietly undo that promise — a road in that leads somewhere
 * else, and a screen that treats a film without a journal as a film with a broken one.
 */
test('a finished film has a page of its own, and it is where the film is watched', () => {
  expect(layout).toContain('name="memory/[id]/montage/[montageId]/done"');
  expect(layout.indexOf('name="memory/[id]/montage/[montageId]/done"')).toBeLessThan(
    layout.indexOf('</Stack.Protected>'),
  );

  // The bar of the live screen with nothing left to watch: the name of the film and what the making
  // of it took, and no pill of people watching (spec 7.6 — «живая шапка без пилюли»).
  expect(done).toContain('variant="live"');
  expect(done).toContain('title={s.montage.live.doneTitle}');
  expect(done).toContain('s.montage.live.madeIn(made)');
  expect(done).not.toContain('WatchingPill');

  // The poster is the card the kit draws at 196 with the play circle in it, and the press raises the
  // one player this product has — the same window the strip on the feed raises.
  expect(done).toContain('<CardMontage');
  expect(done).toContain('large');
  expect(done).toContain('onPress={film === null ? undefined : () => setPlaying(true)}');
  expect(done).toContain('<FilmPlayer');
  expect(done).not.toContain('useVideoPlayer');
  expect(done).not.toContain('<Modal');
  expect(player).toContain('export function FilmPlayer');
  // «2:30 · 16:9» along the bottom of it, out of what the worker made and what was ordered.
  expect(done).toContain("RATIO[montage.params.orientation ?? 'landscape']");

  // The two buttons under it are the actions the player's own button is made of, and they are
  // nobody's alone: whoever brought material gets the film back, a viewer included.
  expect(done).toContain('label={s.action.save}');
  expect(done).toContain('label={s.action.share}');
  expect(done).toContain("void run(film, 'save')");
  expect(done).toContain("void run(film, 'share')");
  expect(player).toContain('export function useFilmActions');
  // «Сохранить и поделиться» hands the file to the phone's sheet through `@/downloads` like every
  // other share: React Native's own `Share` drops the file on Android and sends the line alone.
  expect(player).toContain("await (what === 'both' ? saveAndShare : saveToPhone)(file);");
  expect(player).not.toContain('Share.share');
  expect(done).not.toContain("role === 'organizer'");
});

test('«Как собирался» is the journal the film keeps, and a film without one is not an error', () => {
  // The three numbers and where each comes from are the journal module's (`howMade`), so the screen
  // draws what it is handed rather than reading five outcomes for itself.
  expect(done).toContain('const tiles = howMade(journal.stages, s);');
  expect(done).toContain('<TileNumber');
  expect(done).toContain('figure={String(tile.figure)}');
  expect(done).toContain('{s.montage.live.howMade}');
  expect(done).toContain('const made = madeInMinutes(journal.stages);');

  // All five rows, and each of them still opens its own journal — that is the whole promise of the
  // journal staying: any member can read any stage, a week later as much as a minute later.
  expect(done).toContain('<StageRows');
  expect(done).toContain('opens={() => true}');
  expect(stageRows).toContain('meta={row && stageLine(row, s)}');
  // And a record with a frame on it opens that frame's card, the way the stage's own journal does.
  expect(done).toContain('onRecord={(entry) => setOpened(entry.id)}');
  expect(stageRows.replace(/\s+/g, ' ')).toContain(
    'onRecord && entry.media_id !== null ? () => onRecord(entry) : undefined',
  );
  expect(live).not.toContain('onRecord');
  expect(done).toContain('<SheetLiveFile');

  // A film cut before the journal existed answers with no stages at all (api README), and then the
  // whole block is simply not drawn — no heading, no empty tiles, and nothing that reads as broken.
  expect(done).toContain('{journal.stages.length === 0 ? null : (');
  expect(done).toContain('{tiles.length === 0 ? null : (');
});

test('the montage that turns ready leads to its own page and never back into the making', () => {
  // The live screen's one way out: «Назад» while it is still being cut, and the film's page the
  // moment it is not. A `replace` — what is over is not something to come back to.
  expect(live).toContain("if (journal.status === 'ready') {");
  expect(live).toContain("pathname: '/memory/[id]/montage/[montageId]/done',");
  expect(live).toContain('router.replace({');
  expect(live).toContain("if (journal.status === 'ready') leave();");

  // And the card in the strip is the other road to the same page — the one anybody takes a week
  // later. A push, because the memory under it is what «Назад» comes home to.
  const leads = films.slice(films.indexOf('const openFilm'));
  const road = leads.slice(0, leads.indexOf('});'));
  expect(road).toContain('router.push({');
  expect(road).toContain("pathname: '/memory/[id]/montage/[montageId]/done',");
  expect(road).toContain('params: { id, montageId: montage.id },');
  // The other road to the player is untouched: a frame's own sheet names a film on the way in, and
  // it is still the memory's route that raises the window over the feed (TASK-211).
  expect(films).toContain("const { montage: asked } = useLocalSearchParams<{ montage?: string }>();");
  expect(films).toContain('<FilmPlayer film={watching} memory={memory} onClose={() => setPlaying(null)} />');
});

test('a card still being cut says which of the five stages it is on', () => {
  // TASK-223 put the stages on the list itself, so the strip draws «3 из 5» and five bars without
  // opening anybody's journal. `null` is a finished film and one the worker has not opened yet —
  // neither has a scale to draw.
  expect(api).toContain('stages?: MontageStep[] | null;');
  expect(films).toContain("montage.stages?.filter((stage) => stage.state === 'done').length ?? null");
  expect(films).toContain('{ done, of: STAGE_COUNT, count: s.montage.live.doneOf(done, STAGE_COUNT) }');
  expect(ru.montage.live.doneOf(3, 5)).toBe('3 из 5');
  // The count and the scale read the one number, so the card cannot say «3» and paint four.
  expect(cardMontage).toContain('{step ? <StageScale done={step.done} of={step.of} /> : null}');
  expect(cardMontage).toContain('{step.count}');
});

test('the waiting does not move the app once the person has walked out of it', () => {
  // Found in review, m-23: `useRouter` hands back the app's own router and not the screen's, so a
  // call still in flight when somebody left went on to move whoever was on top of it. Reset on the
  // way in as well as set on the way out: a remount is a screen that is here again. The wizard's
  // own half of this rule is in `order-screens.test.ts`.
  expect(live).toContain('const gone = useRef(false);');
  expect(live).toContain('gone.current = false;');
  expect(live).toContain('gone.current = true;');

  // And the live screen's one way out is called by the journal as well — a montage that turns
  // `ready` a moment after «Назад» was pressed — so it is guarded where it is written: a second
  // `back()` off an answer that landed late pops the memory out too.
  expect(live).toContain('const leave = useCallback(() => {\n    if (gone.current) return;');
});

test('a ready montage shows its own still, and one without a still keeps the placeholder', () => {
  // TASK-112: the card drew the kit's dark rectangle for every montage because nothing was ever
  // handed to it. The link is the api's, signed the same way the video is, and null is the ordinary
  // case — an older montage, or one still being cut. `?? undefined` is what keeps null out of the
  // prop, so `CardMontage` falls back to the very placeholder it drew before.
  expect(api).toContain('poster_url: string | null;');
  expect(films).toContain('poster={montage.poster_url ?? undefined}');
  expect(cardMontage).toContain('poster ? (');
  expect(cardMontage).toContain('source={{ uri: poster }}');
});

test('the montage’s card is the poster, and the still fills it', () => {
  // TASK-135 gave a standing montage a taller frame and TASK-178 made the card the video's own
  // shape; the new layout (spec 7.6) settles it differently again — the card is a fixed poster,
  // 232 × 148 in the strip and 196 across when it is the screen, and the shape of the film is said
  // in words on the order's own poster instead of being drawn by a card in a list. `cover` is what
  // fills it. Pinned here because the card's own test reads rendered markup, where the styles are
  // compiled-away hashes.
  expect(cardMontage).toContain('const CARD = { width: 232, height: 148 };');
  expect(cardMontage).toContain('const LARGE = 196;');
  expect(cardMontage).toContain('contentFit="cover"');
  // And a montage still being cut shows its own frame out of focus rather than no frame at all.
  expect(cardMontage).toContain('blurRadius={ready ? 0 : BLUR}');
});

test('the films face reads again by itself while a montage is being cut', () => {
  // What was reported: the order was placed, the card said «Собираем», the worker finished, and the
  // card went on saying it until the tabs were switched away and back — the face read on focus and
  // never once on its own. The condition for looking again is «is anything still owed by the
  // worker», and it is derived here rather than typed out: `MONTAGE_STATE` maps every status the
  // api has (the type is `Record<Montage['status'], …>`, so tsc keeps it whole), and the ones it
  // draws as pending are exactly the ones with news still to come. A fifth status added to the api
  // joins this test by joining that map.
  const mapAt = films.indexOf('const MONTAGE_STATE');
  const map = films.slice(mapAt, films.indexOf('};', mapAt));
  const pending = [...map.matchAll(/(\w+): '(\w+)'/g)]
    .filter(([, , state]) => state === 'pending')
    .map(([, status]) => status);
  expect(pending).toEqual(['queued', 'processing']);

  // The one-row question itself is `@/montage`'s since TASK-163 — the waiting screen asks it about
  // the montage it is watching, and the two must not drift apart about what «still being made»
  // means. Read where it lives; the face is pinned below on asking it rather than its own copy.
  const asksAt = montage.indexOf('export const beingMade');
  // On one line: where the expression wraps is the formatter's business, not this test's.
  const asking = montage.slice(asksAt, montage.indexOf(';', asksAt)).replace(/\s+/g, ' ');
  for (const status of pending) expect(asking).toContain(`'${status}'`);
  // And the two the worker is done with are not a reason to keep asking — a face left polling over
  // a finished list is the same bug the other way round, forever.
  for (const settled of ['ready', 'failed']) expect(asking).not.toContain(`'${settled}'`);
  expect(films).toContain('montages?.some((montage) => beingMade(montage.status))');
  // Nothing read yet is nothing to wait for: the first read is what starts the loop.
  expect(films.slice(films.indexOf('const stillMaking'))).toContain('?? false');

  // The loop itself: only while something is being cut, only while this face is the one in front,
  // and cleared when either stops being true.
  expect(films).toContain('const making = stillMaking(montages);');
  expect(films).toContain('const focused = useIsFocused();');
  expect(films).toContain('if (!making || !focused) return;');
  expect(films).toContain('setInterval(() => load(true), WHILE_MAKING_MS)');
  expect(films).toContain('return () => clearInterval(timer);');
  // Read quietly, the way the frames face reads on its own loop: a poll nobody asked for must not
  // put a banner over a list that is on screen and fine.
  expect(films).toContain('if (!quiet) setError(errorMessage(e));');
  // And the one press that reads out loud calls `load` instead of handing it over — a press handler
  // is given the touch event, which as `quiet` is truthy.
  expect(films).toContain('onPress={() => load()}');
  // The focus read stays: this loop is about the face nobody leaves, not a replacement for coming
  // back to one, and the signed urls still die in a quarter of an hour.
  expect(films).toMatch(/useFocusEffect\(\s*useCallback\(\(\) => \{\s*load\(\);/);

  // And what the quiet read may replace, found in review. Twice over the api signs every link
  // afresh on every answer, so a row that has not moved still comes back with a new `video_url`:
  // `expo-video` builds a new player for a new url, which started the montage somebody was watching
  // over again every five seconds. Same guard the frames face has had since TASK-119, same helper.
  expect(films).toContain('setMontages((have) => (quiet ? keepReady(have, list) : list));');
  // And a read already in flight when this face writes the list itself — the order that prepends a
  // row, the retry that requeues one — must not put the api's older snapshot back over it: the card
  // would vanish, and with nothing pending left in that snapshot the loop above would clear itself
  // and never read again.
  expect(films).toContain('if (quiet && writes.current !== startedAt) return;');
  // One write of its own left since TASK-162 — the retry that requeues a row. The order that used
  // to prepend one happens on a screen of its own now, and this face meets its answer through the
  // read on focus like any other change.
  expect(films.match(/writes\.current \+= 1;/g)).toHaveLength(1);
});

test('a quiet read in flight never puts an older feed back over one this screen has just written', () => {
  // The frames face writes its own list three ways — a run of deletes, the one frame the window
  // deletes, a label filed — and every one of them is newer than a read that started before it. Left
  // alone, that read brought a deleted frame back, and with nothing developing in its snapshot the
  // loop that re-reads stopped, so the ghost stood there until somebody pulled. The films strip has
  // had this guard since TASK-125.
  expect(frames).toContain('const startedAt = writes.current;');
  expect(frames).toContain('if (quiet && writes.current !== startedAt) return;');
  expect(frames.match(/writes\.current \+= 1;/g)).toHaveLength(3);
});

test('the way out of a played montage is the kit’s own button, across the foot of the window', () => {
  // TASK-177, off a device: «Закрыть» stood quiet in the left corner of the bar and read as a line
  // of text rather than as anything the app draws. Spec 7.2 gives that word the outlined button —
  // the same one the frame's sheet and the consent wear — and the bar's own width is what puts it
  // in the middle of the bottom.
  expect(player).toContain('<Button label={s.action.close} onPress={onClose} />');
});

test('the material of a memory has one name — on the card, on the switch, over the sheet', () => {
  // «N frames» on the card, «Photos and videos (N)» on the guest list, «Gallery» over the contact
  // sheet was the report (TASK-76). One key answers all of them, and it is the heading over the
  // material on the feed.
  expect(frames).toContain('title={s.memory.framesPlain}');
  expect(home).toContain('s.home.noFrames');
  for (const set of [en, ru]) {
    // «0 кадров» → «кадров», which is what «Кадров пока нет» has to be built on too. Russian
    // declines it, so the counted form is the one both lines are held against.
    expect(set.home.noFrames.toLowerCase()).toContain(set.memory.frames(0).split(' ')[1]);
  }
});

/**
 * The open frame (TASK-147, rebuilt to the «Афиша» layout in TASK-211): `Viewer`, `ViewerVideo`,
 * `SheetFrame` and `SheetFrameInfo` of spec 8, in a file of their own — «во весь экран, без кнопок
 * снизу, а снизу лента» is what was asked for, and a shape is what these pin. What the strip does
 * with a finger lives in the library now and is read there; everything the gallery decides about a
 * record is pinned in `frames.test.ts`.
 */

test('the whole window is three buttons on glass, and under the picture only the strip', () => {
  // Spec 8, `Viewer`: «сверху три стеклянные кнопки … снизу плёнка 48», and nothing else. The row
  // of four round buttons that used to stand under the strip is gone with the layout that had it —
  // what was in it is the menu the «⋯» drops and the sheet the pill raises.
  expect(viewer).toContain('<ViewerBar');
  expect(viewer).not.toContain('<ActionBar');
  expect(viewer).not.toContain('styles.actions');
  // TASK-109's darkening went with the bar it was under: the glass carries these now, and a
  // gradient measured off the safe area has nothing left to darken.
  expect(viewer).not.toContain('linear-gradient');
  // The order down the window, spec 8: the scrubber on a line of its own, then the strip, and the
  // strip is the last thing in the window.
  const strip = viewer.indexOf('<Filmstrip');
  expect(viewer.indexOf('<VideoTrack')).toBeLessThan(strip);
  expect(strip).toBeLessThan(viewer.indexOf('<ActionMenu'));
  // The three of them, each in its own place: «Назад» on the left, the pill of when and who in the
  // middle, «⋯» on the right — and no fourth.
  const bar = viewer.slice(viewer.indexOf('<ViewerBar'), viewer.indexOf('<View style={[styles.tools'));
  expect(bar.slice(bar.indexOf('left={'))).toContain('label={s.action.close}');
  expect(bar.slice(bar.indexOf('right={'))).toContain('label={s.viewer.more}');
  expect(bar).toContain('label={`${s.viewer.details}');
  expect(bar.match(/<IconButton/g)).toHaveLength(2);
});

test('the pill of when and who is the road to the frame’s own sheet', () => {
  // Spec 8: «капсула с датой и „время · автор“», and it leads to `SheetFrameInfo`. The stamp is the
  // gallery's own reading of when a frame happened — the same one its heading in the feed is under
  // — and never the memory's span, which is what the pill used to carry.
  expect(viewer).toContain('const stamp = new Date(shotAt(item));');
  expect(viewer).toContain('const when = formatDayShort(stamp);');
  expect(viewer).toContain("const meta = [formatTime(stamp), who].filter(Boolean).join(' · ');");
  expect(viewer).toContain('onPress={openInfo}');
  // One piece of state behind the sheet, and one read behind that — asked for by the pill and by
  // nothing else, because the window opens on a picture and this is the half nobody asked about.
  expect(viewer.match(/setDetails\(true\)/g)).toHaveLength(1);
  expect(viewer).toContain('fetchFrameInfo(token, memoryId, item.id)');
  // And only the latest opening may answer into it: a read that lands after the sheet was shut and
  // raised again — on another frame, or on this one — would fill the open sheet with the frame
  // before it, or lay the failure of the first read over the details the second one brought.
  expect(viewer).toContain('const mine = ++opening.current;');
  expect(viewer).toContain('if (opening.current === mine) setInfo(read);');
  expect(viewer).toContain('if (opening.current === mine) setInfoFailed(errorMessage(e));');
  expect(ru.viewer.details).toBe('Сведения о кадре');
});

test('the «⋯» drops the glass menu of the three errands, and stays lit under it', () => {
  // Spec 7.1, detail 9: the menu falls out of the button rather than rising from the bottom, the
  // button it fell out of stays visible and lit, and the dangerous line is cut off from the two
  // above it. «Удалить» deletes nothing itself — it hands the window to the sheet that names the
  // price, exactly as the old sheet did.
  const menu = viewer.slice(viewer.indexOf('<ActionMenu'), viewer.indexOf('</ActionMenu>'));
  const order = [
    'label={s.action.share}',
    'label={s.viewer.saveToPhone}',
    'label={s.viewer.remove}',
  ].map((label) => menu.indexOf(label));
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(order[0]).toBeGreaterThan(-1);
  expect(menu).toContain('gapBefore={2}');
  expect(menu.replace(/\s+/g, ' ')).toContain('danger onPress={() => { setMenu(false); setConfirming(true); }}');
  expect(viewer).toContain('style={menu ? styles.held : null}');
  expect(viewer).toContain('held: { backgroundColor: photo.held }');
  // The words are the layout's own, and the delete is the only red line in the menu.
  expect(ru.viewer.remove).toBe('Удалить из воспоминания');
  expect(ru.viewer.saveToPhone).toBe('Сохранить на телефон');
});

test('nobody who may not delete is shown a delete, greyed or otherwise', () => {
  // The line is absent for them rather than disabled — it was so in the sheet this menu replaced,
  // and the api is the authority either way: the face decides ownership, the window draws it.
  const menu = viewer.slice(viewer.indexOf('<ActionMenu'), viewer.indexOf('</ActionMenu>'));
  expect(menu).toContain('{mayDelete(item) ? (');
  expect(menu).toContain('  ) : null}');
});

test('the frame’s own sheet is who, when, what and where — and draws nothing it was not told', () => {
  // Spec 8, `SheetFrameInfo`: the head is known off the frame already (thumbnail, «13 сентября,
  // 21:47», «суббота · Свадьба Лизы и Марка»), the rest arrives with one read.
  const raised = viewer.slice(viewer.indexOf('<FrameInfoSheet'));
  expect(raised).toContain('thumb={item.thumbnail_url ?? undefined}');
  expect(raised).toContain('title={`${when}, ${formatTime(stamp)}`}');
  expect(raised).toContain("meta={[formatWeekday(stamp), memory?.title].filter(Boolean).join(' · ')}");
  const sheet = sheets.slice(sheets.indexOf('export function FrameInfoSheet'));
  // Who brought it and how much they brought in all, then the summary rows, then the movies.
  expect(sheet).toContain('s.viewer.brought(formatDayShort(info.created_at), info.uploaded_by.media_count)');
  expect(sheet.indexOf('frameFacts(info, s, undefined, place)')).toBeLessThan(sheet.indexOf('s.viewer.inFilms'));
  // The place is the name the phone's geocoder gives the frame's point, asked for by the sheet
  // itself (`@/geocoder`) — the api sends coordinates only.
  expect(sheet).toContain('usePlaceName(info?.latitude, info?.longitude)');
  // «Только смотреть»: not one control on it, and no way out but the ways every sheet has.
  expect(sheet).not.toContain('<Button');
  expect(sheet).not.toContain('<RowAction');
  // A frame in no movie at all loses the block, not just its rows.
  expect(sheet).toContain('{info.montages.length === 0 ? null : (');
  expect(ru.viewer.brought('15 сентября', 96)).toBe('принёс 15 сентября · всего 96 кадров');
});

test('a movie the frame stands in is named by its length and opens the one player there is', () => {
  const sheet = sheets.slice(sheets.indexOf('export function FrameInfoSheet'));
  // «Ролик на 1:00» out of the length, because a montage has no name until templates arrive; the
  // second it stands at is the right-hand half of the same row (spec 7.7, detail 62).
  expect(sheet).toContain('title={runtime ? s.montage.ofLength(runtime) : s.montage.count(1)}');
  expect(sheet).toContain("at={s.viewer.at(formatRuntime(film.start_seconds) ?? '')}");
  expect(ru.viewer.at('1:12')).toBe('на 1:12');
  expect(ru.montage.ofLength('1:00')).toBe('Ролик на 1:00');
  // One frame may stand in one montage twice — the api's own key is the pair, and so is this one.
  expect(sheet).toContain('key={`${film.id}:${film.start_seconds}`}');
  // And the row opens the player the movies face already has: no second player is drawn for a
  // frame (chief, 21.09.2026). The ask is set on the screen this window is a part of — a push to
  // the same route would stack a second feed of the memory under the film — and only once the
  // window is gone: the player is a `Modal` too, and iOS swallows one raised while another is still
  // being dismissed. So the window is shut and not unmounted, says when it is gone, and Android,
  // which has no such event, goes on at once.
  const shut = viewer.replace(/\s+/g, ' ');
  expect(shut).toContain(
    "function openFilm(montageId: string) { setDetails(false); setFilm(montageId); if (Platform.OS !== 'ios') raiseFilm(montageId); }",
  );
  expect(shut).toContain(
    'function raiseFilm(montageId: string) { onClose(); router.setParams({ montage: montageId }); }',
  );
  expect(shut).toContain('visible={film === null}');
  expect(shut).toContain('onDismiss={() => { if (film !== null) raiseFilm(film); }}');
  expect(films).toContain("const { montage: asked } = useLocalSearchParams<{ montage?: string }>();");
  // The block is already mounted when the ask arrives, so it follows the parameter rather than
  // reading it once as it mounts — and spends it, or the switch back onto this face would raise
  // the player again and the same film could not be asked for twice.
  const ask = films.replace(/\s+/g, ' ');
  expect(ask).toContain('useState<string | null>(null)');
  expect(ask).toContain(
    "useEffect(() => { if (!asked) return; setPlaying(asked); router.setParams({ montage: '' }); }, [asked, router]);",
  );
});

test('a frame that would not open says so, and the strip stays where it is', () => {
  // Spec 8, the edge of `Viewer`: «знак image и „Кадр не открылся“, плёнка остаётся». The sign is
  // inside the stage, so everything under it — the scrubber, the strip — is untouched.
  const stage = viewer.slice(viewer.indexOf('<View style={[styles.big, styles.blank]}>'));
  expect(stage).toContain('<Empty icon={ImageSign} text={s.viewer.notOpened} />');
  expect(viewer.indexOf('styles.blank')).toBeLessThan(viewer.indexOf('<Filmstrip'));
  expect(ru.viewer.notOpened).toBe('Кадр не открылся');
});

test('the window is a dark room, and the sheets over it are in the theme the app is in', () => {
  // The window itself is pinned dark in both themes — the layout gives it a background darker than
  // `ink` on purpose. The menu is inside the pin, because it stands on the photograph; both sheets
  // are outside it, because a sheet is its own surface and daylight has to reach it (спека 2, «день
  // подстановкой»). Nothing here names a colour of its own: every one of them is a token.
  expect(viewer).toContain('<ThemePin value="dark">');
  const pinned = viewer.indexOf('</ThemePin>');
  expect(viewer.indexOf('<ActionMenu')).toBeLessThan(pinned);
  expect(pinned).toBeLessThan(viewer.indexOf('<FrameInfoSheet'));
  expect(pinned).toBeLessThan(viewer.indexOf('<ConfirmSheet'));
  for (const file of [viewer, sheets]) expect(file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});

test('a video carries a transport and a photo carries none of it', () => {
  // `ViewerVideo` is the same window plus three things (spec 8): the 72 button in the middle of the
  // picture, the scrubber on a line of its own over the strip, and the sound. All three hang on the
  // same question — whether there is a playable file — so a photograph cannot grow half a transport.
  for (const part of [
    '<VideoTrack',
    'icon={isPlaying ? Pause : Play}',
    'icon={isMuted ? VolumeX : Volume2}',
  ]) {
    expect(viewer).toContain(part);
  }
  // Two branches and not three: the button shares the picture's own box, so it comes and goes with
  // it (TASK-181). The scrubber is the other one.
  expect(viewer.match(/playable !== null \? \(/g)).toHaveLength(2);
  // And the platform's own transport is off: this window draws its own, and two sets of controls
  // over one video is what the layout is written against.
  expect(viewer).toContain('nativeControls={false}');
  // The length is the api's first — known before a byte of the file arrives — and the player's only
  // as the fallback for a record that came without one.
  expect(viewer).toContain('const runs = item.duration_seconds ?? player.duration;');
  // And what the transport shows is read off the player, with the events only asking for a redraw:
  // `useEvent` keeps the last payload it was handed even once the player under it has been replaced,
  // so walking from one video to the next would otherwise draw the one before it.
  expect(viewer).toContain('const isPlaying = player.playing;');
  expect(viewer).toContain('const at = player.currentTime;');
});

test('the 72 stands in the middle of the picture and on the glass every button over one wears', () => {
  // Both reported off a device (TASK-181). The button hung visibly above the middle of the frame
  // and read as a dark plate, and each had its own cause: it was centred over the whole stage,
  // whose top padding is the floating bar's own 116, and it wore `photo.mark` — the 72 % plate a
  // mark in the corner of a tile sits on, which over a whole photograph is a hole in it.
  const stage = viewer.slice(viewer.indexOf('{playable !== null ? ('), viewer.indexOf('{notice ?'));
  // One box holds the picture and the button, and it is the box the stage's padding is already out
  // of — so the middle of the one is the middle of the other.
  expect(stage).toContain('<View style={styles.big}>');
  expect(stage.indexOf('<VideoView')).toBeLessThan(stage.indexOf('styles.middleOfFrame'));
  expect(viewer).toContain('...StyleSheet.absoluteFill,');
  // 72 and glass: the layout's own size, and the fill the «Закрыть», «Ещё» and «Поделиться» of this
  // same window already stand on. The plate is gone, and with it the last `photo.mark` here.
  expect(stage).toContain('size={72}');
  expect(stage).toContain('tone="viewer"');
  expect(viewer).not.toContain('photo.mark');
});

test('the film can be wound, and only while there is a length to wind it against', () => {
  // «Видео нельзя перемотать» off a device (TASK-181): the bar reported and took no finger at all.
  const track = viewer.slice(viewer.indexOf('<VideoTrack'), viewer.indexOf('<Filmstrip'));
  expect(track.replace(/\s+/g, ' ')).toContain(
    'onSeek={ runs > 0 ? (to) => { player.currentTime = to * runs; } : undefined }',
  );
});

test('the picture is walked with a finger, and the finger is taken on the picture alone', () => {
  // TASK-182, and the whole lesson of TASK-123 in one line: this window never had the gesture at
  // all — «над кадром стоит одиночный Image, а не пейджер». The other two sideways things on the
  // screen, the strip and the scrubber, each stand on a line of their own and must never see it.
  const swipe = viewer.slice(viewer.indexOf('const swipe = useMemo('));
  expect(viewer.match(/\{\.\.\.swipe\.panHandlers\}/g)).toHaveLength(1);
  expect(viewer.indexOf('{...swipe.panHandlers}')).toBeLessThan(viewer.indexOf('<VideoTrack'));
  // A tap belongs to whatever is under it; the walk asks for the finger only once it has plainly
  // gone sideways, and by capture — so a swipe begun on the pause button is still a swipe.
  expect(swipe).toContain('onStartShouldSetPanResponderCapture: () => false');
  expect(swipe).toContain('Math.abs(g.dx) > SIDEWAYS && Math.abs(g.dx) > Math.abs(g.dy)');
  // Left is the next frame of the sheet, right the one before it.
  expect(swipe).toContain('step.current(g.dx < 0 ? 1 : -1);');
  // And built once, never per render (found in review): `PanResponder` keeps how far the finger
  // has come inside the object `create` returns, and a playing video re-renders this window four
  // times a second — a responder made afresh under a finger starts counting from nothing, and both
  // thresholds above end up measured against a scrap of the swipe. The walk worked on photographs
  // and failed on video, which is «не листается» for the third time. What moves between renders is
  // read through a ref instead.
  expect(swipe).toContain('PanResponder.create({');
  expect(swipe).toMatch(/\}\),\s*\[\],\s*\);/);
  expect(viewer).toContain('const step = useRef(stride);');
  // One rule about what opens, for the finger and for the strip alike — so photographs and videos
  // walk the same way whichever of the two asked, and the strip follows the frame in hand. The two
  // differ on one thing only: a tap names a frame and is refused when that frame cannot open,
  // while a finger names a direction and carries on past it rather than hitting a wall.
  expect(viewer).toContain('onPick={walk}');
  expect(viewer.match(/if \(next && mayOpen\(next\)\) onOpen\(next\.id\);/g)).toHaveLength(1);
  expect(viewer.replace(/\s+/g, ' ')).toContain(
    'for (let to = index + by; to >= 0 && to < frames.length; to += by) ' +
      '{ if (mayOpen(frames[to])) return onOpen(frames[to].id); }',
  );
  expect(viewer).toContain('const index = frameIndex(frames, item.id);');
  expect(viewer).toContain('index={index}');
});

test("the strip under the frame is the grid's own list, in the grid's own order, read once", () => {
  // The whole list and not a window on it, and the strip has to read in the direction the sheet
  // above it does — which stopped being the plain `items` the moment TASK-121 cut the sheet into
  // days (found in review). The api sends the oldest frame first and a sheet is read newest day
  // down, so the tile at the top left of the grid was the one at the far end of the strip, and
  // walking the strip forward walked the sheet backwards. Both are now cut from the same `rows`.
  expect(frames).toContain('rows.flatMap((row) => row.frames ?? [])');
  expect(frames).toContain('frames={sheet}');
  expect(frames).toContain('data={rows}');
  // One read of the media serves both the sheet and the strip.
  expect(frames.match(/listMedia\(/g)).toHaveLength(1);
  // And the library is handed that same list, picture for picture: the window invents no second
  // reading of a record — `@/frames` answers for both sheets (TASK-86, TASK-120).
  expect(viewer).toContain("frames.map((one) => ({ uri: frameOf(one).uri ?? '', video: one.kind === 'video' }))");
});

test('the strip is walked to the frame in hand, and the walk hangs on its own width', () => {
  // Three reports, one lesson, and it lives with the strip itself now (TASK-147).
  //
  // `initialScrollIndex` is the prop this obviously wants and the one that broke it: it pins the
  // render window on the frame it names until a scroll event arrives, and a strip short enough to
  // fit on screen never scrolls, so the event never comes (TASK-70).
  //
  // `onContentSizeChange` unlatched fires far too often — it is the scroll row's own `onLayout`, so
  // it came back every time a frame landed, and each one hauled the strip back from under the
  // finger (TASK-106). Latched to fire once it fired at the wrong moment: an iOS modal is laid out
  // twice, the first commit sized from `RCTScreenSize()` — which swaps width for height on the way
  // the phone is *physically* held — and the content of a horizontal strip is the same width
  // whatever its viewport, so the size of the content never changed between the two commits
  // (TASK-123).
  //
  // So neither: the walk hangs on the strip's own viewport, keyed on the width it was computed for.
  expect(filmstrip).not.toContain('initialScrollIndex={');
  expect(filmstrip).not.toContain('onContentSizeChange={');
  expect(filmstrip).toContain('onLayout={(e) => setViewport(e.nativeEvent.layout.width)}');
  expect(filmstrip).toContain(
    'strip.current?.scrollToIndex({ index, viewPosition: 0.5, animated: walked.current });',
  );
  // Centred, so the frame in hand lands where the eye already is; and `scrollToIndex` on a strip
  // this long is only safe because every tile is a known size.
  expect(filmstrip).toContain('getItemLayout=');
  // A memory holds up to a thousand records, and eleven of them are on screen: the strip is a
  // virtualised list and not a row holding every thumbnail the gallery has.
  expect(filmstrip).toContain('<FlatList');
  expect(filmstrip).not.toContain('<ScrollView');
});

test('neither the sheet nor the strip opens a frame that is still developing', () => {
  // The exact ternary and not just a call count: swapping which branch is `undefined` would still
  // match `mayOpen(item)` while opening exactly the records this gate exists to stop. This was the
  // bug fixed in review — a tap on a waiting frame opened a whole screen saying «Проявляем…», which
  // is what was reported.
  //
  // Read with the whitespace squeezed out: what is pinned is which branch opens a frame, and the
  // tile moved two levels deeper the day the sheet was cut into days (TASK-121) — a ternary held to
  // the column it happened to be formatted in fails on a reindentation that changed nothing.
  expect(frames.replace(/\s+/g, ' ')).toContain('mayOpen(item) ? () => setOpen(item.id)');
  // The strip hands back which frame was touched rather than a record, so the window is where the
  // same gate stands for it — the same question, asked of the same helper.
  expect(viewer.replace(/\s+/g, ' ')).toContain('if (next && mayOpen(next)) onOpen(next.id);');
});

test('the frame shown full screen is read for the phone, the tiles for a tile', () => {
  // `openFrameOf` and not `frameOf` (TASK-120): the tile's 640px thumbnail drawn over the whole of a
  // phone is the mush that was reported, so the window asks for the big derivative first. Not
  // `item.preview_url` read straight either — both readings carry the fallen-frame correction for a
  // `ready` record with nothing on it, which is the «could not be prepared» state rather than a
  // broken image, and only `openFrameOf` keeps the thumbnail as the fallback under it.
  expect(viewer).toContain('const shown = openFrameOf(item);');
  expect(viewer).toContain('<Image');
  expect(viewer).toContain('uri: shown.uri,');
  // The grid is the other reading, and it is the tile's own.
  expect(frames).toContain('const frame = frameOf(item);');
});

test('the open frame is kept on the phone, filed under the record and not under its signature', () => {
  // The frame opened a second time came down the wire a second time (TASK-137). React Native's own
  // `Image` has no disk behind it at all, and `expo-image` — already what every tile is drawn with —
  // has one by default. Both are spelled `<Image`, so what is pinned is where the name comes from.
  expect(viewer).toContain("import { Image } from 'expo-image';");
  expect(viewer).toContain('contentFit="contain"');
  expect(viewer).not.toContain('resizeMode="contain"');

  // What it is filed under has to be said outright. The api signs every link afresh on every read of
  // the gallery and each one lasts a quarter of an hour (`R2_DOWNLOAD_TTL_SECONDS`), so the same
  // bytes arrive under a new url every time — and `expo-image`'s own default key is the url. Left
  // alone, the disk would be full of one frame under a dozen names and every look a fresh download.
  expect(viewer).toContain('cacheKey: `${item.id}:');
  const key = viewer.slice(viewer.indexOf('cacheKey:'));
  expect(key.slice(0, key.indexOf('\n'))).not.toContain('${shown.uri}');
});

test('what expo-image keeps on disk has a ceiling, set once at startup and only where there is none', () => {
  // Unbounded on ios: SDWebImage, which `expo-image` is built on there, defaults `maxDiskSize` to 0
  // — keep everything for ever. 250MB, oldest out first, is what Glide gives android without being
  // asked, so the number is that one and the two platforms hold the same. Behind the platform test
  // and not called flat: android has no such method in its native module, and the call there would
  // be a crash on the way up.
  expect(layout.replace(/\s+/g, ' ')).toContain(
    "if (Platform.OS === 'ios') Image.configureCache({ maxDiskSize: 262144000 })",
  );
  // Once, and as the app comes up rather than when a screen mounts — beside the portrait lock, above
  // every component in the file.
  expect(layout.match(/configureCache/g)).toHaveLength(1);
  expect(layout.indexOf('configureCache')).toBeLessThan(layout.indexOf('export default function'));
});

// The contact sheet itself, measured by the designer (TASK-79): the last frame of a sheet came out
// 2pt wider than every frame above it, and the frame the strip had open came out smaller than its
// neighbours. Both are one question — how wide a column of the kit's sheet is — and both screens
// that draw a sheet have to answer it the same way.

test('every column of a contact sheet is the same width, the last row included', () => {
  for (const sheet of [frames, upload]) {
    // `flex: 1/3` divides what a row has left after its gaps, so a last row with one frame in it —
    // no gaps in it to leave — handed that frame a third of the whole row instead of a column.
    expect(sheet).not.toContain('flex: 1 / 3');
    // A column worked out from the width the sheet spans, and re-read when the phone turns. Which
    // gutter it is worked out of belongs to the lane the frames stand in (spec 7.8): the memory's
    // feed and the upload screen both run edge to edge, the wizard and the queue stand in 16.
    expect(sheet).toMatch(/(GRID_GAP|FEED_GAP) \* 2\) \/ 3/);
    // Both sheets of frames run edge to edge now (spec 7.8): the memory's feed and the phone's own
    // roll are the same wall of photographs, gutter 2 and no margins at all.
    expect(sheet).toContain('const cell = { width: (width - FEED_GAP * 2) / 3 };');
    expect(sheet).toContain('feed: { flexGrow: 1, gap: FEED_GAP }');
    expect(sheet).toContain('lane="feed"');
  }
  // And the other lane still exists for the wizard to stand in: inside the screen's 16, a hair
  // more air and a 4 radius, because there a frame is a thing being picked out of a list. Which
  // screens use it is their own business — the two gutters are the kit's, and it holds both.
  expect(tile).toContain('export const GRID_GAP = 3;');
  expect(tile).toContain('export const FEED_GAP = 2;');
});

test('the feed starts far enough down to clear the glass floating over it', () => {
  // 52 of status line (measured, not assumed), the bar's own 48 and 16 — which is the 116 the
  // layout draws the «Ролики» block at. Nothing is subtracted for the bar: it floats, so the feed
  // passes under it rather than starting below it.
  expect(frames).toContain('{ paddingTop: insets.top + height.roundViewer + space.s4 }');
  // And it runs under the bottom layer as well, with room left for that layer's own gradient.
  expect(frames).toContain('{ paddingBottom: board.footerGallery }');
  expect(bars).toContain('gallery: { height: board.footerGallery');
  // Spec 8: 22 between the films and the heading over the material, 10 down to the first row.
  expect(frames).toContain('framesHead: { marginTop: 22, marginBottom: 10 }');
});

/**
 * The two sheets the gallery is tuned from (TASK-144, `SheetFilter` and `SheetSort`): what is shown
 * and in what order. Their own file, because they are a second surface over this face and the face
 * already holds the open frame.
 */

test('the filter is a draft until it is applied, and it is applied by a button that counts', () => {
  // «Показать 486 кадров» — the number is worked out from the draft on the spot, so nobody applies
  // a filter without being told first what it comes to. The face owns the material and answers the
  // question; the sheet only asks it.
  expect(frames).toContain('count={(draft) => framesMatching(items ?? [], draft).length}');
  expect(sheets).toContain('const shown = count(draft);');
  expect(sheets).toContain(
    'shown === 0 ? s.gallery.nothingMatched : chosen ? s.gallery.show(shown) : s.gallery.showAll',
  );
  // A filter that would leave nothing cannot be applied at all, and the button says why rather than
  // offering «Показать 0 кадров»; nothing held back at all has no count to promise (spec 8).
  expect(sheets).toContain('disabled={shown === 0}');
  expect(ru.gallery.show(486)).toBe('Показать 486 кадров');
  expect(ru.gallery.showAll).toBe('Показать все');
  expect(ru.gallery.nothingMatched).toBe('Ни одного кадра под эти условия');
  // Seeded by being mounted: both sheets are drawn only while open, so the draft starts at whatever
  // is applied right now and a sheet closed any other way leaves the gallery as it was.
  expect(frames).toContain("{tuning === 'filter' ? (");
  expect(frames).toContain("{tuning === 'sort' ? (");
  expect(sheets).toContain('useState<Filter>(value)');
});

test('the day row opens with the absence of a choice, and the people row does not', () => {
  // «Все дни» is an empty set and not a value of its own, which is the whole reason a set is what
  // the filter holds. The people row has no such chip in the layout: a face is pressed off again,
  // and «Сбросить» is what clears the lot.
  expect(sheets).toContain('selected={draft.days.size === 0}');
  expect(sheets).toContain('onPress={() => setDraft((have) => ({ ...have, days: new Set() }))}');
  expect(sheets).not.toContain('people: new Set() }))}');
  expect(ru.gallery.anyDay).toBe('Все дни');
  // «Сбросить» stands small beside the heading and not under the main button (spec 8), and says by
  // being off that there is nothing to clear.
  expect(sheets).toContain('disabled={!chosen}');
  expect(sheets).toContain('onPress={() => setDraft(FILTER_NONE)}');
  expect(ru.gallery.reset).toBe('Сбросить');
  // Only people who actually brought something are offered, and only days the gallery holds —
  // each day with what it holds, which is the figure on its own chip.
  expect(frames).toContain('people={brought}');
  expect(frames).toContain('days={days}');
  expect(frames).toContain('framesByDay(items ?? []).map((day) => ({ at: day.at, count: day.frames.length }))');
  expect(sheets).toContain('count={String(day.count)}');
});

test('a day the row is not offering is reached by the calendar, and can be taken off again', () => {
  // «Другая дата» (spec 8) opens the kit's own calendar under the row of days; a day picked there
  // joins the same set every chip toggles.
  expect(sheets).toContain('label={s.gallery.otherDay}');
  expect(sheets).toContain('icon={CalendarDays}');
  expect(sheets).toContain('selected={calendar}');
  expect(sheets).toContain('toggled(have.days, startOfDay(day).getTime())');
  expect(ru.gallery.otherDay).toBe('Другая дата');
  // And it gets a chip of its own even when the memory holds nothing from that day: otherwise it
  // would be filtering the feed with nothing on screen to say so, and nothing to press to undo it.
  expect(sheets).toContain('.filter((at) => !held.has(at)).map((at) => ({ at, count: 0 }))');
});

test('nothing the filter or the sort was set to is remembered between runs', () => {
  // Both are this screen's own state and nothing else: a memory opened afresh opens on the whole
  // of itself, in the order it stands in by default (spec 8).
  expect(frames).toContain('useState<Filter>(FILTER_NONE)');
  expect(frames).toContain('useState<Sort>(SORT_DEFAULT)');
  for (const part of [frames, sheets]) expect(part).not.toMatch(/SecureStore|AsyncStorage/);
});

test('the sort takes effect as it is pressed, and «Готово» is only the way out', () => {
  // Nothing to preview here — the sheet stands over the sheet it is rearranging — so the answer
  // goes straight up and the button at the bottom closes and nothing else.
  expect(frames).toContain('<SortSheet value={sort} onChange={setSort} onDone={() => setTuning(null)} />');
  expect(sheets).toContain('onChange={(by: GroupBy) => onChange({ ...value, by })}');
  expect(sheets).toContain('onChange={(order: Order) => onChange({ ...value, order })}');
  expect(sheets).toContain('label={s.action.done}');
  // The three cuts of the layout, and the days are none of them: a date is a caption over a strip,
  // so it has a switch of its own with a line under it saying what off means.
  expect(ru.gallery.groups.none).toBe('Не собирать');
  expect(ru.gallery.groups.person).toBe('По людям');
  expect(ru.gallery.order).toBe('Порядок');
  expect(ru.gallery.orders.newest).toBe('Сначала новые');
  expect(ru.gallery.datesBetween).toBe('Даты между днями');
  expect(ru.gallery.datesNote).toBe(
    'Выключено — дата видна только на полосе у края, пока листаете.',
  );
  expect(sheets).toContain('onValueChange={(dates) => onChange({ ...value, dates })}');
  // Held shut while the feed is cut by people or by kind: there the seam is already a name, and a
  // switch that would change nothing is worse than one that says it cannot.
  expect(sheets).toContain("disabled={value.by !== 'none'}");
});

test('each of the two sheets glows exactly once', () => {
  // The rule the faces keep, kept by their sheets too: one ember per surface.
  expect(sheets.match(/variant="primary"/g)).toHaveLength(2);
});

test('the delete sheet shows the frame it is about and names the price', () => {
  // `SheetConfirmDelete`: a 64 thumbnail, who brought it and when, and the whole of what is lost —
  // «Оно уйдёт из воспоминания навсегда. В уже собранном ролике останется».
  const confirm = viewer.slice(viewer.indexOf('<ConfirmSheet'));
  expect(confirm).toContain('thumb={item.thumbnail_url ?? undefined}');
  expect(confirm).toContain('meta={shotBy(item, roster, memory)}');
  expect(confirm).toContain('title={s.gallery.deleteAsk(item.kind)}');
  expect(ru.gallery.deleteAsk('photo')).toBe('Удалить это фото?');
  expect(ru.gallery.deleteText).toBe(
    'Оно уйдёт из воспоминания навсегда. В уже собранном ролике останется.',
  );
});

// The invite sheet's own bugs, found in review of TASK-131 and not yet pinned anywhere: a name
// already on the roster went unanswered behind the scrim, a second «Позвать» under the first raced
// the api, and the «В контакты» chip was a flag that could land on the wrong row.

test('a name already on the roster is answered in the field, not left to an empty sheet', () => {
  // `pickable` drops a contact who is already a member and the api is never asked about a name the
  // roster already holds (`answered`), so without `here` the sheet said nothing at all about a nick
  // that is right behind its own scrim — reported as a silent sheet.
  expect(inviteSheet).toContain(
    "const here = (members ?? []).find((member) => member.username?.toLowerCase() === needle);",
  );
  expect(inviteSheet).toContain('here !== undefined ||');
  expect(inviteSheet).toContain('? s.members.already(memberName(here), s.role[here.role])');
});

test('a contact already on the roster is not offered a second invite', () => {
  expect(inviteSheet).toContain(
    '!members?.some((member) => member.id === contact.id) && matches(contact, needle)',
  );
  // And the block itself is not drawn at all once that leaves nobody to offer — no contacts saved,
  // or every one of them already here.
  expect(inviteSheet).toContain('{pickable.length > 0 ? (');
});

test('a second «Позвать» pressed under the first is refused while the call is in the air', () => {
  // Found in review: without the guard, a second press unlocked the field mid-flight and let
  // whichever answer landed last be read as the answer to the last press. One button on the sheet
  // since TASK-145, so the guard is the sheet's own `busy` rather than the id of a spinning row.
  expect(inviteSheet).toContain('if (!handle || busy) return;');
});

/**
 * The sheet the layout draws (TASK-145, `SheetInvite`): one field, the saved people as chips under
 * it, the link under a rule, and one «Позвать» at the foot. Two roads in and one press — so what is
 * pinned here is that the press can only ever be about one person.
 */

test('a chip and the field are one slot: what the button sends to is never two people', () => {
  // Picked out of the chips, or turned up by the typed name — and typing lets the chip go, so the
  // two cannot both be holding somebody when the button is pressed.
  expect(inviteSheet).toContain(
    "const target = here ? null : (picked ?? saved ?? (found === 'none' ? null : found));",
  );
  expect(inviteSheet).toContain('setPicked(picked?.id === contact.id ? null : contact);');
  expect(inviteSheet).toContain('disabled={target === null}');
  // And a chip already pressed in is what the kit draws filled — the same «выбран» a filter chip
  // wears, never a second mark invented by this sheet.
  expect(inviteSheet).toContain('selected={picked?.id === contact.id}');
});

test('a tile is read out in the line it is drawn with', () => {
  // «Все кадры названы photo» — the raw `kind` off the api, before the dictionary (TASK-86). What
  // was left after that is the state: both sheets ask the frame, not the record's status, whether
  // there is anything to say past «Фото», and both go through the one helper to ask it.
  expect(frames).toContain('nameOf(item, frame)');
  expect(frames).toContain("frame.state === 'ready' ? null : s.gallery.waiting[item.status]");
  // One helper for both, and the window is handed it rather than writing a second one: the strip
  // says the same about a record as the tile above it, «открыто» apart.
  expect(frames).toContain('nameOf={nameOf}');
  expect(viewer).toContain('labelAt={(to) => nameOf(frames[to], frameOf(frames[to]), to === index)}');
});

/**
 * The labels of a memory (spec 7.7, 10.8): what a press does, what the feed and the filter show
 * afterwards and every refusal are pinned by running the screens — `memory/label-sheets-flow.test.tsx`
 * and `memory/frames-labels-flow.test.tsx`. Only the words the person reads stay here, because those
 * tests read them off the dictionary instead of spelling them.
 */
test('the words of the labels flow are the ones the layout wrote', () => {
  expect(ru.gallery.whichLabels).toBe('Лейблы');
  expect(ru.gallery.labelsPut).toBe('Лейблы: положить выбранное');
  expect(ru.labels.create(4)).toBe('Создать и положить 4 кадра');
  expect(en.labels.create(1)).toBe('Create and file 1 frame');
  expect(ru.labels.deleteText).toContain('Кадры останутся в воспоминании');
  expect(ru.labels.sharedDenied).toContain('личный');
  expect(ru.labels.gone).toBe('Этого лейбла больше нет.');
  expect(en.labels.gone).toBe('This label is no longer here.');
  expect(ru.memory.gone).toBe('Вас больше нет в этом воспоминании.');
});
