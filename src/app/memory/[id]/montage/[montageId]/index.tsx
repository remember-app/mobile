import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  ApiError,
  errorMessage,
  listMembers,
  listMemories,
  listMontages,
  type Member,
  type Memory,
  type Montage,
  memberName,
  retryMontage,
} from '@/api';
import {
  ActionBar,
  AppBar,
  BackButton,
  BadgeDecision,
  Banner,
  Board,
  Button,
  CardNow,
  SHOT,
  Spinner,
  Text,
  WatchingPill,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatDayShort, formatRuntime, formatTime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import {
  currentStage,
  gazeAt,
  inHand,
  isFresh,
  marksOf,
  minutesLeft,
  STAGE_COUNT,
  stageNumber,
  useMontageJournal,
  useTypedThought,
} from '@/lib/montage/journal';
import { RATIO } from '@/lib/montage/order';
import { MontageGone } from '@/screens/memory/montage-gone';
import { StageRows } from '@/screens/memory/stage-rows';
import { space } from '@/theme';

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
 * the way back is never the four steps of an order already placed, and a `push` off a card in the
 * memory's own strip of films — «Собирается», for whoever walked out and came back, or «Не собрался»,
 * opened cold: the journal of the attempt that broke, read once and not polled, and nothing here
 * leaves it but «Назад».
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
  const { width } = useWindowDimensions();

  /** The whole journal of this montage, read and kept up to date — `@/lib/montage/journal` does it all. */
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

  if (journal.standing === 'refused') {
    return <MontageGone title={s.montage.live.title} onBack={leave} />;
  }

  return (
    <Board
      bar={
        <AppBar
          variant="live"
          title={failed ? s.montage.status.failed : s.montage.live.title}
          subtitle={montage === null ? undefined : orderedTo(montage)}
          left={<BackButton label={s.action.back} onPress={leave} />}
          // Nobody watching is not a pill saying zero: it is a fact about people, and the pill is
          // only drawn when there are some (spec 7.5). The api hands out a username and no more,
          // and initials of one are enough for a 24 circle.
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
        notice || (failed && memory?.role === 'organizer') ? (
          <>
            {notice ? <Banner tone="error" text={notice} style={styles.banner} /> : null}
            {/* The bottom layer carries one thing or nothing at all: a fallen montage is started
                again by the organizer, and everybody else is told by the stage that wears the
                cross. */}
            {failed && memory?.role === 'organizer' ? (
              <ActionBar>
                <Button label={s.montage.live.retry} disabled={busy} onPress={() => void again()} />
              </ActionBar>
            ) : null}
          </>
        ) : undefined
      }
      body={styles.body}
    >
      {/* «Сейчас» — the frame in the director's hands. A montage that fell over has no card at
          all: nobody's hands are on it any more, and a live window over an attempt that broke a
          week ago says the director is still at work. Where it broke is the stage wearing the
          cross below, opened out on its last records — the frame it held among them. */}
      {failed ? null : (
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
          thought={thought.said}
          unsaid={thought.unsaid}
          decision={
            decision ? (
              <BadgeDecision kind={held?.decision === 'take' ? 'take' : 'pass'} label={decision} />
            ) : undefined
          }
          // Nothing in hand, and three different waits: no answer yet (the connection may have
          // gone before the first one), the queue, or a worker still fetching the material before
          // the first frame — which is being made, not waiting its turn.
          waiting={
            held !== null
              ? undefined
              : journal.status === null
                ? s.state.loading
                : journal.status === 'queued'
                  ? s.montage.live.inQueue
                  : s.montage.status.processing
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
          <Text role="timecode" style={styles.grow}>
            {s.montage.live.stageOf(stageNumber(stage.stage), STAGE_COUNT)}
          </Text>
          {minutes === null ? null : <Text role="meta">{s.montage.live.leftAbout(minutes)}</Text>}
        </View>
      )}

      <StageRows
        memoryId={id}
        montageId={montageId}
        journal={journal}
        opens={(code) => code === stage?.stage}
      />

      {/* The worker's own line about what went wrong, where there is room for it — the kit's rule
          is that a screen names the failure and the worker explains it, never a code. */}
      {failed && montage?.error_text ? (
        <Text role="body" tone="muted">
          {montage.error_text}
        </Text>
      ) : null}
    </Board>
  );
}

/**
 * «2:30 · 16:9» — what was ordered, under the name of the screen, in the figures the finished poster
 * says it in (`MontageLive`, `MontageLiveDone`). A length the api was left to pick is not named; a
 * montage with no shape on it is horizontal, which is how the api reads one.
 */
function orderedTo(montage: Montage): string {
  return [
    formatRuntime(montage.params.target_seconds ?? null),
    RATIO[montage.params.orientation ?? 'landscape'],
  ]
    .filter(Boolean)
    .join(' · ');
}

// Nothing here carries a colour of its own — every piece on this screen brings the kit's with it.
const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    paddingBottom: space.s6,
    gap: space.s3,
  },
  lost: { flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingHorizontal: 2 },
  where: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 },
  grow: { flex: 1, minWidth: 0 },
  banner: { marginHorizontal: space.s4, marginBottom: space.s3 },
});
