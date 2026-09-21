import { expect, test } from 'vitest';

import api from './api.ts?raw';
import layout from './app/_layout.tsx?raw';
import build from './app/memory/[id]/order/build.tsx?raw';
import frames from './app/memory/[id]/order/index.tsx?raw';
import wizardLayout from './app/memory/[id]/order/_layout.tsx?raw';
import music from './app/memory/[id]/order/music.tsx?raw';
import story from './app/memory/[id]/order/story.tsx?raw';
import summary from './app/memory/[id]/order/summary.tsx?raw';
// Where the order lands. The waiting screen became `MontageLive` in TASK-221 and moved into a
// folder of its own, because the journal of one stage lives under it.
import live from './app/memory/[id]/montage/[montageId]/index.tsx?raw';
import films from './memory/films.tsx?raw';
import model from './montage.ts?raw';
import wizard from './order-wizard.tsx?raw';
import { en, ru } from '@/strings';

/**
 * Ordering a movie, as spec 8 asks for it: a route per step, one set of answers above all of them,
 * and one call at the end. Read as text and not as rendered screens, for the reason
 * `memory-screens.test.ts` gives at length — this project has no renderer, and what is worth
 * pinning about a reorganisation is its shape. The arithmetic these screens stand on is checked
 * where it lives, in `montage.test.ts`.
 */

const steps = { frames, story, music, build, summary };

test('the wizard is a folder of steps, and no step declares another', () => {
  // The whole wizard is still one screen to the app around it — the route the movies face pushes.
  expect(layout).toContain('<Stack.Screen name="memory/[id]/order"');
  expect(films).toContain("router.push({ pathname: '/memory/[id]/order', params: { id } })");

  // Inside it, a step is a file. The layout names none of them, which is the point: a step added
  // by the cards after this one is a file added to the folder and nothing else touched.
  expect(wizardLayout).toContain('<Stack screenOptions={{ headerShown: false }} />');
  expect(wizardLayout).not.toContain('Stack.Screen');
  expect(wizard).toContain('export const STEPS = 4;');

  // Each step draws itself in the shared shell and gets its bar, its way back and its way out
  // from it — «Шаг N из 4» is written in one place for all four.
  for (const step of Object.values(steps)) {
    expect(step).toContain('<WizardStep');
    expect(step).not.toContain('<WizardBar');
    expect(step).not.toContain('<Board>');
  }
  expect(wizard).toContain('label={summary ? s.montage.summaryStep : s.montage.step(step as number, STEPS)}');
  expect(wizard).toContain('label={s.action.cancel}');
});

test('what was answered lives above the steps, so walking back and forth loses nothing', () => {
  // The answers and the material are the layout's, not any step's: a step is unmounted the moment
  // the next one is pushed, and state held in one would go with it.
  expect(wizardLayout).toContain('<OrderProvider id={id}>');
  expect(wizard).toContain('const [order, setOrder] = useState<Order>(blankOrder);');
  expect(wizard).toContain('listMedia(token, id).then(setItems');
  for (const step of Object.values(steps)) {
    expect(step).toContain('useOrder()');
    expect(step).not.toContain('useState<Order>');
    expect(step).not.toContain('listMedia(');
  }

  // Forward is a push, so the step behind stays on the stack and the back gesture is the step's
  // own; «Отмена» drops every one of them at once, whichever step it is pressed on.
  expect(frames).toContain("router.push({ pathname: '/memory/[id]/order/story', params: { id } })");
  expect(story).toContain("router.push({ pathname: '/memory/[id]/order/music', params: { id } })");
  expect(music).toContain("router.push({ pathname: '/memory/[id]/order/build', params: { id } })");
  // The last of the four leads to the total and not to the making: step 4 stops being the end of
  // the wizard the moment the summary exists (TASK-218).
  expect(build).toContain(
    "router.push({ pathname: '/memory/[id]/order/summary', params: { id } })",
  );
  expect(wizard).toContain('router.dismissAll();');
});

