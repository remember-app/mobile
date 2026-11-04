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
  makingTakes,
  marksOf,
  minutesSince,
  orderedTo,
  STAGE_COUNT,
  stageInHand,
  stageLine,
  stageNumber,
  stageStanding,
  useMontageJournal,
  useTypedThought,
} from '@/lib/montage/journal';
import { RATIO, trackWords } from '@/lib/montage/order';
import { MontageGone } from '@/screens/memory/montage-gone';
import { radius, space, themed, useTheme } from '@/theme';
export default function FilmScreen() {
  const { id, montageId } = useLocalSearchParams<{
    id: string;
    montageId: string;
  }>();
  const router = useRouter();
  const { token } = useAuth();
  const s = useStrings();
  const styles = useStyles();
  const journal = useMontageJournal(token, id, montageId);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [montage, setMontage] = useState<Montage | null>(null);
  const [roster, setRoster] = useState<Member[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);
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
  useEffect(() => {
    if (journal.status === 'ready') leave();
  }, [journal.status, leave]);
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
      if (!(e instanceof ApiError && e.status === 409)) return;
    } finally {
      setBusy(false);
    }
    journal.restart();
    read();
  }
  const state = filmState(montage, journal);
  const held = stageInHand(journal.stages, s);
  const stopped = journal.stages.find((stage) => stage.state === 'failed') ?? null;
  const reached = behind(journal.stages);
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
      footer={notice ? <Banner tone="error" text={notice} style={styles.banner} /> : undefined}
      body={styles.body}
    >
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
        <Stopped
          montage={montage}
          stages={journal.stages}
          stopped={stopped}
          memory={memory}
          roster={roster}
          busy={busy}
          onRetry={() => void again()}
        />
      ) : null}

      {journal.stages.length === 0 ? null : (
        <FilmStageList>
          {journal.stages.map((stage, i) => (
            <Fragment key={stage.stage}>
              {i > 0 ? <FilmStageDivider /> : null}
              <RowFilmStage
                at={stageNumber(stage.stage)}
                title={s.montage.stage[stage.stage]}
                meta={stageLine(stage, s)}
                state={stageStanding(stage)}
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
            [
              queue && queue.ahead > 0 ? filmScreen.queuedAhead(queue.ahead) : null,
              queue ? filmScreen.queuedStarts(queue.starts_in_minutes) : null,
            ]
              .filter(Boolean)
              .join('. '),
            queue?.estimate_minutes != null ? filmScreen.queuedTakes(queue.estimate_minutes) : null,
          ]
            .filter(Boolean)
            .join(' ')}
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
function Stopped({
  montage,
  stages,
  stopped,
  memory,
  roster,
  busy,
  onRetry,
}: {
  montage: Montage | null;
  stages: readonly MontageStage[];
  stopped: MontageStage | null;
  memory: Memory | null;
  roster: Member[] | null;
  busy: boolean;
  onRetry: () => void;
}) {
  const s = useStrings();
  const { color } = useTheme();
  const styles = useStyles();
  const { filmScreen } = s.montage;
  const organizer = memory?.role === 'organizer';
  const who = memberName(roster?.find((one) => one.role === 'organizer') ?? null);
  const takes = makingTakes(stages);
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
      </View>

      {organizer ? (
        <>
          <Button
            variant="primary"
            size="lg"
            wide
            icon={RotateCcw}
            label={filmScreen.retry}
            disabled={busy}
            onPress={onRetry}
          />
          {takes === null ? null : (
            <Text role="metaSm" style={styles.retryNote}>
              {filmScreen.retryNote(takes)}
            </Text>
          )}
        </>
      ) : null}

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
    retryNote: { textAlign: 'center' },
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
