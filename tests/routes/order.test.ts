import { api, flat } from '@tests/helpers/source';
import { expect, test } from 'vitest';

import layout from '@/app/_layout.tsx?raw';
// Where the order lands. The waiting screen became `MontageLive` in TASK-221 and moved into a
// folder of its own, because the journal of one stage lives under it.
import live from '@/app/memory/[id]/montage/[montageId]/index.tsx?raw';
import wizardLayout from '@/app/memory/[id]/order/_layout.tsx?raw';
import build from '@/app/memory/[id]/order/build.tsx?raw';
import frames from '@/app/memory/[id]/order/frames.tsx?raw';
// The way into the order, and the route the movies face has always pushed: `index.tsx` is the
// screen of six templates since TASK-219, and step 1 is a file beside it.
import templates from '@/app/memory/[id]/order/index.tsx?raw';
import music from '@/app/memory/[id]/order/music.tsx?raw';
import story from '@/app/memory/[id]/order/story.tsx?raw';
import summary from '@/app/memory/[id]/order/summary.tsx?raw';
import model from '@/lib/montage/order.ts?raw';
import films from '@/screens/memory/films.tsx?raw';
import wizard from '@/screens/order/wizard.tsx?raw';
import { en, ru } from '@/strings';

/**
 * Ordering a movie, as spec 8 asks for it: a route per step, one set of answers above all of them,
 * and one call at the end. Read as text and not as rendered screens, for the reason
 * `tests/routes/memory/screen.test.ts` gives at length — this project has no renderer, and what is worth
 * pinning about a reorganisation is its shape. The arithmetic these screens stand on is checked
 * where it lives, in `montage.test.ts`.
 */

const steps = { templates, frames, story, music, build, summary };

test('the wizard is a folder of steps, and no step declares another', () => {
  // The whole wizard is still one screen to the app around it — the route the movies face pushes.
  // That route is the screen of templates now, which is why the strip of movies needed no edit:
  // «Новый ролик» leads where it always did, and what stands there changed underneath it.
  expect(layout).toContain('<Stack.Screen name="memory/[id]/order"');
  expect(films).toContain("router.push({ pathname: '/memory/[id]/order', params: { id } })");

  // Inside it, a step is a file. The layout names none of them, which is the point: a step added
  // by the cards after this one is a file added to the folder and nothing else touched.
  expect(wizardLayout).toContain('headerShown: false,');
  expect(wizardLayout).not.toContain('Stack.Screen');
  expect(wizard).toContain('export const STEPS = 4;');

  // Spec 6: a step slides in sideways, the same way on both phones, and under «reduce motion» it
  // is simply there (TASK-279).
  expect(wizardLayout).toContain("animation: reduced ? 'none' : 'slide_from_right',");
  expect(wizardLayout).toContain('animationDuration: duration.step,');

  // Each step draws itself in the shared shell and gets its bar, its way back and its way out
  // from it — «Шаг N из 4» is written in one place for all four.
  for (const step of Object.values(steps)) {
    expect(step).toContain('<WizardStep');
    expect(step).not.toContain('<WizardBar');
    expect(step).not.toContain('<Board>');
  }
  expect(wizard).toContain('? s.montage.step(step, STEPS)');
  expect(wizard).toContain('label: s.action.cancel,');
});