test('«Отмена» over a walk with something in it asks before it throws it away', () => {
  // The shell asks it, so the question is the same on whichever step it is pressed — and it is the
  // gentle sheet, because nothing is destroyed here except a walk through four steps.
  expect(wizard).toContain('onPress={() => (entered(order) ? setLeaving(true) : leave())}');
  expect(wizard).toContain('variant="gentle"');
  expect(wizard).toContain('title={s.montage.leaveAsk}');
  // Nothing said is nothing to confirm, and `leave()` itself stays silent: «Позже» on
  // `SheetTooLittle` presses the same function, and one sheet must not raise another.
  expect(wizard).toContain('const leave = useCallback(() => {\n    router.dismissAll();');
  expect(ru.montage.leaveAsk).toBe('Выйти из заказа?');
});

test('too little material stops the wizard before its first step, not after its last', () => {
  // Asked once, above every step: `SheetTooLittle` stands in place of the whole wizard, so nobody
  // picks frames, writes a story and chooses music only to be told at the end.
  expect(wizard).toContain('const short = items !== null && !enoughMaterial(items);');
  expect(wizard).toContain('<Sheet\n        visible={short}');
  expect(wizard).toContain("router.replace({ pathname: '/memory/[id]/upload', params: { id } })");
  // And no step draws itself while that sheet is up — the shell holds its body and its button
  // back, so a step written later is silent there without a line of its own.
  expect(wizard).toContain('items === null || short || !action ? null : (');
});

test('step 1 rules the automatic pass, and cannot leave the order below the floor', () => {
  // The pass reports on the grid and explains itself in the sheet; the organizer overrules it in
  // either direction, and «Вернуть все» adds to what was already taken back.
  expect(frames).toContain('onPress={() => change(afterTap(item, order))}');
  expect(frames).toContain('rejectedGroups(material, order).map(');
  expect(frames).toContain('label={s.montage.bringBackAll(passDropped.length)}');
  expect(frames).toContain('returned: new Set([...order.returned, ...passDropped.map((item) => item.id)]),');
  expect(frames).toContain('onCancel={() => setShowDropped(false)}');
  // No way into the sheet while the pass has dropped nothing — an empty report is not a button.
  expect(frames).toContain('{passDropped.length > 0 ? (');

  // The floor holds on what was picked and not only on what the memory holds: the api counts the
  // ready material for its 409 and never the selection (found in review, m-23). The button goes
  // dark, and the line over it says what to do about it rather than leaving it a mystery.
  expect(frames).toContain('const enough = inMovie.length >= MIN_FRAMES;');
  expect(frames).toContain('disabled={!enough}');
  expect(frames).toContain('{s.montage.keepAtLeast(MIN_FRAMES)}');
  expect(ru.montage.keepAtLeast(3)).toBe('Оставьте хотя бы 3 кадра');
  expect(en.montage.keepAtLeast(1)).toBe('Keep at least 1 frame');
  // And the count on the button is the count going in, said in frames.
  expect(frames).toContain('label={s.montage.nextWith(inMovie.length)}');
});

