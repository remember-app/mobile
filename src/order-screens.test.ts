import { expect, test } from 'vitest';

import api from './api.ts?raw';
import layout from './app/_layout.tsx?raw';
import build from './app/memory/[id]/order/build.tsx?raw';
import frames from './app/memory/[id]/order/index.tsx?raw';
import wizardLayout from './app/memory/[id]/order/_layout.tsx?raw';
import music from './app/memory/[id]/order/music.tsx?raw';
import story from './app/memory/[id]/order/story.tsx?raw';
import progress from './app/memory/[id]/montage/[montageId].tsx?raw';
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

const steps = { frames, story, music, build };

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
  expect(wizard).toContain('cancel={<Button variant="quiet" label={s.action.cancel} onPress={leave} />}');
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
  expect(wizard).toContain('router.dismissAll();');
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

test('one call at the end of the last step, and it carries every wish of spec 8', () => {
  // Nothing leaves the phone until the last button: only the step that has it calls the api at
  // all, and their own track — sent when it is picked — is the one exception, so that the last
  // button is one call and not two.
  expect(build).toContain('const made = await orderMontage(token, id, wishes(items, order));');
  for (const step of [frames, story, music]) expect(step).not.toContain('orderMontage');
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
  // The length and what will be in the film come from the api and are worked out nowhere here:
  // no screen of the wizard counts a second of material.
  for (const step of Object.values(steps)) {
    expect(step).not.toContain('max_seconds');
    expect(step).not.toContain('min_seconds');
  }
});

test('a placed order lands on the waiting for that montage, not back on the list', () => {
  expect(layout).toContain('name="memory/[id]/montage/[montageId]"');
  // The wizard hands over the row the api answered with, and the count of frames it took — the one
  // number nobody else can work out, because the api hands back what it wrote and never how many
  // pictures add up to it. `replace`: an order already sent is not a wizard to walk back into.
  expect(build).toContain("pathname: '/memory/[id]/montage/[montageId]',");
  expect(build).toContain('params: { id, montageId: made.id, frames: inMovie.length },');
  const sentAt = build.indexOf('const made = await');
  const sent = build.slice(sentAt, build.indexOf('} catch', sentAt));
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
  for (const screen of [music, build]) expect(screen).toContain('useStillHere()');
  expect(progress).toContain('const gone = useRef(false);');

  // The order itself is placed and cannot be unsent — what does not happen is the leading
  // anywhere, and the same for a track that lands after the wizard has gone.
  const sentAt = build.indexOf('const made = await');
  expect(build.slice(sentAt, build.indexOf('router.replace', sentAt))).toContain(
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
  expect(model).toContain("{ id: 'bright', length: '1:20' }");
});

test('the ember is one action per surface, counted over the whole wizard', () => {
  // The kit gives the glow to one action per surface. Step 1 draws two — itself and the sheet of
  // what the pass dropped — the last step draws its own, and the shell draws the one on
  // `SheetTooLittle`; the two steps between them have a «Дальше» each and nothing else.
  expect(frames.match(/variant="primary"/g)).toHaveLength(2);
  expect(build.match(/variant="primary"/g)).toHaveLength(1);
  expect(wizard.match(/variant="primary"/g)).toHaveLength(1);
  for (const step of [story, music]) expect(step.match(/variant="primary"/g)).toHaveLength(1);
});
