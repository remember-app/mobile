/**
 * Everything about a movie that is read off a screen's text: the way into an order, the making
 * watched live, the finished film and how it was cut, and the block of films standing first on the
 * feed.
 *
 * Their text and not their rendered output, because this file has no renderer: every test here runs
 * pure logic, and a screen would need `react-native` transformed and `expo-router`, `expo-video` and
 * the safe area all faked before its first line ran. What is worth pinning about a reorganisation is
 * the shape of it — that much the text answers. What these screens *do* is read in the flow tests
 * (`tests/screens/`), where there is a renderer; what stays here is what only the text can say:
 * where a thing stands, what is drawn once and not twice, and what is no longer in the file.
 */

import { api } from '@tests/helpers/source';
import { expect, test } from 'vitest';
import layout from '@/app/_layout.tsx?raw';
import film from '@/app/memory/[id]/montage/[montageId]/film.tsx?raw';
import live from '@/app/memory/[id]/montage/[montageId]/index.tsx?raw';
import cardMontage from '@/kit/card-montage.tsx?raw';
// The five rows, the line over them and the card «Сейчас» are the kit's, and both screens of a
// movie draw the very same ones — that is what keeps the queued screen, the making one, the one
// that stopped and the finished one from drifting apart in a year.
import filmKit from '@/kit/film.tsx?raw';
// The arithmetic both the movies face and the waiting screen ask their «is it still being made»
// question through, so the two cannot drift apart about what the answer is.
import montage from '@/lib/montage/order.ts?raw';
// The one player this product has: the strip on the feed and the film's own screen both raise it,
// which is why neither of them holds a `Modal` of its own any more (TASK-222).
import player from '@/screens/memory/film-player.tsx?raw';
import films from '@/screens/memory/films.tsx?raw';
import frames from '@/screens/memory/frames.tsx?raw';
import errands from '@/screens/memory/frames-errands.ts?raw';
import material from '@/screens/memory/frames-material.ts?raw';
// The card one record of the journal opens.
import { en, ru } from '@/strings';

