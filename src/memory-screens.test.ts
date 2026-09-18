import { expect, test } from 'vitest';

import memory from './app/memory/[id].tsx?raw';
import order from './app/memory/[id]/order.tsx?raw';
import progress from './app/memory/[id]/montage/[montageId].tsx?raw';
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
import toggle from './kit/toggle.tsx?raw';
import films from './memory/films.tsx?raw';
import viewer from './memory/frame-viewer.tsx?raw';
import frames from './memory/frames.tsx?raw';
import sheets from './memory/frames-sheets.tsx?raw';
import head from './memory/head.tsx?raw';
import people from './memory/people.tsx?raw';
// The arithmetic both the movies face and the waiting screen ask their «is it still being made»
// question through, so the two cannot drift apart about what the answer is.
import montage from './montage.ts?raw';
import push from './push.ts?raw';
import { en, ru } from '@/strings';

/**
 * A memory is one screen with three faces — «не три экрана с одним именем, а один экран с тремя
 * лицами: имя стоит в шапке, лицо выбирают переключателем под ней» (kit, «Экраны» 4–6, TASK-101).
 * These read off the route and the three faces: which half went where, what the appbar carries on
 * each of them, and what still points at what.
 *
 * Their text and not their rendered output, because this project has no renderer: every test here
 * runs pure logic, and a screen would need `react-native` transformed and `expo-router`,
 * `expo-video` and the safe area all faked before its first line ran. What is worth pinning about a
 * reorganisation is the shape of it — that much the text answers. These go the day a render harness
 * arrives.
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
  // Inside `Stack.Protected` — a screen declared outside it exists signed out too.
  expect(layout.indexOf('name="memory/[id]"')).toBeLessThan(layout.indexOf('</Stack.Protected>'));
});

test('the three faces are three files, and the screen is only which of them is on', () => {
  for (const face of ['Frames', 'Films', 'People']) expect(memory).toContain(`<${face} id={id}`);
  // The memory itself is read once, above all three, so switching a face does not blink the name.
  expect(memory.match(/listMemories\(/g)).toHaveLength(1);
  for (const face of [frames, films, people]) expect(face).not.toContain('listMemories');
  // And each face reads what is its own, when it comes on.
  expect(frames).toContain('listMedia(');
  expect(films).toContain('listMontages(');
  expect(people).toContain('listMembers(');
  for (const moved of ['retryMontage', 'CardMontage']) {
    expect(films).toContain(moved);
    expect(people).not.toContain(moved);
    expect(frames).not.toContain(moved);
  }
  // Asking for a movie is four steps and a screen of its own since TASK-162: this face offers it
  // and reads its list again when that screen goes, and no face orders anything itself.
  expect(order).toContain('orderMontage(');
  for (const face of [frames, films, people]) expect(face).not.toContain('orderMontage');
  for (const stayed of ['RowMember', 'inviteByUsername', 'removeMember']) {
    expect(people).toContain(stayed);
    expect(films).not.toContain(stayed);
  }
});

test('all three wear one appbar, with the memory’s name and no caption under it', () => {
  for (const face of [frames, films, people]) {
    expect(face).toContain('<MemoryHead');
    // The line that used to say which of the three screens was open. The switch says it now, in
    // words that can be pressed (TASK-76 asked for the caption; TASK-101 replaced it).
    expect(face).not.toContain('subtitle={');
    expect(face).not.toContain('<AppBar');
  }
  expect(head).toContain('title={memory?.title ?? s.memory.fallbackTitle}');
  // Left in the appbar, by the rule every screen of a memory has kept: a tapped push and a followed
  // invite both open this one with nothing behind it to go back to.
  expect(head).toContain("router.canGoBack() ? router.back() : router.replace('/')");
});

test('the switch under the name is the kit’s wide segment, and it holds the three faces', () => {
  expect(head).toContain('<Segment');
  // `.segment-wide` — the row spans the screen instead of being as wide as its words, and the
  // heading over it is the memory's own name, so the label is only spoken.
  expect(head).toContain('wide');
  expect(head).toContain('hideLabel');
  expect(head).toContain('label={s.memory.whatToShow}');
  for (const option of [
    "{ value: 'frames', label: s.memory.framesPlain }",
    "{ value: 'films', label: s.montage.title }",
    "{ value: 'people', label: s.members.title }",
  ]) {
    expect(head).toContain(option);
  }
  // The kit's own three words, in both sets: «Кадры / Ролики / Люди».
  expect(ru.memory.framesPlain).toBe('Кадры');
  expect(ru.montage.title).toBe('Ролики');
  expect(ru.members.title).toBe('Люди');
  for (const set of [en, ru]) {
    for (const word of [set.memory.framesPlain, set.montage.title, set.members.title]) {
      // A third of a phone's width each: one word, never a phrase.
      expect(word).not.toContain(' ');
    }
  }
});

test('the right of the appbar is one icon, and only the frames have one', () => {
  // The switch into picking, the kit's one icon for this corner — and the whole of what it holds.
  // «Скачать всю галерею» stood here until the kit folded it into the picking itself («это тот же
  // выбор, только весь»), and before that it was a second wide button in the footer beside
  // «Добавить кадры».
  expect(frames).toContain('right={');
  expect(frames).toContain('label={picking ? s.gallery.leaveSelect : s.gallery.select}');
  expect(frames).not.toContain('gallery.downloadAll');
  // The other two hand the head nothing for that corner — moving between faces is the switch's job,
  // and the `Users` icon that used to do it is gone from all three.
  for (const face of [films, people]) {
    expect(face).toContain('<MemoryHead {...head} />');
    expect(face).not.toContain('right=');
  }
  for (const face of [frames, films, people]) expect(face).not.toContain('Users');
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
  expect(people).not.toContain('/memory/[id]/upload');
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
  expect(frames).toContain('rows.length === 0 ? styles.gridEmpty : null');
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
  expect(upload).toContain("pick={picked.has(item.id) ? 'send' : 'off'}");
});

test('the picking footer is «Снять» beside a download that carries its count', () => {
  const picking = actionBars(frames)[0];
  // `FramesPicking`: the layout's third kind of bottom layer — the count of the whole picking and
  // the quiet way out of it stand on a line over the button, not beside it.
  expect(picking).toContain('above={');
  expect(picking).toContain('{s.gallery.picked(marked.length)}');
  expect(ru.gallery.picked(3)).toBe('Выбрано 3');
  // The quiet half is the word the kit gives both sheets that pick something, said in one place.
  expect(picking).toContain('label={s.action.clear}');
  expect(upload).toContain('label={s.action.clear}');
  expect(picking).toContain('s.gallery.download(marked.length)');
  expect(picking).toContain('s.gallery.nothingPicked');
  expect(picking).toContain('onPress={() => void savePicked()}');
  // Both off with nothing marked, and both off while something is already coming down.
  expect(picking.match(/disabled=\{busy \|\| marked\.length === 0\}/g)).toHaveLength(2);
  // Counted off the sheet and never off the raw set. `picked` is emptied only by leaving the mode
  // or by «Снять», while the sheet moves on its own — the three-second re-read, the focus, the
  // pull. A frame somebody else deleted stayed in the set and stayed in the count: the button
  // offered «Скачать 3 файла», signed the whole gallery to find out, and came back «Сохранено 0
  // файлов». Found in review. What the button counts is what the download will find.
  expect(frames).toContain('const marked = items?.filter((item) => picked.has(item.id)) ?? [];');
  expect(picking).not.toContain('picked.size');
  // The download itself is the whole-gallery route cut to what is marked — one ask, not one per
  // file, which is what «скачать всё» already did.
  expect(frames).toContain(
    '(await downloadAllMedia(token, id)).filter((file) => picked.has(file.id))',
  );
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
  expect(frames).toContain('frames: group.frames.slice(i * 3, i * 3 + 3)');
  expect(frames).not.toContain('assetsByDay');
  // What is laid out is what the filter left, and both are asked of `@/frames` so the sheet, the
  // strip under the open frame and the count on the filter's own button cannot come apart.
  expect(frames).toContain('framesMatching(items ?? [], filter)');
  // Cut once per read and held, not on every tap: marking a frame is a render, and the sheet of a
  // whole wedding is re-cut in it.
  expect(frames).toContain('const rows = useMemo(');
  expect(frames).toContain('[kept, sort],');
});

test('the heading over a strip says what is under it, and holds one thing at its right edge', () => {
  const daymark = frames.slice(frames.indexOf('<DayMark'), frames.indexOf('</DayMark>'));
  // Four kinds of heading, one component, and which one it is comes from the group itself.
  expect(daymark).toContain('{...headingOf(group)}');
  // «Правый край всегда занят чем-то одним: числом в обычном виде, „Выбрать все 174“ в режиме
  // выбора» — one slot, a ternary on the mode and never both at once.
  expect(daymark).toContain('count={picking ? undefined : s.memory.frames(group.frames.length)}');
  expect(daymark).toContain('{picking ? (');
  expect(daymark).toContain('label={s.gallery.selectDay(markable.length)}');
  // `FramesPicking` draws it as the small bordered pill, never as the glowing one: the ember on
  // this face belongs to the footer's one action.
  expect(daymark).toContain('variant="small"');
  expect(daymark).not.toContain('variant="primary"');
});

test('a heading is a day, a person with their circle, or one of the two kinds', () => {
  const heading = frames.slice(frames.indexOf('function headingOf'), frames.indexOf('/** Tap to'));
  expect(heading).toContain("if (group.by === 'day') return { label: formatDay(new Date(group.at)) };");
  expect(heading).toContain("if (group.by === 'kind') return { label: s.media[group.kind] };");
  // `FramesByPeople`: the name, their circle in front of it, and the spark collar on the
  // organizer's — read off the roster this face already holds for the open frame's own line.
  expect(heading).toContain('avatar: name');
  expect(heading).toContain("organizer: who?.role === 'organizer'");
  // The material's one word counts every kind of group, «174 кадра» over a day and over a person
  // alike (TASK-76's key).
  expect(frames).toContain('s.memory.frames(group.frames.length)');
});

test('«Выбрать все N» counts and marks the frames a tap could reach, and only adds', () => {
  // The count, the gate and the press all read the one list, so the button cannot say «9» and mark
  // eight. The rule itself is `mayPick` — the same one the single tap is gated on.
  expect(frames).toContain('const markable = group.frames.filter(mayPick);');
  expect(frames).toContain('disabled={markable.length === 0}');
  expect(frames).toContain('onPress={() => pickDay(markable)}');
  // Never unmarks: what is marked on another day stays marked, and taking a mark off is a second
  // tap on the frame or the footer's «Снять».
  const pickDay = frames.slice(frames.indexOf('function pickDay'));
  expect(pickDay.slice(0, pickDay.indexOf('\n  }'))).toContain(
    'setPicked((have) => new Set([...have, ...frames.map((item) => item.id)]));',
  );
  expect(pickDay).not.toContain('next.delete');
  // The kit's quiet action of the day, and the same words on both sheets that have one — «тем же
  // тихим действием дня, что и на „Выборе кадров“». Two keys because each face keeps its own words,
  // held equal here so they cannot drift apart in one language only.
  for (const set of [en, ru]) expect(set.gallery.selectDay(9)).toBe(set.upload.selectDay(9));
  expect(ru.gallery.selectDay(9)).toBe('Выбрать все 9');
});

test('no face reaches another by pushing a route: the switch is the only road between them', () => {
  for (const face of [frames, films, people]) {
    expect(face).not.toContain("pathname: '/memory/[id]'");
    expect(face).not.toContain('/memory/[id]/gallery');
  }
  // A screen of its own is not a face. The movies face pushes onto two of them — the order wizard
  // and, since TASK-169, the waiting over one montage — and both come back here. What this rule
  // bans is a face drawing another face's route, which neither of those is; the other two faces
  // have no business with a montage at all.
  for (const face of [frames, people]) expect(face).not.toContain('/memory/[id]/montage');
});

test('the platform switch is spelled out once, in the kit', () => {
  // TASK-56: the same four colour props stood word for word on two screens, and one of them is the
  // kind nobody notices missing. The invite sheet takes the kit's component now.
  expect(people).toContain('<Toggle');
  for (const face of [frames, films, people]) expect(face).not.toContain('thumbColor');
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
  // screen under it loses focus (`kit/sheet.test.tsx`); the people face's line went back to being
  // the plain read it was before. That is the whole point of the rule living in one place: a face
  // that puts up a new sheet gets it with no line of its own, which is how the delete confirmation
  // on this face — never touched by hand, the hole TASK-129 was reported for — is shut too.
  for (const face of [frames, films]) expect(face).not.toContain('useFocusEffect(load)');
  expect(people).toContain('useFocusEffect(load);');
  expect(frames).toMatch(
    /useFocusEffect\(\s*useCallback\(\(\) => \{\s*load\(\);\s*return \(\) => setOpen\(null\);\s*\}, \[load\]\),\s*\);/,
  );
  expect(films).toMatch(
    /useFocusEffect\(\s*useCallback\(\(\) => \{\s*load\(\);\s*return \(\) => setPlaying\(null\);\s*\}, \[load\]\),\s*\);/,
  );
  // And the explicit ways out are untouched: each window's own way out still closes it, the
  // hardware key and both confirmations included.
  expect(people).toContain('onCancel={() => setInviting(false)}');
  expect(people).toContain('onCancel={() => setDropping(null)}');
  // The open frame is a window of its own now (TASK-147): the hardware key goes through the same
  // `onClose` the face hands it, which is the same `setOpen(null)` the blur above runs.
  expect(viewer).toContain('onRequestClose={onClose}');
  expect(frames).toContain('onClose={() => setOpen(null)}');
  expect(viewer).toContain('onCancel={() => setConfirming(false)}');
  expect(order).toContain('onCancel={() => setShowDropped(false)}');
  expect(films).toContain('onRequestClose={() => setPlaying(null)}');
});

// The roads into a memory, and the face each of them lands on.

test('a tapped card opens the memory on its frames, which is what it opens on by default', () => {
  expect(home).toContain("router.push({ pathname: '/memory/[id]', params: { id: item.id } })");
  expect(memory).toContain("useState<Face>(wanted ?? 'frames')");
});

test('an accepted invite lands on the people, and a finished movie on the movies', () => {
  // Both used to be routes of their own; both are a face of this one screen now, asked for by name.
  expect(invite).toContain("params: { id: memory.id, face: 'people' }");
  expect(push).toContain("params: { id: memoryId, face: 'films' }");
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
  // One on the movies since TASK-162: «Смонтировать ролик» in the footer, and nothing else — the
  // sheet that used to carry the second one is a screen of its own now.
  expect(films.match(/variant="primary"/g)).toHaveLength(1);
  // Three on that screen, one per surface: «Дальше»/«Смонтировать» on the wizard itself, «Вернуть
  // все» on the sheet of what was dropped, «Добавить кадры» on the one that says there is too little.
  expect(order.match(/variant="primary"/g)).toHaveLength(3);
  // Two on the people for the same reason since TASK-145: «Пригласить» in the footer, and the one
  // «Позвать» at the foot of the invite sheet. The sheet had none of its own while every press that
  // put somebody in sat on that person's own row (TASK-131); the layout's `SheetInvite` is one of
  // the five «одна главная кнопка» sheets of spec 7.1, so the press moved back to the bottom.
  expect(people.match(/variant="primary"/g)).toHaveLength(2);
  // And the people's own is in the footer the kit draws for that face, not inline in the roster.
  const footer = people.slice(people.indexOf('<ActionBar>'), people.indexOf('</ActionBar>'));
  expect(footer).toContain('label={s.action.invite}');
});

test('nobody is shown a way out of a memory, and the organizer keeps the crosses', () => {
  // TASK-113: the human took leaving off the design. The call behind it is untouched and still the
  // one the organizer's cross makes on somebody else — what went is the button that aimed it at
  // oneself, and with it the only red thing the face had.
  expect(people).not.toContain('variant="danger"');
  expect(people).not.toContain('label={s.members.leave}');
  expect(people).toContain('removeMember(session, id, target.id)');
  expect(people).toContain('label={s.members.remove(memberName(member))}');
});

// The roster line itself (TASK-110, TASK-111), reported off a live device: the standings read as
// bookkeeping, nothing said how much anybody had actually brought, and «мне нечего добавлять» was a
// button under the row that made that one row taller than the rest.

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
});

test('the line over the roster counts «скинувшие» by the one rule both screens read', () => {
  // Review of m-21, on one memory: the card on the main screen and this line said different
  // numbers, because the card is counted by the api and this line counted «всё загрузил» alone.
  // Now both ask `hasShared` (doc-06, TASK-167) — the rule, not a copy of it, so the day a fifth
  // standing exists neither face can be the one that missed it.
  expect(people).toContain('bringers.filter((member) => hasShared(member.contribution_status))');
  expect(people).not.toContain("contribution_status === 'done').length");
  // The other half of the line was never the argument: whoever may not bring material is owed
  // nothing and is counted on neither side of the «из» (doc-01).
  expect(people).toContain('(members ?? []).filter((member) => mayContribute(member.role))');
  // And one's own «ждать нечего» chip is the same rule read backwards — it is offered exactly while
  // there is still something to say, which is exactly what is not counted above.
  expect(people).toContain('!hasShared(member.contribution_status)');
});

test('every row says how many frames that person brought, counted off the gallery', () => {
  // The api keeps no tally on a member, so the roster counts the memory's own listing by uploader.
  // One read, beside the roster's own — and its failure is not the roster's, so it is swallowed.
  expect(people.match(/listMedia\(/g)).toHaveLength(1);
  expect(people).toContain('by.set(item.uploaded_by, (by.get(item.uploaded_by) ?? 0) + 1)');
  expect(people).toContain("shots ? s.memory.frames(shots.get(member.id) ?? 0) : '—'");
  // The `@ник` under the name, and the rule for leaving it off when it is already the name above —
  // one copy in `api.ts` beside `memberName`, which settles the other half of the same pair. It was
  // written out here and again on the profile head until review pulled it back.
  expect(people).toContain('memberHandle(member),');
  // And the role beside it is \u00ab\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u0435\u00bb or \u00ab\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u00bb, never \u00ab\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0442\u043e\u0440\u00bb (spec 7.5): that one
  // is the badge on the name, and the layout writes the organizer's own second line as \u00ab@liza \u00b7 128
  // \u043a\u0430\u0434\u0440\u043e\u0432\u00bb. One fact said twice in one row is what this line is held against.
  expect(people).toContain("member.role === 'organizer' ? null : s.role[member.role],");
  // Swallowed, and nothing written on the way out. This read runs again on every focus, so a
  // failure on the way back from the upload screen used to blank a column of counts that was
  // already on screen and right — and nothing on this face retries it, because the banner belongs
  // to the roster. Found in review: never counted earns the dash, counted-then-lost does not.
  expect(people).not.toContain('setShots(null)');
  expect(people).toContain('() => {},');
  // `spark` belongs to «Всё загрузил» alone (spec 1.2): that mark is what the organizer scans for.
  expect(people).toContain("member.contribution_status === 'done'");
  expect(people).toContain('<BadgeContribution');
});

test('one’s own standing is the chip that sets it, standing where the word would', () => {
  // It was a `Button` under the row, and that is what came back from the device: the row it hung
  // under stood taller than its neighbours and the stack read ragged (TASK-111). Now it is the
  // kit's `.chip-action`, in the status's own slot — same 26 as the word it replaces.
  expect(people).toContain('label={s.members.sayNothing}');
  expect(people.indexOf('status={')).toBeLessThan(people.indexOf('label={s.members.sayNothing}'));
  expect(people).not.toContain('icon={Check}');
  expect(people).not.toContain('styles.own');
  // The row is held to the spec's own height (7.5: a 42 circle with 11 above and below), so
  // nothing that goes into it — the chip, the cross, a bare word — can change how tall it is.
  expect(member).toContain('minHeight: height.row');
  // And the cross beside the name is the 36 round one, with its column held open where the
  // organizer looks at their own row and there is no cross to draw.
  expect(people).toContain('size={36}');
  expect(people).toContain('styles.noCross');
});

test('the order button waits for the list it prepends to', () => {
  // TASK-75 lifted this button out of the list branch into the bottom bar, where the only thing
  // gating it is the role — and the role comes off the memory, which is read above the face and
  // lands first. Pressed over a list still in flight, `order` puts its new row into state that the
  // read landing after it wipes; pressed over a list that failed, it offers a second failure under
  // an error banner. Both are the invariant the button had while it stood inside the list.
  expect(films).toContain("role === 'organizer' && montages !== null ?");
  // And the answer to that press carries the bottom inset itself when there is no bar under it to
  // carry one — everybody who is not the organizer still saves a movie and still gets a line back.
  expect(films).toContain("role === 'organizer'");
  expect(films).toContain('marginBottom: Math.max(insets.bottom');
  // The frames face says the same thing for the same reason: a viewer has no footer there either.
  expect(frames).toContain('marginBottom: Math.max(insets.bottom');
});

test('an order is asked for in four steps, on a screen of its own, and sent in one call', () => {
  // TASK-162: the sheet with three switches is gone; spec 8 asks in four steps — the frames, the
  // story, the music, the shape — and nothing leaves the phone until the last button of the last
  // one. The face only opens it.
  expect(layout).toContain('<Stack.Screen name="memory/[id]/order"');
  expect(films).toContain("router.push({ pathname: '/memory/[id]/order', params: { id } })");
  expect(order).toContain('const STEPS = 4;');
  expect(order).toContain('await orderMontage(token, id, wishes(items, order));');
  // Too little material raises `SheetTooLittle` in place of step 1, and its own button leads to
  // where material comes from — the question is asked before the four steps, not after them.
  expect(order).toContain('const short = items !== null && !enoughMaterial(items);');
  expect(order).toContain('<Sheet\n        visible={short}');
  expect(order).toContain("router.replace({ pathname: '/memory/[id]/upload', params: { id } })");
  // And the floor holds on what was picked, not only on what the memory holds: the api counts the
  // ready material for its 409 and never the selection, and so does the worker, so an order taking
  // one frame out of twenty was accepted and cut into a one-frame «ролик» (found in review).
  expect(order).toContain('disabled={step === 1 && inMovie.length < MIN_FRAMES}');
  // Their own track goes up the moment it is picked, so the last button of the wizard is one call.
  expect(order).toContain('await sendOwnTrack(token, id,');
  // Every wish of spec 8 is in the body that goes out, and the api names all of them.
  for (const wish of [
    'target_seconds',
    'story_text',
    'include_media_ids',
    'exclude_media_ids',
    'music_track_id',
    'music_track_key',
    'orientation',
  ]) {
    expect(api).toContain(`${wish}?`);
  }
  expect(api).toContain("export type MontageOrientation = 'landscape' | 'portrait';");
  for (const set of [en, ru]) {
    expect(Object.keys(set.montage.orientation)).toEqual(['landscape', 'portrait']);
    expect(set.montage.shape).toBeTruthy();
    // The shelf is five since the worker grew two (TASK-157/161), in the order the layout draws it.
    expect(Object.keys(set.montage.track)).toEqual(['bright', 'warm', 'calm', 'night', 'road']);
  }
});

test('a placed order lands on the waiting for that montage, not back on the list', () => {
  // TASK-163, spec 8: what was just asked for is the only thing on the mind of whoever asked, so it
  // gets a screen — and a route of one montage, not a second face of the memory.
  expect(layout).toContain('name="memory/[id]/montage/[montageId]"');
  expect(layout.indexOf('name="memory/[id]/montage/[montageId]"')).toBeLessThan(
    layout.indexOf('</Stack.Protected>'),
  );

  // The wizard hands over the row the api answered with, and the count of frames it took — the one
  // number nobody else can work out, because the api hands back what it wrote and never how many
  // pictures add up to it. `replace`: an order already sent is not a wizard to walk back into.
  expect(order).toContain('const made = await orderMontage(token, id, wishes(items, order));');
  expect(order).toContain("pathname: '/memory/[id]/montage/[montageId]',");
  expect(order).toContain('params: { id, montageId: made.id, frames: inMovie.length },');
  const sentAt = order.indexOf('const made = await');
  const sent = order.slice(sentAt, order.indexOf('} catch', sentAt));
  expect(sent).toContain('router.replace({');
  // And it does not simply walk out any more, which is what it did until this screen existed.
  expect(sent).not.toContain('leave()');

  // The screen itself: the order said back in the wizard's own words, and where the making is in
  // stages. The stages are named and never counted — «73 %» tells a person nothing.
  expect(progress).toContain('stages(montage.status)');
  expect(progress).toContain('<RowStep');
  for (const said of ['building', 'closeApp', 'toMemory', 'stageDone', 'stageRunning']) {
    expect(progress).toContain(`s.montage.${said}`);
  }
  // Every stage the arithmetic walks has a word in both languages: a sixth one added there and left
  // unnamed here would draw an empty row.
  const stageAt = montage.indexOf('export const STAGES');
  const listed = [...montage.slice(stageAt, montage.indexOf(';', stageAt)).matchAll(/'(\w+)'/g)];
  const named = listed.map(([, stage]) => stage);
  expect(named).toHaveLength(5);
  for (const set of [en, ru]) expect(Object.keys(set.montage.stage)).toEqual(named);
});

test('a card still being made is the second road onto the waiting over it', () => {
  // TASK-169, spec 7.6: that screen existed from TASK-163 with exactly one way in — having just
  // placed the order. A card saying «Собирается» in the list did nothing under a finger, so anybody
  // who walked out of the waiting, or came back to the app an hour later, could not get back to
  // where the making had got to.
  expect(films).toContain(
    'onPress={beingMade(montage.status) ? () => watchMaking(montage) : undefined}',
  );
  const leads = films.slice(films.indexOf('const watchMaking'));
  const road = leads.slice(0, leads.indexOf('});'));
  // A push and not a replace: the face is what that screen's own `back()` comes home to.
  expect(road).toContain('router.push({');
  expect(road).toContain("pathname: '/memory/[id]/montage/[montageId]',");
  expect(road).toContain('params: { id, montageId: montage.id },');
  // The frame count is the wizard's alone — it counted them while picking, and nothing counts them
  // back off a placed order, so this road carries none and the screen says one thing less.
  expect(road).not.toContain('frames');
  expect(progress).toContain('frames?: string;');

  // The other two states are untouched: a finished montage is watched where it lies and a fallen one
  // is started again from its own button, both by the presses they already had.
  expect(films).toContain(
    'onPlay={montage.video_url === null ? undefined : () => setPlaying(montage.id)}',
  );
  expect(films).toContain('onPress={() => void retry(montage)}');
  // And the kit is what makes that true: without a press handed over, the card is not a button and
  // takes no finger at all.
  expect(cardMontage).toContain("accessibilityRole={onPress ? 'button' : undefined}");
  expect(cardMontage).toContain('disabled={!onPress}');
});

test('the waiting ends the way the montage does, and never on a spinner that turns for ever', () => {
  // The same read the movies face makes, cut down to the one row — there is no route for a single
  // montage — on the way in and then on the face's own clock while the worker still owes it.
  expect(progress).toContain('listMontages(token, id).then(');
  expect(progress).toContain('const making = montage === null || beingMade(montage.status);');
  expect(progress).toContain('setInterval(() => read(true), WHILE_MAKING_MS)');
  expect(progress).toContain('return () => clearInterval(timer);');
  // Quietly, the same way that face polls: a blip on the way must not put a banner over a screen
  // that is fine.
  expect(progress).toContain('if (!quiet) setError(errorMessage(e));');

  // Ready while somebody sat here watching: the reward is the video and the video is played on the
  // movies face, so this screen steps out of the way instead of growing a second player.
  expect(progress).toContain("if (montage?.status === 'ready') leave();");
  expect(progress).toContain(
    "router.replace({ pathname: '/memory/[id]', params: { id, face: 'films' } });",
  );
  // Fallen over: the screen says so where «Собираем ролик» stood, hands over the worker's own line,
  // and stays put — going back is the person's move and not the app's.
  expect(progress).toContain("const broke = montage?.status === 'failed';");
  expect(progress).toContain('{broke ? s.montage.status.failed : s.montage.building}');
  expect(progress).toContain('{montage.error_text ? (');
  expect(progress).toContain('s.montage.retryInMemory');
  for (const set of [en, ru]) expect(set.montage.retryInMemory).toBeTruthy();

  // «К воспоминанию» leaves and touches nothing: the making is the worker's, and the only calls
  // this screen makes are the two reads.
  expect(progress).toContain(
    "import { errorMessage, listMemories, listMontages, type Memory, type Montage } from '@/api';",
  );
  for (const writing of ['orderMontage', 'retryMontage', 'deleteM', "method: '"]) {
    expect(progress).not.toContain(writing);
  }
});

test('neither screen of an order moves the app once the person has walked out of it', () => {
  // Found in review, m-23: `useRouter` hands back the app's own router and not the screen's, so a
  // call still in flight when «Отмена» was pressed went on to move whoever was on top of it — the
  // wizard walked people into the waiting screen seconds after they had walked out of the wizard.
  // Reset on the way in as well as set on the way out: a remount is a screen that is here again.
  for (const screen of [order, progress]) {
    expect(screen).toContain('const gone = useRef(false);');
    expect(screen).toContain('gone.current = false;');
    expect(screen).toContain('gone.current = true;');
  }

  // The order itself is placed and cannot be unsent — what does not happen is the leading anywhere,
  // and the same for a track that lands after the wizard has gone.
  const sentAt = order.indexOf('const made = await');
  expect(order.slice(sentAt, order.indexOf('router.replace', sentAt))).toContain(
    'if (gone.current) return;',
  );
  expect(order).toContain('if (!gone.current) setNotice(errorMessage(e));');

  // And the waiting screen's one way out is called by its own read as well, so it is guarded where
  // it is written: a second `back()` off an answer that landed late pops the memory too.
  expect(progress).toContain('const leave = useCallback(() => {\n    if (gone.current) return;');
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

test('a vertical montage’s card is told to stand its frame up', () => {
  // TASK-135: the card kept one horizontal frame and cropped a standing poster to it, so a vertical
  // montage was a narrow strip. The shape is the screen's to hand over — the card asks the api for
  // nothing — and it comes off the orientation that was ordered (TASK-126), so the frame is right
  // from the queued card onwards and nothing jumps when the still lands. The two numbers are pinned
  // here because the card's own test reads rendered markup, where they are compiled-away hashes.
  expect(films).toContain("vertical={montage.params.orientation === 'portrait'}");
  expect(cardMontage).toContain('posterTall: { aspectRatio: 4 / 5, height: undefined }');
  expect(cardMontage).toContain("contentFit={vertical ? 'contain' : 'cover'}");
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

test('the material of a memory has one name — on the card, on the switch, over the sheet', () => {
  // «N frames» on the card, «Photos and videos (N)» on the guest list, «Gallery» over the contact
  // sheet was the report (TASK-76). One key answers all of them, and it is the word on the switch.
  expect(head).toContain('s.memory.framesPlain');
  expect(home).toContain('s.home.noFrames');
  for (const set of [en, ru]) {
    // «0 кадров» → «кадров», which is what «Кадров пока нет» has to be built on too. Russian
    // declines it, so the counted form is the one both lines are held against.
    expect(set.home.noFrames.toLowerCase()).toContain(set.memory.frames(0).split(' ')[1]);
  }
});

/**
 * The open frame (TASK-147): `Viewer`, `ViewerVideo` and `SheetFrame` of spec 8, in a file of their
 * own — «во весь экран, без кнопок снизу, а снизу лента» is what was asked for, and a shape is what
 * these pin. What the strip does with a finger lives in the library now and is read there;
 * everything the gallery decides about a record is pinned in `frames.test.ts`.
 */

