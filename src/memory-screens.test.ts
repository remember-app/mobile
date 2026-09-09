import { expect, test } from 'vitest';

import memory from './app/memory/[id].tsx?raw';
import upload from './app/memory/[id]/upload.tsx?raw';
import home from './app/index.tsx?raw';
import invite from './app/invite.tsx?raw';
import layout from './app/_layout.tsx?raw';
import api from './api.ts?raw';
// The kit files read here: the sheet's offset from the header is the appbar's own padding, and the
// montage card is where the poster a face hands over actually lands.
import bars from './kit/bars.tsx?raw';
import cardMontage from './kit/card-montage.tsx?raw';
import member from './kit/member.tsx?raw';
import toggle from './kit/toggle.tsx?raw';
import films from './memory/films.tsx?raw';
import frames from './memory/frames.tsx?raw';
import head from './memory/head.tsx?raw';
import people from './memory/people.tsx?raw';
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

/** What each `<ActionBar>` of a face holds, in the order they stand in the file. */
function actionBars(face: string): string[] {
  return face
    .split('<ActionBar>')
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
  for (const moved of ['orderMontage', 'retryMontage', 'CardMontage']) {
    expect(films).toContain(moved);
    expect(people).not.toContain(moved);
    expect(frames).not.toContain(moved);
  }
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
  // Two footers in the file — the picking one first, «Добавить кадры» after it — and each of them
  // holds exactly one wide button. «Нижняя кнопка остаётся на месте и в том же весе».
  const bars = actionBars(frames);
  expect(bars).toHaveLength(2);
  for (const bar of bars) expect(bar.match(/wide/g)).toHaveLength(1);
  expect(bars[1]).toContain('label={s.gallery.addMore}');
  // And that button is the only way to the upload screen there is.
  expect(frames).toContain('/memory/[id]/upload');
  expect(films).not.toContain('/memory/[id]/upload');
  expect(people).not.toContain('/memory/[id]/upload');
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
  // An empty sheet has nothing to pick from, so it carries no switch at all — not a greyed one.
  // Unless the mode is already on: the switch is the only way out of it, and the last frame can go
  // from under it while somebody else is deleting.
  expect(frames).toContain('picking || (items !== null && items.length > 0) ? (');
});

test('while picking, a tap marks the frame instead of opening it — and only a ready one', () => {
  // «Ждущие и упавшие кадры не отмечаются: скачивать нечего». Read off the frame and not the
  // record's status, so a `ready` record whose derivative never arrived is out of it too — and
  // asked of `@/frames` rather than spelled out here, because the day's «Выбрать все N» above the
  // strip counts with the same rule and the two must not drift (TASK-121). `mayPick` is where that
  // reading lives, and `frames.test.ts` pins it.
  expect(frames).toContain('const pickable = picking && mayPick(item);');
  expect(frames).toContain('selected={pickable ? picked.has(item.id) : undefined}');
  // The mark is the tile's own — the same ring and tick «Выбор кадров» draws, never a second one.
  expect(frames).not.toContain('tile--selected');
  expect(upload).toContain('selected={picked.has(item.id)}');
});

