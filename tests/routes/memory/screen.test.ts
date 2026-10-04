/**
 * A memory is one screen and no tabs (spec 8, `MemoryFrames`, TASK-207): the feed of frames runs the
 * width and the height of the phone, the films stand first on it, and the glass bar floats over it.
 * The three faces of TASK-101 are gone — the people moved to the memory's own settings, and the
 * films became a block of the feed. What went where, what the bar carries, and what points at what.
 *
 * Their text and not their rendered output, because this file has no renderer: every test here runs
 * pure logic, and a screen would need `react-native` transformed and `expo-router`, `expo-video` and
 * the safe area all faked before its first line ran. What is worth pinning about a reorganisation is
 * the shape of it — that much the text answers. What these screens *do* is read in the flow tests
 * (`tests/screens/`), where there is a renderer; what stays here is what only the text can say:
 * where a thing stands, and what is no longer in the file.
 */

import { flat } from '@tests/helpers/source';
import { expect, test } from 'vitest';
import layout from '@/app/_layout.tsx?raw';
import home from '@/app/index.tsx?raw';
import invite from '@/app/invite.tsx?raw';
import edit from '@/app/memory/[id]/edit.tsx?raw';
import film from '@/app/memory/[id]/montage/[montageId]/film.tsx?raw';
import live from '@/app/memory/[id]/montage/[montageId]/index.tsx?raw';
import mine from '@/app/memory/[id]/mine.tsx?raw';
import picker from '@/app/memory/[id]/order/frames.tsx?raw';
import settings from '@/app/memory/[id]/settings.tsx?raw';
import upload from '@/app/memory/[id]/upload.tsx?raw';
import memory from '@/app/memory/[id].tsx?raw';
// The kit files read here: the sheet's offset from the header is the appbar's own padding, and the
// montage card is where the poster a face hands over actually lands.
import bars from '@/kit/bars.tsx?raw';
import toggle from '@/kit/toggle.tsx?raw';
import push from '@/lib/push.ts?raw';
import cover from '@/screens/memory/cover.tsx?raw';
// The one player this product has: the strip on the feed and the film's own page both raise it,
// which is why neither of them holds a `Modal` of its own any more (TASK-222).
import player from '@/screens/memory/film-player.tsx?raw';
import films from '@/screens/memory/films.tsx?raw';
import viewer from '@/screens/memory/frame-viewer.tsx?raw';
import frames from '@/screens/memory/frames.tsx?raw';
import errands from '@/screens/memory/frames-errands.ts?raw';
import material from '@/screens/memory/frames-material.ts?raw';
import head from '@/screens/memory/head.tsx?raw';
import inviteSheet from '@/screens/memory/invite-sheet.tsx?raw';
import spine from '@/screens/memory/frames-spine.tsx?raw';
import { en, ru } from '@/strings';

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
  expect(material).toContain('listMedia(');
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
  expect(head).toContain("head: { position: 'absolute', left: 0, right: 0, top: 0 }");
  expect(frames).toContain('<MemoryHead');
  // The way out of a memory is the bar's own, because it is the same on every state of it: a tapped
  // push and a followed invite both open this screen with nothing behind it to go back to.
  expect(head).toContain("router.canGoBack() ? router.back() : router.replace('/')");
  // The capsule is a door in the feed and an action while picking, and neither wears a chevron
  // (spec 1, rule 9): there is no switch for one to come back through, in the kit or here.
  for (const part of [head, bars, frames]) {
    expect(part).not.toMatch(/\bchevron\s*\??\s*[:=]/);
    expect(part).not.toContain('ChevronDown');
  }
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
  // What the press does to the selection is `toggleEvery` (`tests/lib/frames.test.ts`), asked of the frames on
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
  // at its default — and both are asked the same question, off `@/lib/frames` rather than off a flag
  // this face keeps beside the state (spec 7.4).
  const bar = actionBars(frames)[1];
  expect(bar).toContain('icon={Funnel}');
  expect(bar).toContain('icon={ArrowUpDown}');
  expect(bar).toContain('dot={filtering(filter)}');
  expect(bar).toContain('dot={arranged(sort)}');
  expect(bar).toContain('size={height.round}');
  // Nothing brought yet is nothing to sift or lay out, so `FramesEmpty` carries neither of them —
  // and whoever may only look keeps both, with nothing in the middle where the action would be.
  // They are the layer's two ends and the action its middle, so the kit can stand them over it
  // once its words need the width (TASK-375).
  expect(bar).toMatch(/start=\{\s*any \? \(\s*<IconButton\s+icon=\{Funnel\}/);
  expect(bar).toMatch(/end=\{\s*any \? \(\s*<IconButton\s+icon=\{ArrowUpDown\}/);
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
  // Two lines may stand over it, and both are about something other than the feed being empty: the
  // connection, which keeps its promise to show what is loaded and so has nothing to say over
  // nothing, and the line about a memory that would not read, on a phone too small for that line to
  // float under the glass. Neither is the reason for «nothing here».
  expect(flat(frames)).toContain('ListHeaderComponent={ any || !floats || plate ? (');
  expect(flat(frames)).toContain('{plate} {floats ? null : trouble} {any ? ( <> <Films');
});

test('a memory with no film says what one is, and offers it to the one who can order it', () => {
  // `FilmsEmpty` (spec 8): the dashed block where the strip would be, not an empty state — the two
  // leaning frames are the reward itself and the words say what a montage is.
  expect(films).toContain('<EmptyMontages');
  expect(films).toContain('text={s.montage.emptyNote}');
  expect(films).toContain("role === 'organizer' ? (");
  expect(films).toContain('label={s.montage.makeIt}');
  // The kit's paper 36, as wide as its words, and never without its plus (spec 8, detail 40) — what
  // a 36 draws, the 15 plus at 2.2 included, is the kit's own story (`tests/kit/button.test.tsx`).
  const make = films.slice(films.indexOf('<EmptyMontages'), films.indexOf('</EmptyMontages>'));
  expect(make.replace(/\s+/g, ' ')).toContain(
    '<Button variant="paper" size="mini" wide={false} icon={Plus} label={s.montage.makeIt}',
  );
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
  // asked of `@/lib/frames` rather than spelled out here, because the day's «Выбрать все N» above the
  // strip counts with the same rule and the two must not drift (TASK-121). `mayPick` is where that
  // reading lives, and `tests/lib/frames.test.ts` pins it.
  expect(frames).toContain('const pickable = picking && mayPick(item);');
  // `FramesPicking` (spec 7.4, detail 26): the feed's mark is the `accent` one, as on upload.
  expect(frames).toContain("pick={pickable ? (picked.has(item.id) ? 'send' : 'off') : undefined}");
  // The mark is the tile's own — one ring and one circle, never a second mark drawn by a face.
  expect(frames).not.toContain('tile--selected');
  // And on the upload screen the same rule with the mode of its own: picking off, a frame carries
  // no circle at all and a tap opens it (spec, `Upload`).
  expect(upload).toContain("pick={choosing ? (picked.has(item.id) ? 'send' : 'off') : undefined}");
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
  expect(picking).toContain('onPress={() => void save()}');
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
  expect(errands).toContain(
    '(await downloadAllMedia(session, memoryId)).filter((file) => picked.has(file.id))',
  );
  // All of one armful is one share, so the folder the copies go to is wiped once for the lot
  // (`tests/lib/downloads.test.ts`), and leaving the screen is what breaks the chain of sheets.
  expect(errands).toContain('await shareFiles(await markedFiles(token), () => onScreen.current);');
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
  const deleting = errands.slice(errands.indexOf('async function drop'));
  expect(deleting.slice(0, deleting.indexOf('\n  }'))).toContain(
    'if (gone.size > 0) onGone(gone);',
  );
  expect(frames).toContain('wrote((have) => have?.filter((one) => !gone.has(one.id)) ?? null)');
  expect(errands).toContain('deleteMedia(token, memoryId, item.id)');
});

test('the words of the picking mode count with the number alone and say why the button is off', () => {
  // `FramesPicking` and spec 9: «Скачать 4» — the number, and no noun to decline after it.
  expect(ru.gallery.download(1)).toBe('Скачать 1');
  expect(ru.gallery.download(4)).toBe('Скачать 4');
  expect(ru.gallery.download(11)).toBe('Скачать 11');
  expect(en.gallery.download(1)).toBe('Download 1');
  expect(en.gallery.download(4)).toBe('Download 4');
  // The kit's own line for the button with nothing marked, and the kit's own word for the quiet one.
  expect(ru.gallery.nothingPicked).toBe('Ничего не выбрано');
  expect(ru.action.clear).toBe('Снять');
});

/**
 * The contact sheet cut into groups (TASK-121 cut it into days, TASK-144 into whatever the sort
 * asks for): the face drew one flat grid, so there was no heading over a strip and no «Выбрать все
 * N» to mark a whole one with. The cut itself is `groupFrames` and pinned in `tests/lib/frames.test.ts`;
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
  // sort sheet gave, and it comes off `@/lib/frames` rather than off `@/lib/media-window` — this face has
  // no event window to sort by, every frame in it is already the event's.
  expect(upload).toContain('{ key: `day-${day.at}`, day }');
  expect(frames).toContain('groupFrames(kept, sort, datesBetweenDays)');
  expect(frames).toContain('rowsOf(group.frames, columns).map((frames) => ({ key: frames[0].id, frames }))');
  expect(frames).not.toContain('assetsByDay');
  // What is laid out is what the filter left, and both are asked of `@/lib/frames` so the sheet, the
  // strip under the open frame and the count on the filter's own button cannot come apart.
  expect(frames).toContain('framesMatching(items ?? [], filter)');
  // Cut once per read and held, not on every tap: marking a frame is a render, and the sheet of a
  // whole wedding is re-cut in it.
  expect(frames).toContain('const rows = useMemo(');
  expect(frames).toContain('[kept, sort, datesBetweenDays, columns],');
});

test('every gallery is cut by the one cut, at the density the account stands at', () => {
  // TASK-523: three, five or seven across, in all four galleries. They are four screens with three
  // different row shapes between them — a seam over a strip, a day's heading, a flat list — and the
  // one thing they share is the cut. Written out per screen it is four copies of the same
  // arithmetic and four places a density of five quietly stays three; and the flow tests each hold
  // one screen, so none of them would notice the other three.
  for (const [name, source] of Object.entries({
    'the feed of a memory': frames,
    '«Мои кадры»': mine,
    '«Добавить кадры»': upload,
    'the montage’s picker': picker,
  })) {
    // Where the number comes from: the account's own setting, asked of it in every one — and never
    // a three written out where the width is measured.
    expect(source, name).toContain('const columns = useDensity();');
    expect(source, name).toMatch(/\) \/ columns/);
  }
  // And the cut is one function all four reach for, rather than four slices that agree today.
  expect(frames).toContain('rowsOf(group.frames, columns)');
  expect(mine).toContain('rowsOf(frames, columns)');
  expect(upload).toContain('rowsOf(day.assets, columns)');
  expect(picker).toContain('rowsOf(material, columns)');
  // The date spine is not one of the four, but it counts their rows: at five or seven its marks
  // stand on seams that are not the ones drawn unless it is handed the density too.
  expect(spine).toContain('dateMarks(frames, { top: feedTop, row: rowPitch, columns })');
  expect(frames).toContain('    columns,');
});

test('the seam over a strip says what is under it, and takes the whole day while picking', () => {
  const daymark = frames.slice(
    frames.indexOf('<DayMark'),
    frames.indexOf('/>', frames.indexOf('<DayMark')),
  );
  // Three kinds of seam, one component, and which one it is comes from the group itself.
  expect(frames).toContain('const heading = headingOf(group);');
  expect(daymark).toContain('{...heading}');
  // Spec 7.8 — a figure and never a sentence: «128» after a person's name, and over a day nothing
  // at all, because `MemoryDated` draws the date by itself. While the mode is on every seam counts:
  // the band itself is then the button that takes the group.
  expect(daymark).toContain(
    "picking || group.by !== 'day'\n                    ? String(picking ? markable.length : group.frames.length)\n                    : undefined",
  );
  expect(daymark).toContain('onPress={');
  // Read out in place of the band's words, the press names the group it takes.
  expect(daymark).toContain(
    'pressLabel={`${heading.label}, ${s.gallery.selectDay(markable.length)}`}',
  );
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
  const daymark = frames.slice(
    frames.indexOf('<DayMark'),
    frames.indexOf('/>', frames.indexOf('<DayMark')),
  );
  expect(daymark).toContain('picking && markable.length > 0');
  // The circle says whether the whole group is taken and a second press gives it back — the kit's
  // contract for `DayMark`, and what «Добавить кадры» does. What the press does to the selection is
  // `toggleDay` (`tests/lib/frames.test.ts`), which only ever touches this group's frames.
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

test('the switch is spelled out once, in the kit', () => {
  // TASK-56: the same switch stood word for word on two screens. The invite sheet takes the kit's
  // component now, and no face draws one of its own.
  expect(inviteSheet).toContain('<Toggle');
  for (const face of [frames, films, settings, inviteSheet]) expect(face).not.toMatch(/<Switch\b/);
  expect(toggle).toContain('export function Toggle');
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
  // The feed reads through `useMaterial`, which keeps the focus effect that re-reads; the frame it
  // has open is its own and is shut by a focus effect of its own. Which read that effect makes is
  // its own question (TASK-512: underneath a feed this phone already had, asked for over an empty
  // one), pinned in `tests/lib/frames-kept.test.ts`.
  // Read off the flattened source (`tests/helpers/source`): the effect carries a comment above the
  // read, and a pattern written to the line breaks would say nothing about the effect.
  expect(flat(material)).toMatch(
    /useFocusEffect\( useCallback\(\(\) => \{.*?read\(.*?\); readLabels\(\); \}, \[read, readLabels\]\), \);/,
  );
  expect(frames).toContain('useFocusEffect(useCallback(() => () => setOpen(null), []));');
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
  expect(film).toMatch(
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
  // And one on the film's own screen: «Поделиться» beside «Скачать» in the outline under the poster,
  // as the layout draws them (spec 8, `FilmReady`).
  expect(film.match(/variant="primary"/g)).toHaveLength(1);
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