test('nothing stands under the open frame: glass over it, the strip and the actions beneath', () => {
  // Spec 7.1, kind 6 and kind 4: three pieces of glass floating over the picture, and no bottom
  // layer at all — the window's own row of actions is not one, and the gallery's is not in here.
  expect(viewer).toContain('<ViewerBar');
  expect(viewer).not.toContain('<ActionBar');
  // TASK-109's darkening went with the bar it was under: the glass carries these now, and a
  // gradient measured off the safe area has nothing left to darken.
  expect(viewer).not.toContain('linear-gradient');
  // The order down the window, spec 8: the scrubber on a line of its own, the strip, then the row.
  const strip = viewer.indexOf('<Filmstrip');
  expect(viewer.indexOf('<VideoTrack')).toBeLessThan(strip);
  expect(strip).toBeLessThan(viewer.indexOf('label={s.action.share}'));
  // «По краям то, что уводит кадр из воспоминания, в середине то, что с ним делают.»
  const actions = viewer.slice(viewer.indexOf('<View style={styles.actions}>'));
  const order = [
    'label={s.action.share}',
    'label={s.viewer.saveToPhone}',
    'label={s.viewer.details}',
    'label={s.viewer.remove}',
  ].map((label) => actions.indexOf(label));
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(order[0]).toBeGreaterThan(-1);
  // The two in the middle stand on glass of their own, and the delete is the only red thing here.
  expect(viewer).toContain('backgroundColor: photo.glass');
  expect(viewer).toContain('tint={room.dangerText}');
  expect(ru.viewer.remove).toBe('Удалить из воспоминания');
  expect(ru.viewer.saveToPhone).toBe('Сохранить в галерею телефона');
});