test('what was answered lives above the steps, so walking back and forth loses nothing', () => {
  // The answers and the material are the layout's, not any step's: a step is unmounted the moment
  // the next one is pushed, and state held in one would go with it.
  expect(wizardLayout).toContain('<OrderProvider id={id}>');
  expect(wizard).toContain('const [order, setOrder] = useState<Order>(blankOrder);');
  expect(wizard).toContain('listMedia(token, id).then(setItems');
  // Read on the way in, and again only by `reread` — «Повторить» over a failed read, and a refusal
  // leading back.
  expect(wizard).toContain('useEffect(reread, [reread]);');
  expect(wizard).toContain('label={s.action.retry} onPress={reread}');
  for (const step of Object.values(steps)) {
    expect(step).toContain('useOrder()');
    expect(step).not.toContain('useState<Order>');
    expect(step).not.toContain('listMedia(');
  }

  // Forward is a push, so the step behind stays on the stack and the back gesture is the step's
  // own; «Отмена» drops every one of them at once, whichever step it is pressed on.
  expect(templates).toContain(
    "router.push({ pathname: '/memory/[id]/order/frames', params: { id } })",
  );
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
  expect(wizard).toContain('if (entered(order)) setLeaving(true);');
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
  // The count of frames, or the api's own 409 where the count cannot see it (`tooLittle`).
  expect(wizard).toContain('const short = items !== null && (refused || !enoughMaterial(items));');
  expect(wizard).toContain('<Sheet\n        visible={short}');
  expect(wizard).toContain("router.replace({ pathname: '/memory/[id]/upload', params: { id } })");
  // Spec 8: the square beside the heading wears the montage's own sign, `panels-top-left` (spec 5,
  // 10.11 — not `layout-grid`), and the text under it counts the frames there really are — the
  // layout's «3 кадра» is a figure set by hand.
  expect(wizard).toContain('<Icon icon={PanelsTopLeft} size={26} color={color.muted} />');
  expect(summary).toContain('icon={PanelsTopLeft}');
  expect(`${wizard}${summary}`).not.toContain('LayoutGrid');
  // Two main 56s whose glyph the layout draws apart from the kit's 19 / 2.1 (spec 8): «Начать
  // монтаж» at 19 / 1.9, the pencil of «Настроить самому» at 17 / 1.8 (`MontageTemplate.json`).
  expect(summary).toContain('glyph={{ size: 19, stroke: 1.9 }}');
  expect(templates).toContain('glyph={{ size: 17, stroke: 1.8 }}');
  // And that pencil is the layout's own pen, tighter than Lucide's (TASK-398: 15 × 15 of ink
  // against 13.7 × 13.0).
  expect(templates).toContain('icon={DRAWN.pen}');
  expect(wizard).toContain('{s.montage.tooLittleText(material.length)}');
  // And no step draws itself while that sheet is up — the shell holds its body and its button
  // back, so a step written later is silent there without a line of its own. The screen of
  // templates is inside that silence too: a tile that cannot be pressed into an order is not a
  // tile to press.
  expect(wizard).toContain('items === null || short ? null : auto !== null ? (');
});

test('an order starts from six templates, and the tile is the api’s figures in the app’s words', () => {
  // Read once on the way in, and the six come back in the api's own order — the order of the
  // tiles. Nothing on this screen is counted or sorted here.
  expect(templates).toContain('listMontageTemplates(token, id).then(');
  expect(templates).toContain('templates.map((one, i) => (');
  expect(templates).toContain('<TileTemplate');
  // The name and the character are the dictionary's, by the api's id; the length and the shape
  // are the answer's, and «3:00 · 16:9» is those two put together.
  expect(templates).toContain('title={s.montage.template[one.id]}');
  expect(templates).toContain('note={s.montage.templateNote[one.id]}');
  expect(templates).toContain(
    "spec={`${formatRuntime(one.target_seconds) ?? ''} · ${RATIO[one.orientation]}`}",
  );
  expect(templates).toContain('icon={TEMPLATE_SIGN[one.id]}');
  for (const set of [en, ru]) {
    expect(Object.keys(set.montage.templateNote)).toEqual(Object.keys(set.montage.template));
  }
  expect(ru.montage.templateTitle).toBe('Каким будет ролик');
  expect(ru.montage.templateHint).toBe('Выберите шаблон — дальше всё соберётся само.');

  // One press is the whole order; the other door walks the same four steps from nothing, which is
  // what the blank order is for — a template pressed and abandoned must not follow them in.
  expect(templates).toContain('onPress={() => start(one)}');
  expect(templates).toContain('change(blankOrder());');
  expect(ru.montage.ownSetup).toBe('Настроить самому');

  // The read can fail, and then the screen says so with a way to ask again — and the door beside
  // it stays open, because an order can be walked by hand without a single template.
  expect(templates).toContain('<Banner tone="error" text={notice}');
  expect(templates).toContain('label={s.action.retry}');
  expect(templates).toContain('setAgain((n) => n + 1);');
  expect(templates).toContain('}, [token, id, again, tooLittle]);');
  // Nothing else on the screen asks the api anything: the material behind the tiles is the
  // wizard's own read, and the order itself is sent from the summary.
  expect(templates).not.toContain('orderMontage');
  expect(templates).not.toContain('previewMontage');
});