test('step 2 is skippable, and the plate says whose words are in the box', () => {
  // Nothing here is required: the button says «Дальше» whatever is in the box, and an empty box is
  // the director deciding.
  expect(story).toContain('label={s.montage.next}');
  expect(story).not.toContain('disabled');
  expect(ru.montage.storyTitle).toBe('Как смонтировать этот ролик');
  expect(ru.montage.storyHint).toBe('Можно пропустить — тогда режиссёр решит сам.');

  // The plate is the template's while the words are the template's, and the person's the moment
  // they type — which is the whole of «текст правили — шаблон становится своим».
  expect(story).toContain('{template ? (');
  expect(story).toContain('<ChipTemplate');
  expect(story).toContain('icon={order.ownStory ? undefined : TEMPLATE_SIGN[template]}');
  expect(story).toContain('? s.montage.ownText');
  expect(story).toContain(': s.montage.fromTemplate(s.montage.template[template])');
  expect(story).toContain('onChangeText={(story) => change({ story, ownStory: true })}');
  // The six templates the api hands out have a word each in both sets, by its own ids.
  const ids = [...api.matchAll(/^  \| '(\w+)'/gm)].map(([, id]) => id);
  expect(ids).toEqual(['for_myself', 'quick', 'report', 'short_form', 'parents', 'dopamine']);
  // In the api's own order, which is the order of the tiles on the screen that starts the order.
  for (const set of [en, ru]) expect(Object.keys(set.montage.template)).toEqual(ids);
});

test('one call at the end of the walk, and it carries every wish of spec 8', () => {
  // Nothing leaves the phone until the last button, which is the summary's: only the screen that
  // has it calls the api at all, and their own track — sent when it is picked — is the one
  // exception, so that the last button is one call and not two.
  expect(summary).toContain('const made = await orderMontage(token, id, wishes(items, order));');
  for (const step of [frames, story, music, build]) expect(step).not.toContain('orderMontage');
  expect(music).toContain('await sendOwnTrack(token, id,');

  // Every field of the body the api takes is named in the client, the list of tracks included —
  // and the two old single-track fields are still readable, because an older montage's card is
  // still drawn from them.
  for (const wish of [
    'target_seconds',
    'story_text',
    'include_media_ids',
    'exclude_media_ids',
    'music_tracks',
    'music_note',
    'orientation',
    'music_track_id',
    'music_track_key',
  ]) {
    expect(api).toContain(`${wish}?`);
  }
  // The three routes of an order, and the summary asks with the same body the order sends.
  expect(api).toContain('/montage-templates');
  expect(api).toContain('/montages/preview');
  expect(api).toContain('export function previewMontage(');
  expect(api).toContain('export function listMontageTemplates(');
  // The length and what will be in the film come from the api and are worked out nowhere here.
  // The last step reads the range off the preview and draws it; no other screen of the wizard, and
  // nothing in the model behind them, counts a second of material for itself.
  expect(build).toContain('previewMontage(token, id, {');
  expect(build).toContain('min={preview.min_seconds}');
  expect(build).toContain('max={preview.max_seconds}');
  for (const step of [frames, story, music]) {
    expect(step).not.toContain('max_seconds');
    expect(step).not.toContain('min_seconds');
  }
  expect(model).not.toContain('max_seconds');
});

test('a placed order lands on the waiting for that montage, not back on the list', () => {
  expect(layout).toContain('name="memory/[id]/montage/[montageId]/index"');
  // The wizard hands over the row the api answered with, and the count of frames it took — the one
  // number nobody else can work out, because the api hands back what it wrote and never how many
  // pictures add up to it. `replace`: an order already sent is not a wizard to walk back into.
  expect(summary).toContain("pathname: '/memory/[id]/montage/[montageId]',");
  expect(summary).toContain('params: { id, montageId: made.id, frames: inMovie.length },');
  const sentAt = summary.indexOf('const made = await');
  const sent = summary.slice(sentAt, summary.indexOf('} catch', sentAt));
  expect(sent).toContain('router.replace({');
  expect(sent).not.toContain('leave()');
});

test('neither screen of an order moves the app once the person has walked out of it', () => {
  // Found in review, m-23: `useRouter` hands back the app's own router and not the screen's, so a
  // call still in flight when «Отмена» was pressed went on to move whoever was on top of it. The
  // guard is one hook now, and every screen of the wizard that makes a call takes it.
  expect(wizard).toContain('export function useStillHere()');
  expect(wizard).toContain('gone.current = false;');
  expect(wizard).toContain('gone.current = true;');
  for (const screen of [music, summary]) expect(screen).toContain('useStillHere()');
  expect(live).toContain('const gone = useRef(false);');

  // The order itself is placed and cannot be unsent — what does not happen is the leading
  // anywhere, and the same for a track that lands after the wizard has gone.
  const sentAt = summary.indexOf('const made = await');
  expect(summary.slice(sentAt, summary.indexOf('router.replace', sentAt))).toContain(
    'if (gone.current) return;',
  );
  expect(music).toContain('if (!gone.current) setNotice(errorMessage(e));');
});