test('the row of actions keeps its shape for somebody who may not delete', () => {
  // The glass group is the middle of the window, and «в середине» has to stay true whoever is
  // looking: without the stub the two buttons would slide towards the edge for a viewer.
  const right = viewer.slice(viewer.indexOf('{mayDelete(item) ? ('));
  expect(right).toContain('<View style={styles.stub} />');
  expect(viewer).toContain('stub: { width: height.roundViewer }');
});

test('«Ещё» and «Подробности» raise the same sheet, and it is the one the layout draws', () => {
  // Spec 8: both lead to `SheetFrame`. One piece of state, so they cannot drift into two sheets.
  expect(viewer.match(/setDetails\(true\)/g)).toHaveLength(2);
  expect(viewer).toContain('<FrameSheet');
  // The sheet itself: a header row saying which frame this is, three errands, one outlined way out.
  const sheet = sheets.slice(sheets.indexOf('export function FrameSheet'));
  expect(sheet).toContain('label={s.viewer.saveToPhone}');
  expect(sheet).toContain('label={s.action.share}');
  expect(sheet).toContain('label={s.viewer.remove} danger');
  expect(sheet).toContain('<Button variant="secondary" size="md" label={s.action.close}');
  // The delete is absent for whoever may not delete, never greyed — and it never deletes anything
  // itself: it hands the window back to the sheet that names the price.
  expect(sheet).toContain('{onDelete ? (');
  expect(viewer.replace(/\s+/g, ' ')).toContain('mayDelete(item) ? () => { setDetails(false); setConfirming(true);');
});