test('the picking footer is «Снять» beside a download that carries its count', () => {
  const picking = actionBars(frames)[0];
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
 * The contact sheet cut into days (TASK-121, kit «Экраны» 4 «День»): the face drew one flat grid,
 * so there was no daymark over a strip and no «Выбрать все N» to mark a whole day with. The cut is
 * `framesByDay` and pinned in `frames.test.ts`; these read how the sheet is wired to it — the same
 * way the «Выбор кадров» screen was wired to `assetsByDay` before it.
 */

test('the sheet is one flat list of days and strips, never a three-column grid', () => {
  // `numColumns` lays out the list underneath, and it cannot do it *around* the days standing
  // between the strips — so the three across are cut by hand, the way the upload screen cuts them.
  for (const sheet of [frames, upload]) {
    // The props and not the word: both files name `numColumns` in the comment that says why they
    // do without it.
    expect(sheet).not.toContain('numColumns={');
    expect(sheet).not.toContain('columnWrapperStyle={');
    expect(sheet).toContain('data={rows}');
    expect(sheet).toContain('keyExtractor={(row) => row.key}');
    expect(sheet).toContain('frames: day');
  }
  // The days come off `@/frames` and not off `@/media-window`: this face has no event window to
  // sort by — every frame in it is already the event's.
  expect(frames).toContain('framesByDay(items ?? [])');
  expect(frames).not.toContain('assetsByDay');
  // Cut once per read and held, not on every tap: marking a frame is a render, and the sheet of a
  // whole wedding is re-cut in it.
  expect(frames).toContain('const rows = useMemo(');
  expect(frames).toContain('[items],');
});

test('the day over a strip is the date, and the one thing at its right edge', () => {
  const daymark = frames.slice(frames.indexOf('<DayMark'), frames.indexOf('</DayMark>'));
  // The kit's own 16 comes back on this face, where the sheet is bled to the edges of the screen —
  // the component leaves it off for the upload screen, which stands inside the screen's padding.
  expect(daymark).toContain('style={styles.pad}');
  expect(daymark).toContain('label={formatDay(new Date(row.day.at))}');
  // «Правый край всегда занят чем-то одним: числом в обычном виде, „Выбрать все 9“ в режиме
  // выбора» — one slot, a ternary on the mode and never both at once.
  expect(daymark).toContain('{picking ? (');
  expect(daymark).toContain('label={s.gallery.selectDay(markable.length)}');
  // Quiet and small: the glow on this face belongs to the footer's one action, never to a day.
  expect(daymark).toContain('variant="quiet"');
  expect(daymark).toContain('sm');
  // The memory's one word for its material, counted for a single day of it (TASK-76's key).
  expect(daymark).toContain('<Text role="meta">{s.memory.frames(row.day.frames.length)}</Text>');
});

test('«Выбрать все N» counts and marks the frames a tap could reach, and only adds', () => {
  // The count, the gate and the press all read the one list, so the button cannot say «9» and mark
  // eight. The rule itself is `mayPick` — the same one the single tap is gated on.
  expect(frames).toContain('const markable = row.day.frames.filter(mayPick);');
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
    expect(face).not.toContain('/memory/[id]/montage');
  }
});

test('the platform switch is spelled out once, in the kit', () => {
  // TASK-56: the same four colour props stood word for word on two screens, and one of them is the
  // kind nobody notices missing. The invite sheet takes the kit's component now.
  expect(people).toContain('<Toggle');
  for (const face of [frames, films, people]) expect(face).not.toContain('thumbColor');
  expect(toggle).toContain('activeThumbColor');
});

test('the invite sheet is shut when the people face loses focus', () => {
  // TASK-94, off a device: `useFocusEffect(load)` re-read the roster on the way in and did nothing
  // on the way out, so a sheet nobody closed — a push, a deep link, anything that is not the cross
  // or the scrim — stayed a mounted Modal over whatever screen came next. The cleanup the hook runs
  // on blur is the whole fix; the re-read on focus is the same call it always was.
  expect(people).not.toContain('useFocusEffect(load)');
  expect(people).toMatch(
    /useFocusEffect\(\s*useCallback\(\(\) => \{\s*load\(\);\s*return \(\) => setInviting\(false\);/,
  );
  // And the explicit ways out are untouched: the sheet's own cancel still closes it.
  expect(people).toContain('onCancel={() => setInviting(false)}');
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
  expect(films.match(/variant="primary"/g)).toHaveLength(2); // «Смонтировать» + the order sheet
  // One on the people, and the invite sheet has none of its own (TASK-131): the kit redrew that
  // sheet around one field with two answers, and the press that puts somebody in now sits on that
  // person's own row — a `.btn-sm` «Позвать», never a glowing button under the field.
  expect(people.match(/variant="primary"/g)).toHaveLength(1); // «Пригласить», the footer's own
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

test('every row says how many frames that person brought, counted off the gallery', () => {
  // The api keeps no tally on a member, so the roster counts the memory's own listing by uploader.
  // One read, beside the roster's own — and its failure is not the roster's, so it is swallowed.
  expect(people.match(/listMedia\(/g)).toHaveLength(1);
  expect(people).toContain('by.set(item.uploaded_by, (by.get(item.uploaded_by) ?? 0) + 1)');
  expect(people).toContain('count={shots ? s.memory.frames(shots.get(member.id) ?? 0)');
  // The `@ник` under the name, and the rule for leaving it off when it is already the name above —
  // one copy in `api.ts` beside `memberName`, which settles the other half of the same pair. It was
  // written out here and again on the profile head until review pulled it back.
  expect(people).toContain('meta={memberHandle(member)}');
  // Swallowed, and nothing written on the way out. This read runs again on every focus, so a
  // failure on the way back from the upload screen used to blank a column of counts that was
  // already on screen and right — and nothing on this face retries it, because the banner belongs
  // to the roster. Found in review: never counted earns the dash, counted-then-lost does not.
  expect(people).not.toContain('setShots(null)');
  expect(people).toContain('() => {},');
  // The kit's green belongs to «Всё загрузил» alone: that dot is what the organizer scans for.
  expect(people).toContain("ready={member.contribution_status === 'done'}");
});

test('one’s own standing is the chip that sets it, standing where the word would', () => {
  // It was a `Button` under the row, and that is what came back from the device: the row it hung
  // under stood taller than its neighbours and the stack read ragged (TASK-111). Now it is the
  // kit's `.chip-action`, in the status's own slot — same 26 as the word it replaces.
  expect(people).toContain('<ChipAction');
  expect(people).toContain('label={s.members.sayNothing}');
  expect(people.indexOf('status={')).toBeLessThan(people.indexOf('<ChipAction'));
  expect(people).not.toContain('icon={Check}');
  expect(people).not.toContain('styles.own');
  // Both lines of the row are held to the kit's own constants, so nothing that goes into them —
  // the chip, the cross, a bare word — can change how tall a row is.
  expect(member).toContain('lineHeight: 28');
  expect(member).toContain('minHeight: 26');
  // And the cross beside the name is the kit's small one, with its column held open where the
  // organizer looks at their own row and there is no cross to draw.
  expect(bars).toContain('iconbtnSm: { width: 28, height: 28 }');
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

test('the order sheet asks three things, and all three go out with the order', () => {
  // TASK-126: orientation joined the length and the track. Horizontal is the state the sheet opens
  // in and the one the api reads out of a body that never mentions it, so an untouched sheet orders
  // what it always ordered — and the two words on the buttons come off the dictionary like the rest.
  expect(films).toContain("useState<MontageOrientation>('landscape')");
  expect(films).toContain('orientation,');
  expect(films).toContain('label={s.montage.orientation[way]}');
  expect(api).toContain("export type MontageOrientation = 'landscape' | 'portrait';");
  for (const set of [en, ru]) {
    expect(Object.keys(set.montage.orientation)).toEqual(['landscape', 'portrait']);
    expect(set.montage.shape).toBeTruthy();
  }
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

test('the films face reads again by itself while a montage is being cut (TASK-125)', () => {
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

  const asksAt = films.indexOf('const stillMaking');
  // On one line: where the expression wraps is the formatter's business, not this test's.
  const asking = films.slice(asksAt, films.indexOf('/**', asksAt)).replace(/\s+/g, ' ');
  for (const status of pending) expect(asking).toContain(`'${status}'`);
  // And the two the worker is done with are not a reason to keep asking — a face left polling over
  // a finished list is the same bug the other way round, forever.
  for (const settled of ['ready', 'failed']) expect(asking).not.toContain(`'${settled}'`);
  // Nothing read yet is nothing to wait for: the first read is what starts the loop.
  expect(asking).toContain('?? false');

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
  expect(films).toContain('useFocusEffect(load);');
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

// The open frame, read the same way. What was reported is a shape — «во весь экран без кнопок
// снизу, а снизу лента» — and a shape is what these pin: where the actions went, and that the strip
// is the grid's own list read once. Everything the strip decides is pinned properly in
// `frames.test.ts`; these three only guard the layout from drifting back.

test('nothing stands under the open frame — the actions moved up onto it', () => {
  // The bottom bar of the viewer and the style it wore are gone; the grid keeps its own.
  expect(frames).not.toContain('styles.bar');
  expect(frames).toContain('styles.viewerBar');
  for (const action of [
    'label={s.action.close}',
    'label={s.action.download}',
    'label={s.action.delete}',
  ]) {
    expect(frames.slice(frames.indexOf('styles.viewerBar'))).toContain(action);
  }
  // And they are still the same three errands, the delete still behind the kit's sheet.
  expect(frames).toContain('ConfirmSheet');
  expect(frames).toContain('void save(shown)');
});

test('the darkening over the open frame is anchored to the safe area, not stretched by it', () => {
  // The report from a real iPhone (TASK-109): the name and the date lay on the photograph with
  // nothing under them. The kit's bar is 72px and its fade spends all of itself over that; this one
  // is the same bar with the phone's safe area added to its top, so a fade with no stops is
  // stretched to 131px on a notched phone and spends most of its ink behind the status bar, where
  // there is nothing to read. The name lands two thirds down instead of a third — .29 of darkening
  // instead of .52.
  //
  // What pins the fix is that the darkening is written from the same inset the padding is: full
  // strength to the end of the safe area, the kit's own fade below it, on every phone. A gradient
  // spelled out in the sheet cannot know the inset, so the sheet is where it must not be.
  const bar = frames.slice(frames.indexOf('styles.viewerBar'), frames.indexOf('pointerEvents='));
  expect(bar).toContain('paddingTop: insets.top + space.s2');
  expect(bar).toContain('rgba(20,17,15,.86) ${insets.top}px');
  // And the stretched one is gone from the sheet, where it had no inset to read.
  expect(frames.slice(frames.indexOf('const useStyles'))).not.toContain('linear-gradient');
});

test("the strip under the frame is the grid's own list, read once", () => {
  // The whole list and not a window on it: the strip is handed `items`, the same array the sheet
  // above draws.
  expect(frames).toContain('data={items}');
  // One read of the media serves both the sheet and the strip.
  expect(frames.match(/listMedia\(/g)).toHaveLength(1);
});

test('the strip is walked to the open frame, never started at it', () => {
  // `initialScrollIndex` is the prop this obviously wants and the one that broke it: it pins the
  // render window on the frame it names until a scroll event arrives, and a strip short enough to
  // fit on screen never scrolls, so the event never comes. Opened on the fifth of seven frames the
  // strip drew three, with a blank where the first four belonged and no way to reach them — the
  // whole point of the strip, lost, on every gallery small enough not to overflow the screen.
  // The prop and not the word: the comment above the fix names it, and has to be free to.
  expect(frames).not.toContain('initialScrollIndex={');
  // Asked for once the strip knows how wide it is instead, which positions it the same way without
  // touching the window.
  expect(frames).toContain('strip.current?.scrollToIndex({ index: frameIndex(items, open)');
  // `scrollToIndex` on a list this long is only safe because every tile is a known size.
  expect(frames).toContain('getItemLayout');
});

test('the walk is hung on the strip’s own width, not on the size of its content', () => {
  // Both halves of the old spelling were wrong on a real phone, and each cost the same pair of
  // symptoms — a strip that will not scroll and a tile that will not open a frame.
  //
  // `onContentSizeChange` unlatched fired far too often: it is the scroll row's own `onLayout`, so
  // it came back every time a frame landed, and each one hauled the strip back to the open frame
  // from under the finger (TASK-106). Latched to fire once, it fired at the wrong moment: an iOS
  // modal is laid out twice, the first commit sized from `RCTScreenSize()` — which swaps width for
  // height on the way the phone is *physically* held — and the content of a horizontal strip is the
  // same width whatever its viewport, so the size of the content never changed between the two
  // commits. One callback, on the wrong one, clamped to nothing, latch spent (TASK-123).
  //
  // So neither: the walk hangs on the strip's own layout, keyed on the width it was computed for.
  expect(frames).not.toContain('onContentSizeChange={');
  const from = frames.indexOf('onLayout={(');
  const walk = frames.slice(from, frames.indexOf('renderItem={(', from));
  expect(walk).toContain('const { width } = e.nativeEvent.layout;');
  expect(walk).toContain('if (walkedAt.current === width) return;');
  expect(walk).toContain('walkedAt.current = width;');
  // A width and not a boolean: a boolean cannot tell the wrong-sized commit from the right one.
  expect(frames).toContain('useRef<number | null>(null)');
  // And no latch left in the face above to be re-armed at the wrong moment — the strip is mounted
  // by the viewer opening and unmounted by it closing, so a ref born with it is already «once per
  // opening». That is what the `[viewing]` effect was standing in for, and it is gone with it.
  expect(frames).not.toContain('walked.current');
  expect(frames).not.toContain('const viewing = open !== null;');
});

test('a strip tile and a sheet tile read a record the same way', () => {
  // `frameOf` twice and nowhere else: the two places that draw a record must not drift, which is
  // the bug the whole of `@/frames` exists to have fixed once.
  expect(frames.match(/frameOf\(item\)/g)).toHaveLength(2);
});

test('neither the sheet nor the strip opens a frame that is still developing', () => {
  // The exact ternary and not just a call count: swapping which branch is `undefined` would still
  // match `mayOpen(item)` twice while opening exactly the records this gate exists to stop. This
  // was the bug fixed in review — a tap on a waiting frame opened a whole screen saying
  // «Preparing…», which is what was reported.
  //
  // Twice still, in two spellings: the strip has only ever done one thing with a tap — and it hands
  // the id back up rather than setting the face's own state, being its own component now — while
  // the sheet asks whether it is picking first, the same gate on the branch that still opens.
  //
  // Read with the whitespace squeezed out: what is pinned is which branch opens a frame, and the
  // tile moved two levels deeper the day the sheet was cut into days (TASK-121) — a ternary held to
  // the column it happened to be formatted in fails on a reindentation that changed nothing.
  const gate = 'mayOpen(item) ? () => setOpen(item.id)';
  expect(frames.replace(/\s+/g, ' ')).toContain(gate);
  expect(frames).toContain('onPress={mayOpen(item) ? () => onOpen(item.id) : undefined}');
});

test('the frame shown full screen is read for the phone, the tiles for a tile', () => {
  // `openFrameOf` and not `frameOf` (TASK-120): the tile's 640px thumbnail drawn over the whole of a
  // phone is the mush that was reported, so the viewer asks for the big derivative first. Not
  // `shown.preview_url` read straight either — both readings carry the fallen-frame correction for
  // a `ready` record with nothing on it, which is the «could not be prepared» state rather than a
  // broken image, and only `openFrameOf` keeps the thumbnail as the fallback under it.
  expect(frames).toContain('const openFrame = shown === null ? null : openFrameOf(shown);');
  expect(frames).toContain('<Image');
  expect(frames).toContain('source={{ uri: openFrame.uri }}');
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
    expect(sheet).toContain('SHEET_GAP * 2) / 3');
  }
});

test('the 12 under the appbar is the kit’s own, and the switch keeps its own 16 under it', () => {
  // «Контактный лист вплотную к шапке» was the report; `.appbar{padding:var(--s4) 0 var(--s3)}` is
  // where the kit keeps that 12, and the kit's appbar has carried it since m-7. Pinned so the sheet
  // cannot end up flush against the header by the padding being dropped from underneath it.
  expect(bars).toContain('paddingBottom: space.s3');
  // `.screen__head .segment-wide{margin-bottom:var(--s4)}` — the whole of the gap between the switch
  // and whatever the face draws under it. No face adds a second one.
  expect(head).toContain('faces: { marginBottom: space.s4 }');
  expect(frames).toContain('grid: { flexGrow: 1, gap: SHEET_GAP }');
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
  // Found in review: without the guard, a second press took the spinner off the first row, unlocked
  // the field mid-flight, and let whichever answer landed last be read as the answer to the last
  // press.
  expect(people).toContain('if (!handle || calling !== null) return;');
});

test('the «В контакты» chip reads the contacts list itself, never a flag beside it', () => {
  // A `kept` boolean held next to `invited` could carry a stale answer onto whoever was invited
  // after it — found in review. Deriving it from the list itself cannot drift from what the chip is
  // meant to report.
  expect(people).not.toContain('const [kept, setKept] = useState');
  expect(people).toContain(
    'const kept = invited !== null && (contacts ?? []).some((contact) => contact.id === invited.id);',
  );
  expect(people).toContain('checked={kept}');
  expect(people).toContain('onPress={kept ? undefined : () => keep(invited)}');
});

test('only the typed road leaves the «В контакты» chip — picking from contacts does not', () => {
  // `sendInvite`'s second argument is the whole of the difference between the two roads in doc-10:
  // typed sets `invited` (and so can offer the chip), picked from the list does not.
  expect(people).toContain('onPress={() => sendInvite(contact, false)}'); // from the contacts block
  expect(people).toContain('onPress={() => sendInvite(stranger, true)}'); // the field's own find
  expect(people).toContain('if (typed) {\n          setInvited(added);');
});

test('a tile is read out in the line it is drawn with', () => {
  // «Все кадры названы photo» — the raw `kind` off the api, before the dictionary (TASK-86). What
  // was left after that is the state: both sheets ask the frame, not the record's status, whether
  // there is anything to say past «Фото», and both go through the one helper to ask it.
  expect(frames.match(/nameOf\(item, frame/g)).toHaveLength(2);
  expect(frames).toContain("frame.state === 'ready' ? null : s.gallery.waiting[item.status]");
});
