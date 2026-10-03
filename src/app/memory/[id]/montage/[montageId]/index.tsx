import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Pause, RotateCcw } from 'lucide-react-native';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ApiError,
  errorMessage,
  listMembers,
  listMemories,
  listMontages,
  type Member,
  type Memory,
  type Montage,
  type MontageStage,
  memberName,
  retryMontage,
} from '@/api';
import {
  ActionBar,
  AppBar,
  Avatar,
  BackButton,
  BadgeDecision,
  Banner,
  Board,
  Button,
  CardFilmNow,
  FilmBlock,
  FilmCloseNote,
  FilmStageDivider,
  FilmStageLine,
  FilmStageList,
  Icon,
  RowFilmStage,
  stageShare,
  Text,
  TileOrder,
  TileOrderRow,
  WatchingPill,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatTime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import {
  currentStage,
  filmState,
  inHand,
  isFresh,
  marksOf,
  minutesSince,
  orderedTo,
  STAGE_COUNT,
  stageInHand,
  stageLine,
  stageNumber,
  useMontageJournal,
  useTypedThought,
} from '@/lib/montage/journal';
import { RATIO, trackWords } from '@/lib/montage/order';
import { MontageGone } from '@/screens/memory/montage-gone';
import { radius, space, themed, useTheme } from '@/theme';

/**
 * `Film` (spec 8) — one screen of a movie in each of its five states. A film is `queued` on one road
 * and `processing` on another, `ready` on a third and `failed` on a fourth, and the connection can
 * go on any of them: five dresses of one body, drawn here rather than as five screens that could
 * drift apart in a year.
 *
 * What all five share is the bar, the line of the stage in hand, and the list of the five stages
 * under it — the api's own `stages`, read through `useMontageJournal` and never re-counted on the
 * phone: «взял N / мимо N / мысли N» и «мимо» по причинам считает api по записям журнала и
 * отдаёт готовыми. What differs is what stands between them: what was ordered and when it starts
 * (queued), what is happening at this moment (building), the poster and two buttons (ready), one
 * button or the organizer's name (failed), and a banner over everything when the reads stop coming.
 *
 * Leaving is free while the worker still owes this film, and then it leads to the finished one
 * rather than back — the making is over and nothing should lead back into watching it. A `replace`
 * and not a push, so that arriving at a ready film and pressing back does not pop the memory out
 * from under anybody as well.
 */
export default function FilmScreen() {
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const s = useStrings();
  const styles = useStyles();

  /** The whole journal of this film, read and kept up to date — `@/lib/montage/journal` does it all. */
  const journal = useMontageJournal(token, id, montageId);

  const [memory, setMemory] = useState<Memory | null>(null);
  const [montage, setMontage] = useState<Montage | null>(null);
  const [roster, setRoster] = useState<Member[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Whether this screen is still here — see `leave`. */
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);

  /**
   * Out of here. While the worker still owes this film that is back, and the memory is under it both
   * ways: its own strip of films reads its list again as it comes forward, and the making carries on
   * without anybody watching it.
   *
   * Never once this screen has gone: a ready landing after somebody pressed «Назад» would otherwise
   * pop the memory out from under them as well.
   */
  const leave = useCallback(() => {
    if (gone.current) return;
    if (journal.status === 'ready') {
      router.replace({
        pathname: '/memory/[id]/montage/[montageId]/film',
        params: { id, montageId },
      });
    } else if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/memory/[id]', params: { id } });
  }, [journal.status, router, id, montageId]);

  /**
   * The three things the journal does not carry: who is reading (only the organizer may start a
   * fallen film again), what this film is, and the names of everybody in the memory — the journal
   * names an author by id, and the bar's film is named by the order.
   *
   * On focus and not on mount, like every other screen of a memory: the roster moves while somebody
   * is invited, and the film row is what `retry` has just rewritten. A failure here is left unsaid —
   * the journal is what this screen is about, and it speaks for itself.
   */
  const read = useCallback(() => {
    if (!token) return;
    listMemories(token).then(
      (memories) => setMemory(memories.find((one) => one.id === id) ?? null),
      () => {},
    );
    listMontages(token, id).then(
      (list) => setMontage(list.find((one) => one.id === montageId) ?? null),
      () => {},
    );
    listMembers(token, id).then(setRoster, () => {});
  }, [token, id, montageId]);

  useFocusEffect(useCallback(() => read(), [read]));

  // Ready while somebody sat here watching it happen — which is the whole point of sitting here.
  useEffect(() => {
    if (journal.status === 'ready') leave();
  }, [journal.status, leave]);

  /** The organizer's second try: the same row queued again, never a second one (api README). */
  async function again() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      await retryMontage(token, id, montageId);
    } catch (e) {
      setNotice(
        (e instanceof ApiError
          ? { 409: s.montage.movedOn, 403: s.montage.retryDenied }[e.status]
          : undefined) ?? errorMessage(e),
      );
      // 409 is the film having moved on without this press — somebody else's landed first.
      if (!(e instanceof ApiError && e.status === 409)) return;
    } finally {
      setBusy(false);
    }
    // The api wiped the fallen attempt's journal with that, and the hook stopped polling at
    // `failed` — so the journal starts over, and the row behind the bar is read again.
    journal.restart();
    read();
  }

  const state = filmState(montage, journal);
  const held = stageInHand(journal.stages, s);
  const stopped = journal.stages.find((stage) => stage.state === 'failed') ?? null;
  const reached = behind(journal.stages);
  const organizer = memory?.role === 'organizer';

  const toStage = (code: MontageStage['stage']) =>
    router.push({
      pathname: '/memory/[id]/montage/[montageId]/stage/[stage]',
      params: { id, montageId, stage: code },
    });

  if (state === 'gone') {
    return <MontageGone title={s.montage.live.doneTitle} onBack={leave} />;
  }

  return (
    <Board
      bar={
        <AppBar
          variant="live"
          title={montage?.name ?? ''}
          subtitle={memory?.title ?? undefined}
          left={<BackButton label={s.action.back} onPress={leave} />}
          // Nobody watching is not a pill saying zero: it is a fact about people, and the pill is
          // only drawn when there are some. The api hands out a username and no more, and the
          // initials of one are enough for a 24 circle.
          right={
            journal.viewers.length > 0 ? (
              <WatchingPill
                names={journal.viewers.map((viewer) => memberName({ name: null, ...viewer }))}
                count={journal.viewers.length}
                label={s.montage.live.watching(journal.viewers.length)}
              />
            ) : undefined
          }
        />
      }
      footer={
        notice || (state === 'stopped' && organizer) ? (
          <>
            {notice ? <Banner tone="error" text={notice} style={styles.banner} /> : null}
            {/* The bottom layer carries one thing or nothing at all: a fallen film is started again
                by the organizer, and everybody else is told by the block that stands where the
                button would have been. */}
            {state === 'stopped' && organizer ? (
              <ActionBar>
                <Button
                  variant="primary"
                  size="lg"
                  icon={RotateCcw}
                  label={s.montage.filmScreen.retry}
                  disabled={busy}
                  onPress={() => void again()}
                />
              </ActionBar>
            ) : null}
          </>
        ) : undefined
      }
      body={styles.body}
    >
      {/* The reads stopped coming back. Everything under this line is the truth as of the last
          answer and stays exactly as it was — that is the whole of what this banner is for. */}
      {state === 'offline' ? (
        <Banner
          tone="error"
          text={`${s.montage.filmScreen.offlineTitle}. ${s.montage.filmScreen.offlineText}`}
        />
      ) : null}

      <FilmStageLine
        name={held?.name ?? s.montage.filmScreen.queuedPill}
        of={STAGE_COUNT}
        stageOf={held?.stageOf ?? ''}
        right={
          state === 'stopped'
            ? s.montage.filmScreen.stoppedPill
            : held?.minutes === null || held?.minutes === undefined
              ? undefined
              : state === 'offline'
                ? s.montage.filmScreen.leftWas(held.minutes)
                : s.montage.live.leftAbout(held.minutes)
        }
        done={reached}
        share={stageShare(held?.stage)}
        stopped={state === 'stopped'}
      />

      {state === 'queued' && montage !== null ? <Queued montage={montage} /> : null}

      {state === 'building' || state === 'offline' ? (
        <Building journal={journal} onStage={toStage} />
      ) : null}

      {state === 'stopped' ? (
        <Stopped montage={montage} stopped={stopped} memory={memory} roster={roster} />
      ) : null}

      {/* The five, as they stand. A film the worker has not taken yet has none of them, and the list
          is not drawn at all rather than drawn empty — an outlined card with nothing in it is a
          thing on the screen that stands for nothing. */}
      {journal.stages.length === 0 ? null : (
        <FilmStageList>
          {journal.stages.map((stage, i) => (
            <Fragment key={stage.stage}>
              {i > 0 ? <FilmStageDivider /> : null}
              <RowFilmStage
                at={stageNumber(stage.stage)}
                title={s.montage.stage[stage.stage]}
                meta={stageLine(stage, s)}
                state={
                  stage.state === 'failed'
                    ? 'failed'
                    : stage.state === 'running'
                      ? 'running'
                      : stage.state === 'done'
                        ? 'done'
                        : 'waiting'
                }
                onPress={() => toStage(stage.stage)}
              />
            </Fragment>
          ))}
        </FilmStageList>
      )}

      {state === 'queued' || state === 'building' || state === 'offline' ? (
        <FilmCloseNote text={s.montage.filmScreen.closeNote} />
      ) : null}
    </Board>
  );
}