// Everything both screens of the making work out of one answer — where a stage stands, how long the
// whole of it took, the three numbers of «Как собирался» — read as one text, the way `api` is: which
// file of the journal holds which of them is that folder's own business.
const journalOf = Object.values(
  import.meta.glob<string>('@/lib/montage/journal/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).join('\n');

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

test('a movie is three routes, and the journal of a stage is the last of them', () => {
  // One screen in five states (`Film`, spec 8), not five screens that could drift apart in a year:
  // the making under the strip's own road, the finished film at the end of it, and the journal of
  // one stage (TASK-470) under both. All three are declared inside the signed-in stack.
  for (const name of [
    'memory/[id]/montage/[montageId]/index',
    'memory/[id]/montage/[montageId]/film',
    'memory/[id]/montage/[montageId]/stage/[stage]',
  ]) {
    expect(layout, name).toContain(`name="${name}"`);
    expect(layout.indexOf(`name="${name}"`)).toBeLessThan(layout.indexOf('</Stack.Protected>'));
  }

  // The guess this screen used to draw instead is gone from the arithmetic as well: the api says
  // which stage is running, so nothing infers it from the one word about the whole job.
  for (const guessed of ['export const STAGES', 'export function stages', 'DONE_AT_ORDER']) {
    expect(montage).not.toContain(guessed);
  }
  // And the dictionary is exactly the api's five, under three names and no more — so one stage
  // cannot be spelled two ways in any of them. The quiet line that used to name the stages still
  // ahead is gone with the rows it stood under: every screen now draws all five, so there is
  // nothing left to say about the ones after the stage in hand.
  for (const set of [en, ru]) {
    for (const names of [set.montage.stage, set.montage.stageHead, set.montage.progress]) {
      expect(Object.keys(names)).toEqual(['prep', 'analysis', 'directing', 'music', 'assembly']);
    }
    expect(Object.keys(set.montage.filmScreen.at)).toEqual([
      'prep',
      'analysis',
      'directing',
      'music',
      'assembly',
    ]);
  }
});

test('the five rows, the line over them and the card «Сейчас» are the kit’s, and both screens draw them', () => {
  // The queued screen, the making one, the one that stopped and the finished one all stand the same
  // five rows under the same line — so those pieces live in the kit and neither screen keeps a copy
  // of a row of its own. The five screens are one body in five dresses.
  for (const piece of [
    'FilmStageList',
    'FilmStageDivider',
    'RowFilmStage',
    'TileOrder',
    'FilmBlock',
  ]) {
    expect(filmKit, piece).toContain(`export function ${piece}`);
  }
  for (const screen of [live, film]) {
    expect(screen).toContain('<FilmStageList>');
    expect(screen).toContain('<FilmStageDivider />');
    expect(screen).toContain('<RowFilmStage');
    expect(screen).toContain('at={stageNumber(stage.stage)}');
    expect(screen).toContain('title={s.montage.stage[stage.stage]}');
    expect(screen).toContain('meta={stageLine(stage, s)}');
  }
  // A stage nobody has come to is not a road: the press is not drawn at all rather than drawn and
  // refused, which is what `RowFilmStage` does with an absent `onPress` (spec 8, `FilmQueued`).
  expect(filmKit).toContain('onPress={waiting ? undefined : onPress}');
  // A film the worker has not opened the job for has no five rows at all — an outlined card with
  // nothing in it is a thing on the screen that stands for nothing.
  expect(live).toContain('{journal.stages.length === 0 ? null : (');
  // And the state of a row is the api's own word, never a reading of its counters — and it is
  // worked out once, beside the rest of the arithmetic over an answer, rather than written out as a
  // chain of ternaries on each screen that shows the five.
  for (const screen of [live, film]) {
    expect(screen).toContain('state={stageStanding(stage)}');
  }
  expect(journalOf).toContain(
    "if (stage === undefined || stage.state === 'pending') return 'waiting';",
  );
});

test('the stage line under the bar is one line, and it says where it is and how much is left', () => {
  // Spec 8, «Общее для Film*»: the name of the stage in hand and its place among the five, and on
  // the right «осталось ≈ 8 мин» — or, where nothing more is coming, how it ended.
  expect(filmKit).toContain('export function FilmStageLine');
  expect(filmKit).toContain('<FilmStageScale of={of} done={done} share={share} stopped={stopped}');
  expect(live).toContain('<FilmStageLine');
  expect(live).toContain('of={STAGE_COUNT}');
  expect(live).toContain('done={reached}');
  expect(live).toContain('share={stageShare(held?.stage)}');
  expect(live).toContain('s.montage.filmScreen.leftWas(held.minutes)');
  expect(live).toContain('s.montage.live.leftAbout(held.minutes)');
  // The stage itself is named and never counted: «73 %» tells a person nothing, «Режиссура» tells
  // them where it is, and the figure beside it is its place among the five.
  expect(live).not.toContain('percent');
});

test('the five states of the screen of a film are five states of one screen', () => {
  // In the queue with nothing in hand — and the first answer not yet landed, which is a different
  // wait; nor does a worker still fetching the material before its first frame, which is making it
  // and not queueing. One `state` reads all of it off the api's own status.
  expect(live).toContain('filmState(montage, journal)');
  expect(live).toContain(
    "{state === 'queued' && montage !== null ? <Queued montage={montage} /> : null}",
  );
  expect(live).toContain("{state === 'building' || state === 'offline' ? (");
  expect(live).toContain('<Queued montage={montage} />');
  expect(live).toContain('<Building journal={journal} onStage={toStage} />');
  expect(live).toContain('<Stopped');

  // What a film in the queue says is read out of the list's own `queue` block and out of what the
  // order counted at the time — a film ordered before those columns existed has nothing to draw
  // rather than a zero to show.
  expect(live).toContain('const queue = montage.queue ?? null;');
  expect(live).toContain('queue && queue.ahead > 0 ? filmScreen.queuedAhead(queue.ahead) : null');
  expect(live).toContain('filmScreen.queuedStarts(queue.starts_in_minutes)');
  expect(live).toContain('queue?.estimate_minutes != null ? filmScreen.queuedTakes(');
  expect(live).toContain('{tiles.frames ? (');
  expect(live).toContain('{tiles.music ? (');
  // A film with no music says so in words rather than leaving the tile out.
  expect(live).toContain('figure={s.montage.film.noMusic}');

  // It fell over: the card «Сейчас» is not drawn at all — nobody is at work on it — and the stage
  // that broke says why in its own row.
  expect(live).toContain(
    "const stopped = journal.stages.find((stage) => stage.state === 'failed')",
  );
  expect(live).toContain("stopped={state === 'stopped'}");
  expect(live).toContain("{state === 'stopped' ? (");
  expect(live).toContain('<Stopped');
  expect(live).toContain("filmScreen.stoppedOn(stopped ? s.montage.stage[stopped.stage] : '')");

  // The reads stopped coming back. Everything under that line is the truth as of the last answer.
  expect(live).toContain('s.montage.filmScreen.offlineTitle');
  expect(live).toContain('s.montage.filmScreen.offlineText');

  // And the thing chief struck off this screen: there is no «Сообщить, когда будет готово» on it,
  // because the notification goes to every member anyway (decision noted on TASK-221).
  for (const absent of ['<Toggle', 'Switch', 'notify']) expect(live).not.toContain(absent);
});

test('only the organizer starts a fallen film again', () => {
  // doc-03 gives the film to the organizer, and the api answers 403 to anybody else — so the button
  // is not drawn for them rather than drawn and refused. A member is told who can, and by what name:
  // a fact rather than a door they cannot open. Both stand in the body of the stopped block, under
  // the paragraph it belongs to, and not in a bottom layer of the screen.
  expect(live).not.toContain('<ActionBar');
  expect(live).toContain('{organizer ? (');
  expect(live).toContain('label={filmScreen.retry}');
  expect(live).toContain('filmScreen.retryNote(takes)');
  expect(live).toContain('const takes = makingTakes(stages);');
  expect(live).toContain('filmScreen.organizerCan');
  expect(live).toContain('filmScreen.organizerCanNote(who)');
  // The organizer by the roster, and under their own name where the roster has not answered — the
  // member row is what the promise «пришлём пуш» is signed with.
  expect(live).toContain("roster?.find((one) => one.role === 'organizer')");
  // The two answers a second press can get, said in words rather than as a status.
  expect(live).toContain('409: s.montage.movedOn');
  expect(live).toContain('403: s.montage.retryDenied');
  expect(live).toContain('retryMontage(token, id, montageId)');
  // Queued again — by this press or an earlier one (409) — the fallen attempt's journal is gone on
  // the api, and the hook polls nothing at `failed`: the journal starts over, or the screen would
  // stay «не собрался» with the button still under it.
  const again = live.slice(live.indexOf('async function again()'));
  expect(again).toContain('journal.restart();');
  expect(again).toContain('if (!(e instanceof ApiError && e.status === 409)) return;');
});

test('a card still being made is the second road onto the making, and a finished one onto the film', () => {
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

  // A finished film has a page of its own since TASK-222 — the journal of how it was cut is what
  // made the page necessary, and it stays with the film for ever. A fallen one leads to the same
  // screen as one being made, stopped at `failed` over the journal of the attempt that broke, and
  // is still started again from its own button.
  expect(films).toContain(
    "onPress={state === 'ready' ? () => openFilm(montage) : () => watchMaking(montage)}",
  );
  expect(films).toContain('onPress={() => void retry(montage)}');
  // And the kit is what makes that true: without a press handed over, the card is not a button and
  // takes no finger at all.
  expect(cardMontage).toContain('<View style={styles.face}>{face}</View>');
  expect(cardMontage).toContain('accessibilityRole="button"');
});

test('the making is read through the journal’s own hook and nothing else', () => {
  // TASK-220 holds the whole of the reading — the poll, the cursor, what a broken connection does —
  // so this screen keeps no clock of its own. The three reads it does make are the things the
  // journal does not carry: who is watching it, what was ordered, and who the authors are by name.
  expect(live).toContain('useMontageJournal(token, id, montageId)');
  expect(live).not.toContain('setInterval');
  for (const read of ['listMemories(token)', 'listMontages(token, id)', 'listMembers(token, id)']) {
    expect(live).toContain(read);
  }
  // Who is watching is a fact about people and not a count of plays: no pill at all is drawn over
  // nobody, and the api hands out a username and no more.
  expect(live).toContain('journal.viewers.length > 0 ? (');
  expect(live).toContain('s.montage.live.watching(journal.viewers.length)');
  // Ready while somebody sat here watching: the reward is the film, and it is watched where it
  // lies. One place says so, which is the line TASK-222 repoints at the film's own screen.
  expect(live).toContain("if (journal.status === 'ready') leave();");
  expect(live).toContain("pathname: '/memory/[id]/montage/[montageId]/film',");
  expect(live).toContain('router.replace({');
});

test('the film’s own screen: the film first, and how it was cut under it', () => {
  // The poster is the card the kit draws, and the press raises the one player this product has —
  // the same window the strip on the feed raises.
  expect(film).toContain('<PosterFilm');
  expect(film).toContain('meta={montage === null ? undefined : cutAs(montage)}');
  expect(film).toContain('ready={ready ? s.montage.filmScreen.readyPill : undefined}');
  expect(film).toContain('onPress={film === null ? undefined : () => setPlaying(true)}');
  expect(film).toContain('<FilmPlayer');
  expect(film).not.toContain('useVideoPlayer');
  expect(film).not.toContain('<Modal');
  expect(player).toContain('export function FilmPlayer');

  // Two buttons under it are the actions the player's own button is made of, and they are nobody's
  // alone: whoever brought material gets the film back, a viewer included.
  expect(film).toContain('label={s.action.share}');
  expect(film).toContain('label={s.action.download}');
  expect(film).toContain("void run(film, 'save')");
  expect(film).toContain("void run(film, 'share')");
  expect(player).toContain('export function useFilmActions');
  // «Сохранить и поделиться» hands the file to the phone's own sheet through `@/lib/downloads` like
  // every other share: React Native's own `Share` drops the file on Android and sends the line alone.
  expect(player).toContain("await (what === 'both' ? saveAndShare : saveToPhone)(file);");
  expect(player).not.toContain('Share.share');
  expect(film).not.toContain("role === 'organizer' &&");
  // Renaming it and deleting it are the organizer's, and nobody else is shown either.
  expect(film).toContain("mayEdit={memory?.role === 'organizer'}");

  // Opening a finished film is watching it: the screen tells the api so, once, and reads the list
  // again for the sheet to count this reader in.
  expect(film).toContain('markWatched(token, id, montageId)');
  expect(film).toContain('told.current = true;');
  expect(film).toContain('setPeople(members.length)');
});

test('«Как собирался» is the journal the film keeps, and a film without one is not an error', () => {
  // The three numbers and where each comes from are the journal module's (`howMade`), so the screen
  // draws what it is handed rather than reading five outcomes for itself.
  expect(film).toContain('const tiles = howMade(journal.stages, s);');
  expect(film).toContain('<TileNumber');
  expect(film).toContain('figure={String(tile.figure)}');
  expect(film).toContain('{s.montage.live.howMade}');
  expect(film).toContain('madeInMinutes(journal.stages),');
  expect(film).toContain('s.montage.filmScreen.howMadeTook(');
  // Where the sheet reads the number of frames the director took is the director's own outcome —
  // the one key of it the screen names.
  expect(film).toContain("journal.stages.find((one) => one.stage === 'directing')?.outcome.frames");

  // All five rows, and each of them still opens its own journal — that is the whole promise of the
  // journal staying: any member can read any stage, a week later as much as a minute later. A frame's
  // card is one press further, on the stage's own journal, which is the one screen that raises it.
  expect(film).toContain('<FilmStageList>');
  expect(film).toContain("pathname: '/memory/[id]/montage/[montageId]/stage/[stage]',");
  expect(film).toContain('params: { id, montageId, stage: stage.stage },');
  for (const gone of ['onRecord', '<SheetLiveFile', 'everyStage', 'lastOfEach']) {
    expect(film).not.toContain(gone);
  }

  // A film cut before the journal existed answers with no stages at all (api README), and then the
  // whole block is simply not drawn — no heading, no empty tiles, and nothing that reads as broken.
  expect(film).toContain('{journal.stages.length === 0 ? null : (');
  expect(film).toContain('{tiles.length === 0 ? null : (');
});

test('a card still being cut says which of the five stages it is on', () => {
  // TASK-223 put the stages on the list itself, so the strip draws «3 из 5» and five bars without
  // opening anybody's journal. `null` is a finished film and one the worker has not opened yet —
  // neither has a scale to draw.
  expect(api).toContain('stages?: MontageStep[] | null;');
  // The stage in hand and not the count of the ones behind it — worked out by the very function the
  // screen the card leads to says «Этап N из 5» with, so the two cannot disagree (spec detail 38).
  expect(films).toContain('const stage = currentStage(montage.stages ?? []);');
  expect(films).toContain('stageNumber(stage.stage)');
  expect(live).toContain('const stage = currentStage(journal.stages);');
  expect(films).not.toContain("stage.state === 'done'");
  expect(films).toContain('{ at, of: STAGE_COUNT, count: s.montage.live.doneOf(at, STAGE_COUNT) }');
  expect(ru.montage.live.doneOf(3, 5)).toBe('3 из 5');
  // The count and the scale read the one number, so the card cannot say «3» and paint four.
  expect(cardMontage).toContain(
    '{step ? <StageScale at={step.at} of={step.of} failed={step.failed} /> : null}',
  );
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

  // And the screen's one way out is called by the journal as well — a montage that turns `ready` a
  // moment after «Назад» was pressed — so it is guarded where it is written: a second `back()` off
  // an answer that landed late pops the memory out too.
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

test('the films face reads again by itself while a film is being cut', () => {
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

  // The one-row question itself is `@/lib/montage/order`'s since TASK-163 — the waiting screen asks it
  // about the montage it is watching, and the two must not drift apart about what «still being made»
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
  // And a read already in flight when this face writes the list itself — the retry that requeues a
  // row — must not put the api's older snapshot back over it: the card would vanish, and with nothing
  // pending left in that snapshot the loop above would clear itself and never read again.
  expect(films).toContain('if (quiet && writes.current !== startedAt) return;');
  // One write of its own left since TASK-162 — the retry that requeues a row. The order that used to
  // prepend one happens on a screen of its own now, and this face meets its answer through the read
  // on focus like any other change.
  expect(films.match(/writes\.current \+= 1;/g)).toHaveLength(1);
});

test('a quiet read in flight never puts an older feed back over one this screen has just written', () => {
  // The frames face writes its own list three ways — a run of deletes, the one frame the window
  // deletes, a label filed — and every one of them is newer than a read that started before it. Left
  // alone, that read brought a deleted frame back, and with nothing developing in its snapshot the
  // loop that re-reads stopped, so the ghost stood there until somebody pulled. The films strip has
  // had this guard since TASK-125.
  expect(material).toContain('const startedAt = writes.current;');
  expect(material).toContain('if (quiet && writes.current !== startedAt) return;');
  // One place bumps it, and every write the screen makes goes through that one.
  expect(material.match(/writes\.current \+= 1;/g)).toHaveLength(1);
  // Three writes, three calls: the run of deletes, the one frame the window deletes, a label filed.
  expect(frames.match(/\bwrote\(/g)).toHaveLength(3);
  expect(errands).toContain('onGone(gone)');
});

test('the way out of a played film is the kit’s own button, across the foot of the window', () => {
  // TASK-177, off a device: «Закрыть» stood quiet in the left corner of the bar and read as a line
  // of text rather than as anything the app draws. Spec 7.2 gives that word the outlined button —
  // the same one the frame's sheet and the consent wear — and the bar's own width is what puts it
  // in the middle of the bottom.
  expect(player).toContain('<Button label={s.action.close} onPress={onClose} />');
});
