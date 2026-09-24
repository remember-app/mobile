/**
 * The settings of a memory and the editing behind them (spec 8, `MemorySettings`, TASK-209): what
 * the event is called, when it was, whose cover it wears, who is in it and on what footing.
 *
 * Their text and not their rendered output, because this file has no renderer: every test here runs
 * pure logic, and a screen would need `react-native` transformed and `expo-router`, `expo-video` and
 * the safe area all faked before its first line ran. What is worth pinning about a reorganisation is
 * the shape of it — that much the text answers. What these screens *do* is read in the flow tests
 * (`tests/screens/`), where there is a renderer; what stays here is what only the text can say:
 * where a thing stands, and what is no longer in the file.
 */

import { api, flat } from '@tests/helpers/source';
import { expect, test } from 'vitest';
import create from '@/app/create.tsx?raw';
import home from '@/app/index.tsx?raw';
import edit from '@/app/memory/[id]/edit.tsx?raw';
import settings from '@/app/memory/[id]/settings.tsx?raw';
import member from '@/kit/member.tsx?raw';
import cover from '@/screens/memory/cover.tsx?raw';
import when from '@/screens/memory/when.tsx?raw';
import { en, ru } from '@/strings';

test('nobody is shown a way out of a memory, and the organizer keeps the crosses', () => {
  // TASK-113: the human took leaving off the design. The call behind it is untouched and still the
  // one the organizer's cross makes on somebody else — what went is the button that aimed it at
  // oneself.
  expect(settings).not.toContain('s.members.leave');
  expect(settings).toContain('removeMember(session, id, target.id)');
  expect(settings).toContain('label={s.members.remove(memberName(member))}');
  // The one red button the screen has is not a way out of the memory but the end of it (TASK-281,
  // doc-01): the organizer's alone, at the foot of the body under a hairline of its own, the way
  // `Account` stands its own dangerous one — and asked for on a sheet that names the price.
  // What it then does is proven by rendering it, in `settings-flow.test.tsx`; the count here is
  // the one thing a render cannot ask — that there is no *second* red button anywhere on it.
  expect(settings.match(/variant="danger"/g)).toHaveLength(1);
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
  expect(flat(edit)).toContain(
    '{media !== null && pickable.length === 0 ? ( <Hint>{s.edit.coverNeedsFrames}</Hint> ) : null}',
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
  expect(edit).toContain(
    'if (one === null) return setError(errorMessage(new ApiError(404, null)));',
  );
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