/**
 * `FilmQueued` — what was ordered, and when the making will start. Both come out of the list's own
 * `queue` block and out of what the order counted at the time; neither is worked out here, and a
 * film ordered before the api had those columns has nothing to draw rather than a zero to show.
 */
function Queued({ montage }: { montage: Montage }) {
  const s = useStrings();
  const { color } = useTheme();
  const styles = useStyles();
  const { filmScreen } = s.montage;
  const queue = montage.queue ?? null;
  const tiles = orderedTo(montage, trackWords(montage.params, s)[0], null, s);
  const story = montage.params.story_text;
  const shape = montage.params.orientation ?? 'landscape';

  return (
    <>
      <View style={styles.queue}>
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Icon icon={Clock} size={13} color={color.muted} />
            <Text role="badgeSm" tone="muted">
              {filmScreen.queuedPill}
            </Text>
          </View>
          <Text role="meta">{filmScreen.acceptedAt(formatTime(montage.created_at))}</Text>
        </View>
        <Text role="displaySm" accessibilityRole="header">
          {filmScreen.queuedTitle}
        </Text>
        <Text role="note" tone="muted">
          {[
            queue && queue.ahead > 0 ? filmScreen.queuedAhead(queue.ahead) : null,
            queue ? filmScreen.queuedStarts(queue.starts_in_minutes) : null,
            queue?.estimate_minutes != null ? filmScreen.queuedTakes(queue.estimate_minutes) : null,
          ]
            .filter(Boolean)
            .join('. ')}
        </Text>
      </View>

      <TileOrderRow>
        {tiles.frames ? (
          <TileOrder
            label={filmScreen.frames}
            figure={tiles.frames.figure}
            note={tiles.frames.note}
          />
        ) : null}
        {tiles.length ? (
          <TileOrder label={filmScreen.length} figure={tiles.length} note={filmScreen.minutes} />
        ) : null}
        <TileOrder
          label={filmScreen.orientation}
          figure={RATIO[shape]}
          note={filmScreen.orientationWord[shape]}
        />
        {tiles.music ? (
          <TileOrder
            label={filmScreen.music}
            figure={tiles.music.figure}
            note={tiles.music.note ?? undefined}
          />
        ) : (
          <TileOrder label={filmScreen.music} figure={s.montage.film.noMusic} />
        )}
      </TileOrderRow>

      {story ? (
        <FilmBlock label={filmScreen.story}>
          <Text role="bodyXs" numberOfLines={2}>
            {story}
          </Text>
        </FilmBlock>
      ) : null}
    </>
  );
}