test('the frame’s own sheet says what the frame is, who brought it and how heavy it is', () => {
  // «Фото», and under it «Марк Ковалёв · 12–14 сентября · 4,2 МБ». The day is the memory's own and
  // not the file's — `shotBy` is where that was settled (TASK-94), and this line is built on it
  // rather than beside it. The size is the one thing here that only the record knows.
  const sheet = viewer.slice(viewer.indexOf('<FrameSheet'));
  expect(sheet).toContain('title={s.media[item.kind]}');
  expect(sheet).toContain('meta={[shotBy(item, roster, memory), size === null ? null : s.viewer.size(size)]');
  expect(sheet).toContain('thumb={item.thumbnail_url ?? undefined}');
  expect(ru.viewer.size('4,2')).toBe('4,2 МБ');
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
  expect(viewer.match(/playable !== null \? \(/g)).toHaveLength(3);
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
    // A column worked out from the width the sheet spans, and re-read when the phone turns.
    expect(sheet).toContain('useWindowDimensions()');
    expect(sheet).toContain('GRID_GAP * 2) / 3');
  }
});

test('the head measures out the 168 every face’s body starts at', () => {
  // 52 of status line, a 44 bar, 12, the 44 the switch comes to, 16 — and the body. The bar keeps a
  // height of its own (spec 4: the header line is 44), which is what holds the sheet off it:
  // «контактный лист вплотную к шапке» was the report when it did not.
  expect(bars).toContain('minHeight: height.bar');
  // The whole of the gap on either side of the switch, and no face adds a second one. The 16 at the
  // sides is the switch's own and the failure line's: the bar under them carries the screen's 16
  // itself, and a wrapper holding a second copy of it put this chevron 16 further in than the one on
  // every other screen (found in review, m-21).
  expect(head).toContain(
    'faces: { marginTop: space.s3, marginBottom: space.s4, marginHorizontal: space.s4 }',
  );
  expect(head).not.toContain('head: { paddingHorizontal');
  // Spec 7.3: a memory's own header pill is the shorter segment, 36 rather than 40 — the other 8
  // of those 44 are the pill's own padding.
  const segment = head.slice(head.indexOf('<Segment'));
  expect(segment.slice(0, segment.indexOf('/>')).split('\n').map((line) => line.trim())).toContain(
    'sm',
  );
  // And the sheet under it stands inside the screen's 16 like everything else, not bled to the
  // edges: at 390 that is what makes a frame of the grid 117 square.
  expect(frames).toContain('grid: { flexGrow: 1, gap: GRID_GAP, paddingHorizontal: space.s4 }');
  expect(frames).toContain('(width - space.s4 * 2 - GRID_GAP * 2) / 3');
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
  expect(frames).toContain('count={(draft) => framesMatching(items, draft).length}');
  expect(sheets).toContain('const shown = count(draft);');
  expect(sheets).toContain('label={shown === 0 ? s.gallery.nothingMatched : s.gallery.show(shown)}');
  // A filter that would leave nothing cannot be applied at all, and the button says why rather than
  // offering «Показать 0 кадров».
  expect(sheets).toContain('disabled={shown === 0}');
  expect(ru.gallery.show(486)).toBe('Показать 486 кадров');
  expect(ru.gallery.nothingMatched).toBe('Ничего не подошло');
  // Seeded by being mounted: both sheets are drawn only while open, so the draft starts at whatever
  // is applied right now and a sheet closed any other way leaves the gallery as it was.
  expect(frames).toContain("{tuning === 'filter' ? (");
  expect(frames).toContain("{tuning === 'sort' ? (");
  expect(sheets).toContain('useState<Filter>(value)');
});