test('the shelf can be listened to, and the listening ends with the step', () => {
  // Every row of step 3 carries the round «Послушать» spec 8 draws, and pressing it neither picks
  // the track nor un-picks one: the 36 on the right is what takes it.
  expect(music).toContain('play={');
  expect(music).toContain('s.montage.stopTrack(name) : s.montage.listen(name)');
  expect(music).toContain('onPress={() => flip(track.id)}');
  // The player belongs to the step and not to the wizard around it, which is the whole of «уход со
  // шага музыки останавливает воспроизведение»: the step is a route now, so leaving it really is
  // the screen going away.
  expect(music).toContain('useTrackPreview(token)');
  expect(wizard).not.toContain('useTrackPreview');
  // The shelf is five, in the order the layout draws it, and every one of them is named in both
  // sets — the running times are the worker's files and live beside the ids.
  for (const set of [en, ru]) {
    expect(Object.keys(set.montage.track)).toEqual(['bright', 'warm', 'calm', 'night', 'road']);
  }
  expect(model).toContain("{ id: 'bright', seconds: 80 }");
});

test('step 3 is «Без музыки» until a track is taken, and the block of them after', () => {
  // Nothing taken: the choice card stands where the chosen tracks would be, already chosen. It is
  // an answer and not an absence, and it says what it actually gives — the video's own sound.
  expect(music).toContain('{picked.length === 0 ? (');
  expect(music).toContain('<ChoiceCard');
  expect(music).toContain('icon={VolumeX}');
  expect(music).toContain('title={s.montage.noMusic}');
  expect(music).toContain('note={s.montage.noMusicNote}');
  expect(ru.montage.noMusic).toBe('Без музыки');
  expect(ru.montage.noMusicNote).toBe('Только живой звук из видео');

  // Anything taken: «Выбрано» in its place — how many and how long altogether, the rows, and the
  // one line about how to use them.
  expect(music).toContain('<BlockPicked');
  expect(music).toContain('s.montage.tracksPicked(picked.length)');
  expect(music).toContain('formatRuntime(total)');
  expect(music).toContain('variant="wish"');
  expect(music).toContain('onChangeText={(note) => change({ note })}');
  expect(ru.montage.tracksPicked(2)).toBe('2 трека');
  expect(en.montage.tracksPicked(1)).toBe('1 track');

  // And the last one taken back brings the card straight back and clears the wish with it: the api
  // answers 400 to a note about music nobody picked, and the words were about tracks that are gone.
  expect(music).toContain("change(tracks.length === 0 ? { tracks, note: '' } : { tracks });");
});

test('tracks go in in any number, in the order they play, and that order is dragged about', () => {
  // The shelf adds to the end of the list rather than replacing one answer with another — several
  // at once is the whole of the new step — and their own track lands in the same list.
  expect(music).toContain('change({ tracks: [...picked, { key, name: null }] })');
  expect(music).toContain('change({ tracks: [...picked, { key, name: file.name }] });');

  // The row is dragged by its wave (spec 7.7), and rows are counted rather than measured: every
  // one of them is exactly `TRACK_ROW` tall, which is the kit's own number and not a copy of it.
  expect(music).toContain('grip={{');
  expect(music).toContain('...gripFor(i),');
  expect(music).toContain('Math.round(gesture.dy / TRACK_ROW)');
  expect(music).toContain('change({ tracks: movedTrack(picked, from, to) });');
  // Dragging says nothing to a screen reader, so the same two moves stand as actions on the wave.
  expect(music).toContain('accessibilityActions: MOVES');
  expect(music).toContain('s.montage.moveTrack(name)');

  // «Послушать» stays on every row of the shelf (TASK-172) and on a chosen one off it; a track of
  // their own has no link this app could play, so it has no button pretending otherwise.
  expect(music).toContain('shelf === null ? undefined : (');
  expect(music).toContain('s.montage.stopTrack(name) : s.montage.listen(name)');
});

