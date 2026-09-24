import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  ApiError,
  errorMessage,
  listMembers,
  listMemories,
  listMontages,
  memberName,
  MONTAGE_STAGES,
  retryMontage,
  type Member,
  type Memory,
  type Montage,
  type MontageStage,
} from '@/api';
import { useAuth } from '@/auth';
import { formatDayShort, formatRuntime, formatTime } from '@/dates';
import {
  ActionBar,
  AppBar,
  BadgeDecision,
  Banner,
  Board,
  Button,
  CardNow,
  Divider,
  IconButton,
  RowStep,
  SHOT,
  Spinner,
  StepLink,
  StepNote,
  Text,
  WatchingPill,
  type StepState,
} from '@/kit';
import { useStrings } from '@/language';
import {
  currentStage,
  gazeAt,
  inHand,
  isFresh,
  lastOfStage,
  marksOf,
  minutesLeft,
  recordsOf,
  stageLine,
  stageNumber,
  stageStanding,
  STAGE_COUNT,
  useMontageJournal,
  useTypedThought,
} from '@/montage-journal';
import { LENGTHS, type Length } from '@/montage';
import { type Strings } from '@/strings';
import { radius, space, themed } from '@/theme';

/**
 * `MontageLive` (spec 7.6) — the montage as a spectacle. It replaced the waiting screen an order used
 * to land on (TASK-163/169): that one had one word about the whole job to go on and said it in five
 * stages guessed from it, and since TASK-200 the worker tells the whole story — what frame is in the
 * director's hands, where on it they are looking, what they are thinking about it, and how every
 * stage before this one went.
 *
 * Nothing on this screen is a percentage. The card at the top is a window onto something happening;
 * the five rows under it are where that has got to; and every one of them opens the journal of its
 * own stage. Leaving is free — the worker owes this montage either way, and whoever comes back an
 * hour later reads the journal from wherever it has got to.
 *
 * Two roads in, and the memory is under it both ways: `replace` from the last step of the order, so
 * the way back is never the four steps of an order already placed, and a `push` off the «Собирается»
 * card in the memory's own strip of films, for whoever walked out and came back.
 */