test('the first chip of a filter row is the absence of a choice', () => {
  // «Все» and «Все дни» are an empty set and not a value of their own, which is the whole reason a
  // set is what the filter holds.
  expect(sheets).toContain('selected={draft.people.size === 0}');
  expect(sheets).toContain('selected={draft.days.size === 0}');
  expect(sheets).toContain('onPress={() => setDraft((have) => ({ ...have, people: new Set() }))}');
  expect(ru.gallery.anyone).toBe('Все');
  expect(ru.gallery.anyDay).toBe('Все дни');
  // Only people who actually brought something are offered, and only days the gallery holds.
  expect(frames).toContain('people={brought}');
  expect(frames).toContain('days={days}');
  expect(frames).toContain('framesByDay(items ?? []).map((day) => day.at)');
});

test('the sort takes effect as it is pressed, and «Готово» is only the way out', () => {
  // Nothing to preview here — the sheet stands over the sheet it is rearranging — so the answer
  // goes straight up and the button at the bottom closes and nothing else.
  expect(frames).toContain('<SortSheet value={sort} onChange={setSort} onDone={() => setTuning(null)} />');
  expect(sheets).toContain('onChange={(by: GroupBy) => onChange({ ...value, by })}');
  expect(sheets).toContain('onChange={(order: Order) => onChange({ ...value, order })}');
  expect(sheets).toContain('label={s.action.done}');
  expect(ru.gallery.groups.day).toBe('По дням');
  expect(ru.gallery.groups.person).toBe('По людям');
  expect(ru.gallery.orders.newest).toBe('Сначала новые');
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
  expect(people).toContain(
    "const here = (members ?? []).find((member) => member.username?.toLowerCase() === needle);",
  );
  expect(people).toContain('here !== undefined ||');
  expect(people).toContain('here\n                ? s.members.already(memberName(here), s.role[here.role])');
});