test('step 4 asks the api how long the film may be, and asks again when the frames change', () => {
  // The preview is the only source of the two walls, and the question leaves the length out of
  // itself: asked with one the material no longer stretches to, the api answers 400, not a range.
  expect(build).toContain('const [preview, setPreview] = useState<MontagePreview | null>(null);');
  expect(build).toContain('target_seconds: undefined,');
  // Asked again on the frames and on nothing else — the id of everything going in is the key.
  expect(build).toContain('const going = taken(material, order)');
  expect(build).toContain('}, [token, id, going]);');
  // A range that came back narrower than the length already chosen brings the length down with it,
  // rather than leaving a figure standing that the order would be refused for.
  expect(build).toContain(
    'const held = Math.min(Math.max(order.seconds ?? 0, answer.min_seconds), answer.max_seconds);',
  );
  expect(build).toContain('if (order.seconds !== null && held !== order.seconds) change({ seconds: held });');
  // Nothing said is the api's own answer shown on the card — and still nothing sent (`@/montage`).
  expect(build).toContain('const seconds = order.seconds ?? preview?.target_seconds ?? null;');
});

test('step 4 draws one length control, and the template’s line goes at the first touch of it', () => {
  // The three round answers are gone from the wizard: the length is a figure on a line now, with
  // five ready answers under it — four numbers and «Всё», which is the ceiling the api just named.
  expect(build).not.toContain('LENGTHS');
  expect(build).toContain('<LengthSlider');
  expect(build).toContain('...PRESETS.map((value) => ({ label: formatRuntime(value) ?? \'\', value })),');
  expect(build).toContain("{ label: s.montage.lengthAll, value: preview.max_seconds },");
  expect(model).toContain('export const PRESETS = [30, 60, 90, 180] as const;');

  // «из шаблона „…“» stands under the figure while the template is the one who put it there, and
  // a hand on the slider makes the number the person's own — `ownStory`'s twin, one step along.
  expect(build).toContain('change({ seconds: next, ownLength: true })');
  expect(build).toContain('template && !order.ownLength');
  expect(model).toContain('ownLength: boolean;');
  expect(ru.montage.lengthFromTemplate('Для родителей')).toBe('из шаблона «Для родителей»');

  // The ceiling stands over the card in words, and the right end of the line says what it means.
  expect(build).toContain('s.montage.lengthUpTo(formatRuntime(preview.max_seconds) ?? \'\')');
  expect(ru.montage.lengthUpTo('9:10')).toBe('до 9:10');
  expect(ru.montage.lengthEnd('9:10')).toBe('9:10 · всё, что есть');
  // The shape is the segments of the layout, and nothing else is asked on this step.
  expect(build).toContain('label={s.montage.shape}');
  expect(build).not.toContain('s.montage.onceOnly');
});

test('the ember is one action per surface, counted over the whole wizard', () => {
  // The kit gives the glow to one action per surface. Step 1 draws two — itself and the sheet of
  // what the pass dropped — the summary draws the one the whole walk leads to, and the shell draws
  // the one on `SheetTooLittle`; the steps between them have a «Дальше» each and nothing else.
  expect(frames.match(/variant="primary"/g)).toHaveLength(2);
  expect(summary.match(/variant="primary"/g)).toHaveLength(1);
  expect(wizard.match(/variant="primary"/g)).toHaveLength(1);
  for (const step of [story, music, build]) {
    expect(step.match(/variant="primary"/g)).toHaveLength(1);
  }
});