test('the autopilot fills each step on the step, and ends on the summary', () => {
  // It lives above the steps, with the answers: a walk that pushes a step would otherwise be
  // unmounted by the step it pushed.
  expect(wizard).toContain('const start = useCallback(');
  expect(wizard).toContain('const fill = fromTemplate(template);');
  expect(wizard).toContain('setAuto(template.id);');

  // The four steps in order, each one pushed and then filled — and the walk ends on the total,
  // where the button is the person's again.
  const flying = wizard.slice(wizard.indexOf('const start = useCallback('));
  const walk = [
    "router.push({ pathname: '/memory/[id]/order/frames', params: { id } });",
    "router.push({ pathname: '/memory/[id]/order/story', params: { id } });",
    "router.push({ pathname: '/memory/[id]/order/music', params: { id } });",
    "router.push({ pathname: '/memory/[id]/order/build', params: { id } });",
    "router.push({ pathname: '/memory/[id]/order/summary', params: { id } });",
  ].map((push) => flying.indexOf(push));
  expect(walk).not.toContain(-1);
  expect([...walk].sort((a, b) => a - b)).toEqual(walk);
  expect(flying.slice(walk[4])).toContain('setAuto(null);');

  // The story is typed, the tracks arrive one by one and the figure of the length travels: the
  // point of the walk is that it can be watched.
  expect(flying).toContain('change({ story: fill.story.slice(0, at) });');
  expect(flying).toContain('change({ tracks: fill.tracks.slice(0, n) });');
  expect(flying).toContain('change({ seconds: Math.round((fill.seconds * n) / RIDE_STEPS) });');
  // Every step has the same three beats: turned to, filled in, then left standing long enough for
  // what landed on it to be read before the next one takes its place (TASK-279).
  expect(flying).toContain('if (!(await going(ENTER_MS)))');
  expect((flying.match(/if \(!\(await going\(READ_MS\)\)\)/g) ?? []).length).toBe(3);
  expect(flying).toContain('if (!(await going(ENTER_MS + READ_MS)))');
  // A track landing is the layout moving, so it is moved into rather than snapped to.
  expect(flying).toContain('soften(FILL_MS);');
  // With motion off none of the filling moves: every field lands whole. The beat itself is the
  // same length either way — that setting is about movement, not about time to read (spec 6).
  expect(flying).toContain('if (reduced) change({ story: fill.story });');
  expect(flying).toContain('if (reduced) change({ tracks: fill.tracks });');
  expect(flying).toContain('if (reduced) change({ seconds: fill.seconds });');
  // One clock for both, and no second set of numbers for the setting to be walked on.
  expect(wizard).toContain('setTimeout(done, ms)');
  expect(wizard).not.toContain('CALM_MS');

  // Stopping is not cancelling: a timer cannot be un-fired, so the walk asks after every wait
  // whether it is still the walk being made, and «Стоп» is that number moving on.
  expect(wizard).toContain('const flight = useRef(0);');
  expect(wizard).toContain('return flight.current === mine;');
  expect(wizard).toContain('flight.current += 1;\n    setAuto(null);');
  expect((flying.match(/if \(!\(await going\(/g) ?? []).length).toBeGreaterThanOrEqual(7);
  // What it fills in is the model's answer and not the screen's: which frames go in is the one
  // thing a template says nothing about.
  expect(model).toContain('export const fromTemplate = (template: MontageTemplate): TemplateFill');
  expect(model).toContain(
    "export type TemplateFill = Omit<Order, 'dropped' | 'returned' | 'seconds'>",
  );
});

test('while the autopilot walks, the bottom layer says so and hands the wheel back', () => {
  // Spec 6: no «Дальше» while nobody is being asked — the line and «Стоп» stand in its place, on
  // whichever step the walk has got to.
  expect(wizard).toContain('{s.montage.autoGoing}');
  expect(wizard).toContain('label={s.montage.autoStop} onPress={stop}');
  expect(ru.montage.autoGoing).toBe('Собираю по шаблону');
  expect(ru.montage.autoStop).toBe('Стоп');
  // And the two buttons in the bar stop it too, on their way to doing what they always did: a
  // hand on either of them is a hand on the wheel.
  expect(flat(wizard)).toContain('onPress={() => { stop(); if (router.canGoBack()) router.back();');
  expect(flat(wizard)).toContain('onPress: () => { stop(); if (entered(order)) setLeaving(true);');
  // Stopped, the step is a step again and everything already filled in stays: the only thing
  // `stop` touches is which walk is the current one.
  const stopping = wizard.slice(wizard.indexOf('const stop = useCallback('));
  expect(stopping.slice(0, stopping.indexOf('}, []);'))).not.toContain('change(');
});

test('the walk stops however the person gets out from under it, and never writes over a hand', () => {
  // The walk only pushes, so a step going away is somebody leaving — the system back gesture, or
  // the whole wizard closing — and a walk still running would push its next step onto the memory.
  expect(wizard).toContain('useEffect(() => stop, [stop]);');
  // Typing into the story while the template types is taking the wheel.
  expect(flat(story)).toContain('onChangeText={(story) => { stop();');

  const flying = wizard.slice(wizard.indexOf('const start = useCallback('));
  // A second template starts clean: nothing of the first one's words, and the words and the figure
  // are the template's again rather than still somebody's own.
  expect(flying).toContain("change({ ...fill, story: '', tracks: [], seconds: null });");
  // «Стоп» mid-word leaves the template's whole text, not half a word — unless a hand has it.
  expect(flying).toContain('change((was) => (was.ownStory ? {} : { story: fill.story }));');
});

test('the wizard’s bar wears three faces, and only the total has nothing on its right', () => {
  // Spec 7.1, detail 3: the four steps carry the scale and the counter, the way in and the total
  // carry neither — and «Отмена» stands on every screen of the walk but the last.
  expect(wizard).toContain("const counted = typeof step === 'number';");
  // The way in and the total are two faces, not one: the way in's heading stands 14 under the row,
  // the total's 12 (`MontageTemplate.html`, `MontageSummary.html`).
  expect(wizard).toContain("const face = counted ? 'step' : summary ? 'summary' : 'entry';");
  // The bar and the heading under it wear the same face: the heading is its own piece of the board
  // (it gives way to the keyboard before the bar's row does, TASK-401), not a part of the bar.
  expect(wizard.match(/variant=\{face\}/g)).toHaveLength(2);
  expect(wizard).toContain(': s.montage.newOne');
  expect(flat(wizard)).toContain('cancel={ summary ? undefined : {');
  expect(templates).toContain('step="templates"');
  expect(summary).toContain('step="summary"');
  // The «Назад» is on all of them: from the way in it is the way out of the wizard, because there
  // is no step behind it.
  expect(wizard).toContain('label={s.action.back}');
});

test('step 1 rules the automatic pass, and cannot leave the order below the floor', () => {
  // The pass reports on the grid and explains itself in the sheet; the organizer overrules it in
  // either direction, and «Вернуть все» adds to what was already taken back.
  expect(frames).toContain('onPress={() => change(afterTap(item, order))}');
  expect(frames).toContain('rejectedGroups(material, order).map(');
  expect(frames).toContain('label={s.montage.bringBackAll(passDropped.length)}');
  expect(frames).toContain(
    'returned: new Set([...order.returned, ...passDropped.map((item) => item.id)]),',
  );
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
  expect(flat(story)).toContain('stop(); change({ story, ownStory: true });');
  // The sign of a template is the same picture on its tile and on this plate — and four of the six
  // are the layout's own, tighter drawings (TASK-398: Lucide's heart read 14.7 across the tile
  // against 10.7); the sun is Lucide's own, the phone a drawing Lucide does not have.
  for (const sign of [
    'for_myself: DRAWN.heart',
    'quick: DRAWN.zap',
    'report: DRAWN.fileText',
    'short_form: Smartphone',
    'parents: DRAWN.house',
    'dopamine: Sun',
  ])
    expect(wizard).toContain(sign);
  // The six templates the api hands out have a word each in both sets, by its own ids.
  const ids = [...api.matchAll(/^ {2}\| '(\w+)'/gm)].map(([, id]) => id);
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
  // and nothing it no longer takes: the two old single-track fields are only on `Montage.params`,
  // because an older montage's card is still drawn from them (TASK-226).
  const bodyType = api.slice(api.indexOf('export type MontageWishes = {'));
  const body = bodyType.slice(0, bodyType.indexOf('\n};'));
  for (const wish of [
    'target_seconds',
    'story_text',
    'include_media_ids',
    'exclude_media_ids',
    'music_tracks',
    'music_wishes',
    'orientation',
  ]) {
    expect(body).toContain(`${wish}?`);
  }
  // A wish goes to each track now (TASK-295); the one line for the whole order is not sent any
  // more, and lives on only in `Montage.params`, where an older montage still carries it.
  expect(body).toContain('music_wishes?: Record<string, string>;');
  expect(body).not.toContain('music_note?');
  expect(body).not.toContain('music_track_');
  const paramsAt = api.indexOf('params: MontageWishes & {');
  const params = api.slice(paramsAt, api.indexOf('};', paramsAt));
  for (const old of [
    'music_track_id?: MusicTrackId;',
    'music_track_key?: string;',
    'music_note?: string;',
  ]) {
    expect(params).toContain(old);
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
  expect(music).toContain('if (!gone.current) setNotice(refusal(e).text);');
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

test('step 3 is an empty «Выбрано» until a track is taken, and the tracks in it after', () => {
  // Nothing taken: the block stays where it is and says what the film will sound like — a state
  // and not a choice, so the «Без музыки» card that used to be pressed is gone (spec 7.7, 54).
  expect(music).toContain('{picked.length === 0 ? (');
  expect(music).toContain('count={s.montage.nothingAdded}');
  expect(music).toContain('empty={{ title: s.montage.noMusic, note: s.montage.noMusicNote }}');
  expect(music).not.toContain('ChoiceCard');
  expect(ru.montage.nothingAdded).toBe('ничего не добавлено');
  expect(ru.montage.noMusic).toBe('Ролик будет без музыки');
  expect(ru.montage.noMusicNote).toBe('Только живой звук из видео');

  // Anything taken: how many and how long altogether, and the rows — each with its own wish and
  // no line for all of them, and not one wave among them.
  expect(music).toContain('<BlockPicked');
  expect(music).toContain('s.montage.tracksPicked(picked.length)');
  expect(music).toContain('formatRuntime(total)');
  expect(music).not.toContain('Waveform');
  expect(music).not.toMatch(/\bwave\b/);
  expect(music).not.toContain('footer=');
  expect(ru.montage.tracksPicked(2)).toBe('2 трека');
  expect(en.montage.tracksPicked(1)).toBe('1 track');
  for (const set of [en, ru]) {
    expect(set.montage).not.toHaveProperty('musicNote');
    expect(set.montage).not.toHaveProperty('musicNotePlaceholder');
  }
});

test('a wish is written to one track, behind the pencil in its row', () => {
  // Spec 7.7, detail 54: the pencil is filled once something is written and outlined while not,
  // and says which: «Изменить пожелание к …» or «Как использовать …».
  // The layout's own pen at 15 / 1.9 in the 36 (TASK-398: Lucide's pencil at the circle's 18 read
  // 16 × 16 of ink against 12.3 × 11.7).
  expect(flat(music)).toContain(
    'icon={DRAWN.pen} label={written ? s.montage.wishEdit(name) : s.montage.wishAbout(name)} size={36} glyph={WISH_GLYPH}',
  );
  expect(music).toContain('label={written ? s.montage.wishEdit(name) : s.montage.wishAbout(name)}');
  expect(music).toContain("tone={written ? 'raise' : 'ghost'}");
  expect(ru.montage.wishEdit('Тёплая')).toBe('Изменить пожелание к «Тёплая»');
  expect(ru.montage.wishAbout('Спокойная')).toBe('Как использовать «Спокойная»');

  // The field unfolds under that row alone, one at a time, already holding what was written, with
  // the same question as its hint; it folds when it lets go of the keyboard, and what was written
  // then stands under the name.
  expect(music).toContain('const [open, setOpen] = useState<string | null>(null);');
  expect(music).toContain('setOpen((was) => (was === key ? null : key));');
  expect(music).toContain('onBlur={() => fold(track.key)}');
  expect(music).toContain('variant="wish"');
  expect(music).toContain('placeholder={s.montage.wishAbout(name)}');
  expect(music).toContain("value={track.wish ?? ''}");
  expect(music).toContain('maxLength={WISH_LIMIT}');
  expect(music).toContain('wish={unfolded ? undefined : written || undefined}');
  // Unfolding and folding is the layout moving, so it is moved into (spec 6: 200 ms).
  expect(music).toContain('soften(UNFOLD_MS);');
  expect(music).toContain('const UNFOLD_MS = 200;');

  // Written onto the track and nothing else — so a track taken out takes its wish with it. And
  // typing takes the wheel, as in the story: a template still walking would lay its tracks over it.
  expect(music).toContain('const write = (key: string, wish: string) => {\n    stop();');
  expect(music).toContain('track.key === key ? { ...track, wish } : track');
  expect(music).toContain('change({ tracks: picked.filter((track) => track.key !== key) });');
});

test('tracks go in in any number, in the order they play, and that order is dragged about', () => {
  // The shelf adds to the end of the list rather than replacing one answer with another — several
  // at once is the whole of the new step — and their own track lands in the same list.
  expect(music).toContain('change({ tracks: [...picked, { key, name: null }] })');
  // Their own track lands on the list as it is when the upload ends, not as it was when the picker
  // opened: the shelf stays pressable meanwhile, and what was added there must not be dropped.
  expect(music).toContain(
    'change((was) => ({ tracks: [...was.tracks, { key, name: file.name }] }));',
  );
  // The shelf's tick is `paper`, not `accent` (spec 7.7, detail 53), and still a switch.
  expect(music).toContain("tone={taken ? 'paper' : 'ghost'}");
  expect(music).toContain('on={taken}');

  // A row is dragged by its name (spec 7.7, detail 54), and rows are measured rather than counted:
  // a wish under the name, or an open field, makes a row taller than the kit's own `TRACK_ROW`.
  expect(music).toContain('grip={{');
  expect(music).toContain('...gripFor(i),');
  expect(music).toContain('tall.current[track.key] = e.nativeEvent.layout.height;');
  expect(music).toContain('heights: picked.map((track) => tall.current[track.key] ?? TRACK_ROW),');
  // Counted from where the finger came down, and not off `gesture.dy`: each swap re-renders the
  // list, the next move reaches the new render's handler, and its own `dy` starts again from zero.
  expect(music).toContain(
    'const to = landing(held.heights, held.from, e.nativeEvent.pageY - held.y);',
  );
  expect(music).not.toContain('gesture.dy /');
  expect(music).toContain('change({ tracks: movedTrack(held.list, held.from, to) });');
  // Dragging says nothing to a screen reader, so the same two moves stand as actions on the name.
  expect(music).toContain('accessibilityActions: MOVES');
  expect(music).toContain('s.montage.moveTrack(name)');

  // «Послушать» stays on every row of the shelf (TASK-172) and on a chosen one off it; a track of
  // their own has no link this app could play, so it has no button pretending otherwise.
  expect(music).toMatch(/play=\{\s*shelf === null\s*\?\s*undefined\s*:/);
  expect(music).toContain('s.montage.stopTrack(name) : s.montage.listen(name)');
});

test('step 4 asks the api how long the film may be, and asks again when the frames change', () => {
  // The preview is the only source of the two walls, and the question leaves the length out of
  // itself: asked with one the material no longer stretches to, the api answers 400, not a range.
  expect(build).toContain('const [preview, setPreview] = useState<MontagePreview | null>(null);');
  expect(build).toContain('target_seconds: undefined,');
  // Asked again on the frames as read and on nothing else — the id of everything going in, and the
  // read itself: a refusal of the total reads the material again, and the same frames can carry less.
  expect(build).toContain('const going = taken(material, order)');
  expect(build).toContain('}, [token, id, items, going]);');
  // The old range goes with the question, and a failed question stands where the slider would,
  // with the way to ask it again off a fresh read.
  expect(build).toContain('setPreview(null);\n    setFailed(null);');
  expect(build).toContain('label={s.action.retry} onPress={reread}');
  // A range that came back narrower than the length already chosen brings the length down with it,
  // rather than leaving a figure standing that the order would be refused for. Watched and not
  // done once on arrival: the autopilot rides the figure up while that answer is in flight, so
  // whichever of the two moves last is the one that is held.
  expect(build).toContain(
    'const held = Math.min(Math.max(order.seconds, preview.min_seconds), preview.max_seconds);',
  );
  expect(build).toContain('if (held !== order.seconds) change({ seconds: held });');
  expect(build).toContain('}, [preview, order.seconds, change]);');
  // Nothing said is the api's own answer shown on the card — and still nothing sent (`@/lib/montage/order`).
  expect(build).toContain('const seconds = order.seconds ?? preview?.target_seconds ?? null;');
});

test('step 4 draws one length control, and the template’s line goes when the figure moves', () => {
  // The three round answers are gone from the wizard: the length is a figure on a line now, with
  // five ready answers under it — four numbers and «Всё», which is the ceiling the api just named.
  expect(build).not.toContain('LENGTHS');
  expect(build).toContain('<LengthSlider');
  expect(build).toContain(
    "...PRESETS.map((value) => ({ label: formatRuntime(value) ?? '', value })),",
  );
  expect(build).toContain('{ label: s.montage.lengthAll, value: preview.max_seconds },');
  expect(model).toContain('export const PRESETS = [30, 60, 90, 180] as const;');

  // «из шаблона „…“» stands under the figure while the template is the one who put it there, and
  // the slider moving it makes the number the person's own — `ownStory`'s twin, one step along. A
  // finger resting on it moves nothing and so says nothing (`grabLength` in the kit), and the step
  // takes whatever second it is handed as it is, rounding it to nothing of its own.
  expect(build).toContain('change({ seconds: next, ownLength: true })');
  expect(build).not.toContain('Math.round');
  expect(build).toContain('template && !order.ownLength');
  expect(model).toContain('ownLength: boolean;');
  expect(ru.montage.lengthFromTemplate('Для родителей')).toBe('из шаблона «Для родителей»');

  // The ceiling stands over the card in words, and the right end of the line says what it means.
  expect(build).toContain("s.montage.lengthUpTo(formatRuntime(preview.max_seconds) ?? '')");
  expect(ru.montage.lengthUpTo('9:10')).toBe('до 9:10');
  expect(ru.montage.lengthEnd('9:10')).toBe('9:10 · всё, что есть');
  // The shape is the segments of the layout, and nothing else is asked on this step.
  expect(build).toContain('label={s.montage.shape}');
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
  // And the screen of templates draws none at all: the accent there is on the six tiles, and
  // «Настроить самому» is the quieter of the two doors on purpose.
  expect(templates).not.toContain('variant="primary"');
});

test('the summary only shows — every number on it is the api’s answer', () => {
  // The bar over it is the shell's «Итог» view: no scale, because there is no step after it.
  expect(summary).toContain('step="summary"');
  expect(wizard).toContain("const summary = step === 'summary';");
  expect(ru.montage.summaryTitle).toBe('Всё готово к монтажу');

  // One call, with the very body the order sends — so what is totalled is what would be made.
  expect(summary).toContain('previewMontage(token, id, wishes(items, order))');
  // And asked again when that body moves under it: after the autopilot, step 4 beneath holds the
  // length back into range only when its own answer lands, and a total of the order as it was would
  // then refuse — or stand over — a different order than the button sends. The old answer goes the
  // moment the order moves, and with it the button.
  expect(summary).toContain('}, [token, items, id, order]);');
  expect(summary).toContain('setPreview(null);\n    setStopped(null);');
  expect(summary).toContain('if (here) setPreview(came);');
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
  // The line beside the first track is the layout's own words (spec 8's table of words, 10.6), and
  // not «в ритм» (TASK-384).
  expect(summary).toContain('note={i === 0 ? s.montage.onTheBeat : undefined}');
  expect(ru.montage.onTheBeat).toBe('склейки в ритм');
  // And the story is read back short, four lines of it, or as the director deciding.
  expect(summary).toContain('numberOfLines={4}');
  // In the quote's own shade and face (spec 7.6, detail 43: 13 / 400 / 19, #D8D5E0 — `quote`).
  expect(summary).toContain('<Text role="quote" tone="quote" numberOfLines={4}>');
  // «Соберём примерно за 15 минут» is read: 12 / 400 / 17 in `muted`, not the layout's `faint`
  // (spec 10.1, `MontageSummary.json` e55).
  expect(summary).toContain('<Text role="aside" tone="muted" style={styles.grow}>');
  expect(summary).toContain("{story === '' ? s.montage.directorDecides : story}");
});

test('a refusal of the summary explains itself and leads back to the step that can undo it', () => {
  // What the api can answer either call with: the material under the floor, a length the frames no
  // longer carry, and frames that are no longer there — the two 400s told apart by what the body
  // carries, never by the status alone. All said in this app's words and never in the api's
  // English — the length with the two edges it was refused with, drawn the way step 4 draws one.
  expect(summary).toContain('setStopped(refusal(e));');
  expect(flat(wizard)).toContain(
    "if (e.status === 409 && 'ready_items' in body) return { text: s.montage.tooLittle, back: 'frames' };",
  );
  expect(wizard).toContain("return { text: s.montage.lengthOff(from, to), back: 'length' };");
  expect(flat(wizard)).toContain(
    "if (e.status === 400 && 'media_ids' in body) return { text: s.montage.framesGone, back: 'frames' };",
  );
  expect(wizard).toContain('s.error.status(e.status)');
  // One reading for every call the wizard makes: no screen of it hands the api's line on as it came.
  for (const screen of [wizard, ...Object.values(steps)])
    expect(screen).not.toContain('errorMessage');
  // The way back is a jump to that step and not a walk: after the autopilot there may be no step
  // behind this screen at all. And the material is read again on the way, so the step shows what
  // is there now rather than what it was refused for.
  expect(summary).toContain("{ pathname: '/memory/[id]/order/frames', params: { id } }");
  expect(summary).toContain("{ pathname: '/memory/[id]/order/build', params: { id } }");
  expect(summary).toContain('reread();\n    router.dismissTo(');
  // Refused, the screen is a line and a button and never an empty summary of nothing. Where no step
  // can undo it, the button asks again — off a fresh read, so the body is the order as it is then.
  expect(summary).toContain('<Banner tone="error" text={stopped.text}');
  expect(summary).toContain(
    '<Button size="xs" variant="quiet" label={s.action.retry} onPress={reread} />',
  );

  // A refused order leaves the button pressable again — nothing was placed, so there is something
  // to press. A double tap does not place two: the button goes busy, and the press that got in
  // while the first was in flight is turned away.
  expect(summary).toContain('if (!token || items === null || busy) return;');
  expect(summary).toContain('busy={busy}');
  const failedAt = summary.indexOf('setNotice(refusal(e).text);');
  expect(summary.slice(failedAt)).toContain('setBusy(false);');
});