export default function MontageLiveScreen() {
  // The two ids and nothing else. The order wizard hands over more than that — it carries the count
  // of frames it picked, which the waiting screen used to print — and whatever else it decides to
  // carry is none of this screen's business: everything drawn here is read off the montage and its
  // journal, so what is said does not depend on which road somebody arrived by.
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const s = useStrings();
  const styles = useStyles();
  const { width } = useWindowDimensions();

  /** The whole journal of this montage, read and kept up to date — `@/montage-journal` does it all. */
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
   * Out of here — and while the montage is still owed, that is back: what is under this screen is
   * the memory itself, whose strip of films reads its list again as it comes forward, and the making
   * carries on without anybody watching it.
   *
   * Once it is finished this is the one line that points at «Ролик готов» instead (TASK-222), and a
   * `replace` rather than a push: the making is over, and nothing should lead back into watching it.
   * The film's own page is where it is watched, saved and read about now.
   *
   * Never once this screen has gone — a `ready` landing after somebody pressed «Назад» would
   * otherwise pop the memory out from under them as well (found in review, TASK-163).
   */
  const leave = useCallback(() => {
    if (gone.current) return;
    if (journal.status === 'ready') {
      router.replace({
        pathname: '/memory/[id]/montage/[montageId]/done',
        params: { id, montageId },
      });
    } else if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/memory/[id]', params: { id } });
  }, [journal.status, router, id, montageId]);

  /**
   * The three things about this montage that the journal does not carry and that do not change while
   * it is being cut: who is reading (only the organizer may start a fallen one again), what was
   * ordered, and the names of everybody in the memory — the journal names an author by id.
   *
   * On focus and not on mount, like every other screen of a memory: the roster moves while somebody
   * is invited, and the montage row is what `retry` has just rewritten. A failure here is left unsaid
   * — the journal below is what this screen is about, and it speaks for itself.
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
      // 409 is the montage having moved on without this press — somebody else's landed first.
      if (!(e instanceof ApiError && e.status === 409)) return;
    } finally {
      setBusy(false);
    }
    // The api wiped the fallen attempt's journal with that, and the hook stopped polling at
    // `failed` — so the journal starts over, and the row behind the subtitle is read again.
    journal.restart();
    read();
  }

  const failed = journal.standing === 'failed';
  const held = inHand(journal.entries);
  const file = held?.media_id ? journal.files[held.media_id] : undefined;
  const author = memberName(roster?.find((one) => one.id === file?.uploaded_by) ?? null);
  // «13 сентября, 16:42» — the same pair the open frame writes its own line with (`frame-viewer`).
  const shotAt = file?.captured_at
    ? `${formatDayShort(file.captured_at)}, ${formatTime(file.captured_at)}`
    : '';
  const thought = useTypedThought(held?.thought, held !== null && isFresh(journal, held));
  const [decision] = held ? marksOf(held, s) : [];
  const stage = currentStage(journal.stages);
  const minutes = minutesLeft(journal.stages);

  return (
    <Board>
      <AppBar
        variant="live"
        title={failed ? s.montage.status.failed : s.montage.live.title}
        subtitle={montage === null ? undefined : orderedTo(montage, s)}
        left={<IconButton icon={ChevronLeft} label={s.action.back} onPress={leave} />}
        // Nobody watching is not a pill saying zero: it is a fact about people, and the pill is
        // only drawn when there are some (spec 7.5). The api hands out a username and no more, and
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

      <ScrollView contentContainerStyle={styles.body}>
        {/* «Сейчас» — the frame in the director's hands. A montage that fell over with nothing in
            them has no card at all: a spinner over «Ждём очереди» under a screen that says it did
            not finish would be the screen arguing with itself. */}
        {held === null && failed ? null : (
          <CardNow
            uri={file?.thumbnail_url ?? undefined}
            author={file ? author : undefined}
            authorLine={file?.captured_at ? `${author} · ${shotAt}` : undefined}
            now={held === null ? undefined : s.montage.live.now}
            gaze={gazeAt(held?.focus ?? null, { width: width - space.s4 * 2, height: SHOT })}
            who={s.montage.live.director}
            standing={
              held === null
                ? undefined
                : held.decision === null
                  ? s.montage.live.thinking
                  : s.montage.live.decided
            }
            thought={thought.shown}
            typing={thought.typing}
            decision={
              decision ? (
                <BadgeDecision
                  kind={held?.decision === 'take' ? 'take' : 'pass'}
                  label={decision}
                />
              ) : undefined
            }
            // Nothing in hand: either this montage is still standing in the queue, or the first
            // answer has not landed yet — and those are two different waits.
            waiting={
              held !== null
                ? undefined
                : journal.standing === 'opening'
                  ? s.state.loading
                  : s.montage.live.inQueue
            }
          />
        )}

        {/* The read never came back. What is above stays exactly as it was — that is the whole of
            what this line is for (spec 7.6). */}
        {journal.standing === 'offline' ? (
          <View style={styles.lost}>
            <Spinner size={16} />
            <Text role="note">{s.montage.live.lost}</Text>
          </View>
        ) : null}

        {stage === null ? null : (
          <View style={styles.where}>
            <Text role="badge" style={styles.grow}>
              {s.montage.live.stageOf(stageNumber(stage.stage), STAGE_COUNT)}
            </Text>
            {minutes === null ? null : (
              <Text role="badge" tone="muted">
                {s.montage.live.leftAbout(minutes)}
              </Text>
            )}
          </View>
        )}

        {/* All five, always, whether the worker has reached them or not: what is ahead is part of
            the answer to «how far along is it», and a list that grows a row at a time would move
            under the finger every minute. */}
        <View style={styles.stages}>
          {MONTAGE_STAGES.map((code, at) => {
            const row = journal.stages.find((one) => one.stage === code);
            const last = lastOfStage(journal.entries, code);
            const open = stage?.stage === code && last.length > 0;

            return (
              <Fragment key={code}>
                {/* The hairline between two stages, inset to where their names start — the kit's
                    soft rule, because five of `line` in a row would read as a grid. */}
                {at > 0 ? <Divider soft style={styles.between} /> : null}
                <RowStep
                  title={s.montage.stage[code]}
                  meta={row && stageLine(row, s)}
                  state={stageStanding(row)}
                  open={open}
                  onPress={() =>
                    router.push({
                      pathname: '/memory/[id]/montage/[montageId]/stage/[stage]',
                      params: { id, montageId, stage: code },
                    })
                  }
                >
                  {last.map((entry) => {
                    const shot = entry.media_id ? journal.files[entry.media_id] : undefined;
                    const [mark] = marksOf(entry, s);

                    return (
                      <StepNote
                        key={entry.id}
                        uri={shot?.thumbnail_url ?? undefined}
                        length={formatRuntime(shot?.duration_seconds ?? null)}
                        text={entry.thought ?? ''}
                        mark={
                          mark ? (
                            <BadgeDecision
                              kind={entry.decision === 'take' ? 'take' : 'pass'}
                              label={mark}
                            />
                          ) : undefined
                        }
                      />
                    );
                  })}
                  {row ? (
                    <StepLink
                      label={s.montage.live.wholeStage(recordsOf(row))}
                      onPress={() =>
                        router.push({
                          pathname: '/memory/[id]/montage/[montageId]/stage/[stage]',
                          params: { id, montageId, stage: code },
                        })
                      }
                    />
                  ) : null}
                </RowStep>
              </Fragment>
            );
          })}
        </View>

        {/* The worker's own line about what went wrong, where there is room for it — the kit's rule
            is that a screen names the failure and the worker explains it, never a code. */}
        {failed && montage?.error_text ? (
          <Text role="body" tone="muted">
            {montage.error_text}
          </Text>
        ) : null}
      </ScrollView>

      {notice ? <Banner tone="error" text={notice} style={styles.banner} /> : null}

      {/* The bottom layer carries one thing or nothing at all: a fallen montage is started again by
          the organizer, and everybody else is told by the stage that wears the cross. */}
      {failed && memory?.role === 'organizer' ? (
        <ActionBar footer="live">
          <Button label={s.montage.live.retry} disabled={busy} onPress={() => void again()} />
        </ActionBar>
      ) : null}
    </Board>
  );
}

/**
 * «2:30 · Горизонтальный» — what was ordered, under the name of the screen. Only what is known is
 * named, the way a finished montage's own line is (`films.tsx`): a length outside the three the
 * wizard offers is read as a running time rather than dropped.
 */
function orderedTo(montage: Montage, s: Strings): string {
  const parts: string[] = [];
  const seconds = montage.params.target_seconds;
  const named = LENGTHS.includes(seconds as Length) ? s.montage.length[seconds as Length] : null;
  const length = named ?? formatRuntime(seconds ?? null);
  if (length) parts.push(length);
  if (montage.params.orientation) parts.push(s.montage.orientation[montage.params.orientation]);
  return parts.join(' · ');
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
    // Spec detail 56: the rule between two stages starts where their names do.
    between: { marginLeft: 50 },
    lost: { flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingHorizontal: 2 },
    where: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 },
    grow: { flex: 1, minWidth: 0 },
    // Spec 7.6: the five stages are one block of surface with the rows inside it, not five cards.
    stages: {
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    banner: { marginHorizontal: space.s4, marginBottom: space.s3 },
  }),
);