/**
 * `FilmBuilding` — the card «Сейчас»: the frame the director is holding and the sentence they are in
 * the middle of. The whole card leads into the journal of the stage in hand, which is the one thing
 * this screen is a window onto.
 *
 * Offline it keeps what was last read and says how old that is, with no cursor: a card that went on
 * typing over a connection that is not there would be the screen lying about a worker it cannot see.
 */
function Building({
  journal,
  onStage,
}: {
  journal: ReturnType<typeof useMontageJournal>;
  onStage: (code: MontageStage['stage']) => void;
}) {
  const s = useStrings();
  const held = inHand(journal.entries);
  const file = held?.media_id ? journal.files[held.media_id] : undefined;
  const thought = useTypedThought(held?.thought, held !== null && isFresh(journal, held));
  const [decision] = held ? marksOf(held, s) : [];
  const stage = currentStage(journal.stages);
  // Offline the card says how old what it is showing is, rather than pretending it is still moving.
  const ago = minutesSince(journal.entries);

  return (
    <CardFilmNow
      who={s.montage.live.director}
      what={stage ? s.montage.filmScreen.at[stage.stage] : s.montage.live.inQueue}
      now={
        journal.offline && ago !== null ? s.montage.filmScreen.updatedAgo(ago) : s.montage.live.now
      }
      uri={file?.thumbnail_url ?? undefined}
      thought={thought.said}
      marks={
        decision && held ? (
          <BadgeDecision kind={held.decision === 'take' ? 'take' : 'pass'} label={decision} />
        ) : null
      }
      onPress={stage ? () => onStage(stage.stage) : undefined}
    />
  );
}