test('a contact already on the roster is not offered a second invite', () => {
  expect(people).toContain(
    '!members?.some((member) => member.id === contact.id) && matches(contact, needle)',
  );
  // And the block itself is not drawn at all once that leaves nobody to offer — no contacts saved,
  // or every one of them already here.
  expect(people).toContain('{pickable.length > 0 ? (');
});

test('a second «Позвать» pressed under the first is refused while the call is in the air', () => {
  // Found in review: without the guard, a second press unlocked the field mid-flight and let
  // whichever answer landed last be read as the answer to the last press. One button on the sheet
  // since TASK-145, so the guard is the sheet's own `busy` rather than the id of a spinning row.
  expect(people).toContain('if (!handle || busy) return;');
});

/**
 * The sheet the layout draws (TASK-145, `SheetInvite`): one field, the saved people as chips under
 * it, the link under a rule, and one «Позвать» at the foot. Two roads in and one press — so what is
 * pinned here is that the press can only ever be about one person.
 */

test('a chip and the field are one slot: what the button sends to is never two people', () => {
  // Picked out of the chips, or turned up by the typed name — and typing lets the chip go, so the
  // two cannot both be holding somebody when the button is pressed.
  expect(people).toContain(
    "const target = here ? null : (picked ?? saved ?? (found === 'none' ? null : found));",
  );
  expect(people).toContain('setPicked(picked?.id === contact.id ? null : contact);');
  expect(people).toContain('disabled={target === null}');
  // And a chip already pressed in is what the kit draws filled — the same «выбран» a filter chip
  // wears, never a second mark invented by this face.
  expect(people).toContain('selected={picked?.id === contact.id}');
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