test('the summary only shows — every number on it is the api’s answer', () => {
  // The bar over it is the shell's «Итог» view: no scale, because there is no step after it.
  expect(summary).toContain('step="summary"');
  expect(wizard).toContain("const summary = step === 'summary';");
  expect(ru.montage.summaryTitle).toBe('Всё готово к монтажу');

  // One call, with the very body the order sends — so what is totalled is what would be made.
  expect(summary).toContain('previewMontage(token, id, wishes(items, order))');
  // And nothing on the screen is counted here: the photos, the videos, the people, the length and
  // the wait are all read off that answer (doc-03).
  expect(summary).toContain('s.montage.shots(preview.photos, preview.videos)');
  expect(summary).toContain('s.montage.byPeople(preview.people)');
  expect(summary).toContain('formatRuntime(preview.target_seconds)');
  expect(summary).toContain('s.montage.orientation[preview.orientation]');
  expect(summary).toContain('s.montage.readyIn(preview.estimate_minutes)');
  expect(ru.montage.readyIn(15)).toBe('Соберём примерно за 15 минут и пришлём уведомление.');
  expect(ru.montage.readyIn(1)).toBe('Соберём примерно за 1 минуту и пришлём уведомление.');

  // Nothing on it can be edited: the way to change an answer is «Назад» to the step that gave it,
  // and a field here would be a second place where the same thing is decided.
  expect(summary).not.toContain('change(');
  expect(summary).not.toContain('<TextArea');
  expect(summary).not.toContain('<Segment');
  expect(summary).not.toContain('<Slider');

  // It is built of the kit's own parts for this screen and draws no card of its own.
  for (const part of ['<PosterOrder', '<BlockSummary', '<SummarySection', '<SummaryShots']) {
    expect(summary).toContain(part);
  }
  // Music is a list, because the order is: no track at all is an answer and says so in words.
  expect(summary).toContain('order.tracks.map((track, i) =>');
  expect(summary).toContain('{s.montage.noMusicLive}');
  expect(ru.montage.noMusicLive).toBe('Без музыки · живой звук');
  // And the story is read back short, four lines of it, or as the director deciding.
  expect(summary).toContain('numberOfLines={4}');
  expect(summary).toContain("{story === '' ? s.montage.directorDecides : story}");
});

test('a refusal of the summary explains itself and leads back to the step that can undo it', () => {
  // The two the api can answer either call with: the material under the floor, and a length the
  // frames no longer carry. Both are said in this app's words and not in the api's numbers.
  expect(summary).toContain('e instanceof ApiError && e.status === 409');
  expect(summary).toContain('{ text: s.montage.tooLittle, back: \'frames\' }');
  expect(summary).toContain('{ text: s.montage.lengthOff, back: \'length\' }');
  // The way back is a jump to that step and not a walk: after the autopilot (TASK-219) there may
  // be no step behind this screen at all.
  expect(summary).toContain("{ pathname: '/memory/[id]/order', params: { id } }");
  expect(summary).toContain("{ pathname: '/memory/[id]/order/build', params: { id } }");
  expect(summary).toContain('router.dismissTo(');
  // Refused, the screen is a line and a button and never an empty summary of nothing.
  expect(summary).toContain('<Banner tone="error" text={stopped.text}');

  // A refused order leaves the button pressable again — nothing was placed, so there is something
  // to press. A double tap does not place two: the button goes busy, and the press that got in
  // while the first was in flight is turned away.
  expect(summary).toContain('if (!token || items === null || busy) return;');
  expect(summary).toContain('busy={busy}');
  const failedAt = summary.indexOf('setNotice(refusal(e).text);');
  expect(summary.slice(failedAt)).toContain('setBusy(false);');
});