/**
 * `FilmFailed*` — what happened, and what happens next. The organizer's button stands in the bottom
 * layer; where it is not, a member is told who can do it and under what name, which is a fact rather
 * than a door they cannot open.
 */
function Stopped({
  montage,
  stopped,
  memory,
  roster,
}: {
  montage: Montage | null;
  stopped: MontageStage | null;
  memory: Memory | null;
  roster: Member[] | null;
}) {
  const s = useStrings();
  const { color } = useTheme();
  const styles = useStyles();
  const { filmScreen } = s.montage;
  const organizer = memory?.role === 'organizer';
  // The organizer by the roster, and under their own name where the roster has not answered — the
  // member row is what the promise «придёт пуш» is signed with, and a blank name signs nothing.
  const who = memberName(roster?.find((one) => one.role === 'organizer') ?? null);

  return (
    <>
      <View style={styles.queue}>
        <View style={styles.stoppedPill}>
          <Icon icon={Pause} size={13} color={color.dangerText} />
          <Text role="badgeSm" tone="danger">
            {filmScreen.stoppedPill}
          </Text>
        </View>
        <Text role="displaySm" accessibilityRole="header">
          {filmScreen.stoppedTitle}
        </Text>
        <Text role="note" tone="muted">
          {filmScreen.stoppedOn(stopped ? s.montage.stage[stopped.stage] : '')}
        </Text>
        {organizer && montage?.queue?.estimate_minutes != null ? (
          <Text role="metaSm">{filmScreen.retryNote(montage.queue.estimate_minutes)}</Text>
        ) : null}
      </View>

      {/* The stopped stage's own row under this block says why it stopped, in danger. What the
          worker wrote about it in prose is left unsaid here — the api hands it over as its own
          words, and a sentence this screen cannot vouch for does not go under a heading it owns. */}
      {montage?.error_text ? (
        <Text role="bodyXs" tone="muted">
          {montage.error_text}
        </Text>
      ) : null}

      {organizer ? null : (
        <View style={styles.organizer}>
          <Avatar name={who} size={34} />
          <View style={styles.grow}>
            <Text role="rowSm">{filmScreen.organizerCan}</Text>
            <Text role="metaSm">{filmScreen.organizerCanNote(who)}</Text>
          </View>
        </View>
      )}
    </>
  );
}

/**
 * How many stages are behind, the one in hand included — what the scale under the bar has lit. The
 * stage in hand is lit like the ones behind it, so this is the count up to and including it.
 */
function behind(stages: readonly MontageStage[]): number {
  const ahead = stages.findIndex((stage) => stage.state === 'pending');
  return ahead === -1 ? stages.length : ahead;
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    body: {
      flexGrow: 1,
      paddingHorizontal: space.s4,
      paddingTop: space.s3,
      paddingBottom: space.s6,
      gap: space.s3,
    },
    banner: { marginBottom: space.s3 },
    queue: { gap: space.s2, paddingVertical: space.s1 },
    pillRow: { flexDirection: 'row', alignItems: 'center', gap: space.s2, flexWrap: 'wrap' },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 28,
      paddingHorizontal: 11,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.line,
    },
    stoppedPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 28,
      paddingHorizontal: 11,
      borderRadius: radius.pill,
      backgroundColor: color.dangerSoft,
      borderWidth: 1,
      borderColor: color.dangerSoft,
    },
    organizer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      padding: space.s3,
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
    grow: { flex: 1, minWidth: 0 },
  }),
);
