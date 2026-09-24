/**
 * Everything about a movie that is read off a screen's text: the way into an order, the making
 * watched live with the journal under it, one stage's records, the finished film's own page, and the
 * block of films standing first on the feed.
 *
 * Their text and not their rendered output, because this file has no renderer: every test here runs
 * pure logic, and a screen would need `react-native` transformed and `expo-router`, `expo-video` and
 * the safe area all faked before its first line ran. What is worth pinning about a reorganisation is
 * the shape of it — that much the text answers. What these screens *do* is read in the flow tests
 * (`tests/screens/`), where there is a renderer; what stays here is what only the text can say:
 * where a thing stands, and what is no longer in the file.
 */

import { api } from '@tests/helpers/source';
import { expect, test } from 'vitest';
import layout from '@/app/_layout.tsx?raw';
import done from '@/app/memory/[id]/montage/[montageId]/done.tsx?raw';
import live from '@/app/memory/[id]/montage/[montageId]/index.tsx?raw';
import stageLog from '@/app/memory/[id]/montage/[montageId]/stage/[stage].tsx?raw';
import cardMontage from '@/kit/card-montage.tsx?raw';
// The arithmetic both the movies face and the waiting screen ask their «is it still being made»
// question through, so the two cannot drift apart about what the answer is.
import montage from '@/lib/montage/order.ts?raw';
// The one player this product has: the strip on the feed and the film's own page both raise it,
// which is why neither of them holds a `Modal` of its own any more (TASK-222).
import player from '@/screens/memory/film-player.tsx?raw';
import films from '@/screens/memory/films.tsx?raw';
import frames from '@/screens/memory/frames.tsx?raw';
import errands from '@/screens/memory/frames-errands.ts?raw';
import material from '@/screens/memory/frames-material.ts?raw';
// The card one record of the journal opens — a piece of two screens, so it lives beside neither.
import liveFile from '@/screens/memory/live-file.tsx?raw';
// And the five rows of the making, which those same two screens draw.
import stageRows from '@/screens/memory/stage-rows.tsx?raw';
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

  // A finished montage has a page of its own since TASK-222 — spec 7.6 gives the whole card to that
  // press, and it is the journal of how it was cut that made the page necessary. A fallen one leads
  // to the same screen as one being made, stopped at `failed` over the journal of the attempt that
  // broke (spec detail 38), and is still started again from its own button.
  expect(films).toContain(
    "onPress={state === 'ready' ? () => openFilm(montage) : () => watchMaking(montage)}",
  );
  expect(films).toContain('onPress={() => void retry(montage)}');
  // And the kit is what makes that true: without a press handed over, the card is not a button and
  // takes no finger at all.
  expect(cardMontage).toContain('<View style={styles.face}>{face}</View>');
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

  // It fell over: «Сейчас» goes whole, frame or no frame — nobody is at work on it — and the stage
  // that broke is what says where.
  expect(live).toContain("const failed = journal.standing === 'failed';");
  expect(live).toContain('{failed ? null : (');
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
  // In the kit's ordinary bottom layer, the one every screen with one button stands it on. The
  // shallow one drawn under the «Сообщить» pill went with the pill, and with nothing to carry the
  // screen has no bottom layer at all — so it is this one, and only this one.
  expect(live).toMatch(/<ActionBar>\s*<Button label=\{s\.montage\.live\.retry\}/);
  expect(live.match(/<ActionBar/g)).toHaveLength(1);
  expect(live).toContain('retryMontage(token, id, montageId)');
  // The two answers a second press can get, said in words rather than as a status.
  expect(live).toContain('409: s.montage.movedOn');
  expect(live).toContain('403: s.montage.retryDenied');
  // Queued again — by this press or an earlier one (409) — the fallen attempt's journal is gone on
  // the api, and the hook polls nothing at `failed`: the journal starts over, or the screen would
  // stay «не собрался» with the button still under it.
  const again = live.slice(live.indexOf('async function again()'));
  expect(again).toContain('journal.restart();');
  expect(again).toContain('if (!(e instanceof ApiError && e.status === 409)) return;');
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
  expect(
    stageRows.match(/pathname: '\/memory\/\[id\]\/montage\/\[montageId\]\/stage\/\[stage\]'/g),
  ).toHaveLength(1);
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
  expect(stageLog).toContain(
    'journal.status === null ? <Text role="note">{s.state.loading}</Text> : null',
  );
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
  expect(liveFile).toContain('<NoteThought text={entry.thought} />');
  // «Что увидел» in tags.
  expect(liveFile).toContain('s.montage.live.saw.toUpperCase()');
  // Keyed by place: the words are the model's, and the same one twice is two tags, not one key.
  expect(liveFile).toContain('<Tag key={at} label={label} />');
  // Where the frame lay is the layout's and not the thought's: a line of its own, not a part of the
  // plate — so a record with no thought still has it.
  expect(liveFile).toContain('const place = placeLine(entry, file, s);');
  expect(liveFile).not.toContain('outcome=');
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
  // «Сохранить и поделиться» hands the file to the phone's sheet through `@/lib/downloads` like every
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
  expect(films).toContain(
    'const { montage: asked } = useLocalSearchParams<{ montage?: string }>();',
  );
  expect(films).toContain('<FilmPlayer film={watching} onClose={() => setPlaying(null)} />');
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
  expect(live).toContain('s.montage.live.stageOf(stageNumber(stage.stage), STAGE_COUNT)');
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

  // The one-row question itself is `@/lib/montage/order`'s since TASK-163 — the waiting screen asks it about
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
  expect(material).toContain('const startedAt = writes.current;');
  expect(material).toContain('if (quiet && writes.current !== startedAt) return;');
  // One place bumps it, and every write the screen makes goes through that one.
  expect(material.match(/writes\.current \+= 1;/g)).toHaveLength(1);
  // Three writes, three calls: the run of deletes, the one frame the window deletes, a label filed.
  expect(frames.match(/\bwrote\(/g)).toHaveLength(3);
  expect(errands).toContain('onGone(gone)');
});

test('the way out of a played montage is the kit’s own button, across the foot of the window', () => {
  // TASK-177, off a device: «Закрыть» stood quiet in the left corner of the bar and read as a line
  // of text rather than as anything the app draws. Spec 7.2 gives that word the outlined button —
  // the same one the frame's sheet and the consent wear — and the bar's own width is what puts it
  // in the middle of the bottom.
  expect(player).toContain('<Button label={s.action.close} onPress={onClose} />');
});
