import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Unlink } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  listMembers,
  memberName,
  MONTAGE_STAGES,
  type JournalEntry,
  type JournalFile,
  type Member,
  type MontageStageCode,
} from '@/api';
import { useAuth } from '@/lib/auth';
import { formatRuntime, formatTime } from '@/lib/dates';
import {
  AppBar,
  BadgeDecision,
  Banner,
  Board,
  Chip,
  IconButton,
  JournalLine,
  LogEntry,
  NoteThought,
  Text,
  WatchingPill,
} from '@/kit';
import { useStrings } from '@/lib/language';
import { SheetLiveFile } from '@/screens/memory/live-file';
import {
  isFresh,
  marksOf,
  sifted,
  stageLine,
  stageNumber,
  STAGE_COUNT,
  useMontageJournal,
  useTypedThought,
  type Journal as Held,
  type Sift,
} from '@/lib/montage/journal';
import { space } from '@/theme';

/**
 * `MontageLiveStage` (spec 7.6) — the journal of one stage, freshest at the top. Somebody came here
 * because they want to know *why* the director decided that, and the answer is every sentence it
 * said while it was on this stage: what it was looking at, what it thought, what it settled.
 *
 * The journal is read narrowed to this one stage (`useMontageJournal(…, { stage })`), so what is
 * scrolled here is the stage's own and not the whole montage's; the four chips then cut that by the
 * decision on each record, against the counts the api itself keeps. Hundreds of records are the
 * ordinary case — the list pages backwards by cursor as it is scrolled, and a record landing on top
 * while somebody is reading the middle of it does not move what they are reading.
 */
export default function MontageLiveStageScreen() {
  const { id, montageId, stage } = useLocalSearchParams<{
    id: string;
    montageId: string;
    /** One of the five codes the worker writes (`MONTAGE_STAGES`). */
    stage: string;
  }>();
  const router = useRouter();
  const { token } = useAuth();
  const s = useStrings();
  const insets = useSafeAreaInsets();

  // A stage this app has no word for is not a stage: the route is typed by the api's own five, and
  // anything else is read as the first of them rather than drawn as a blank screen.
  const code: MontageStageCode = MONTAGE_STAGES.includes(stage as MontageStageCode)
    ? (stage as MontageStageCode)
    : MONTAGE_STAGES[0];

  const journal = useMontageJournal(token, id, montageId, { stage: code });
  const [sift, setSift] = useState<Sift>('all');
  const [roster, setRoster] = useState<Member[] | null>(null);
  /** The record whose file card is open, held by id so a poll cannot swap it underneath. */
  const [opened, setOpened] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    listMembers(token, id).then(setRoster, () => {});
  }, [token, id]);

  const whose = useCallback(
    (file: JournalFile | undefined) =>
      memberName(roster?.find((one) => one.id === file?.uploaded_by) ?? null),
    [roster],
  );

  const row = journal.stages.find((one) => one.stage === code);
  const shown = sifted(journal.entries, sift);
  const card = journal.entries.find((entry) => entry.id === opened);
  const cardFile = card?.media_id ? journal.files[card.media_id] : undefined;

  // The api's 404: this reader is not in the memory any more — said the way the live screen says it.
  if (journal.standing === 'refused') {
    return (
      <Board>
        <AppBar
          variant="live"
          title={s.montage.stage[code]}
          left={
            <IconButton icon={ChevronLeft} label={s.action.back} onPress={() => router.back()} />
          }
        />
        <View style={styles.feed}>
          <Banner tone="error" icon={Unlink} text={s.memory.gone} />
        </View>
      </Board>
    );
  }

  return (
    <Board>
      <AppBar
        variant="live"
        title={s.montage.stage[code]}
        // «Этап 5 из 5 · 12 из 38 · идёт 2 мин» — where this stage stands, said the same way the
        // row it was opened from says it.
        subtitle={[s.montage.live.stageOf(stageNumber(code), STAGE_COUNT), row && stageLine(row, s)]
          .filter(Boolean)
          .join(' · ')}
        left={
          <IconButton icon={ChevronLeft} label={s.action.back} onPress={() => router.back()} />
        }
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

      {/* The counts are the api's own tally over the whole stage, not over what is on screen: a
          filter that counted the page it is filtering would change its own number as it scrolled. */}
      <View style={styles.chips}>
        <Chip
          label={s.montage.live.all}
          size={34}
          selected={sift === 'all'}
          onPress={() => setSift('all')}
        />
        <Chip
          label={s.montage.live.thoughts}
          size={34}
          selected={sift === 'thoughts'}
          onPress={() => setSift('thoughts')}
        />
        <Chip
          label={s.montage.live.took}
          size={34}
          count={row ? String(row.taken_count) : undefined}
          selected={sift === 'take'}
          onPress={() => setSift('take')}
        />
        <Chip
          label={s.montage.live.skip}
          size={34}
          count={row ? String(row.skipped_count) : undefined}
          selected={sift === 'skip'}
          onPress={() => setSift('skip')}
        />
      </View>

      {/* A list and not a column of everything: a stage's journal is hundreds of records with a
          picture on each, and only what is on screen is worth holding. The kit's line is laid
          behind it — the records scroll past the line, exactly as the layout draws them. */}
      <View style={styles.feed}>
        <JournalLine />
        <FlatList
          data={shown}
          keyExtractor={(entry) => String(entry.id)}
          contentContainerStyle={[styles.records, { paddingBottom: insets.bottom + space.s6 }]}
          renderItem={({ item, index }) => (
            <Record
              entry={item}
              file={item.media_id ? journal.files[item.media_id] : undefined}
              journal={journal}
              author={whose(item.media_id ? journal.files[item.media_id] : undefined)}
              // Only the top one is «сейчас» and only it types: a page of records that all landed
              // while the screen was open would otherwise be twenty sentences writing themselves
              // at once, every one of them claiming to be the moment.
              newest={index === 0}
              onPress={() => setOpened(item.id)}
            />
          )}
          // Spec 7.6 — «лента не прыгает»: a record landing on top pushes the ones below it down,
          // and React Native holds the scroll on what is visible rather than on the offset. The
          // threshold is what lets it follow anyway for somebody sitting at the top watching live.
          maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 120 }}
          // Backwards through the journal by cursor, a page at a time — the end of this list is the
          // beginning of the stage.
          onEndReached={() => {
            if (journal.hasOlder) journal.loadOlder();
          }}
          onEndReachedThreshold={0.6}
          // Only the first answer is waited for here. A stage with no records once it is known has
          // simply said nothing — rhythm and assembly never do — and «Ждём очереди» over a
          // finished film's stage would be a lie; the only way in is a stage already reached.
          ListEmptyComponent={
            journal.status === null ? <Text role="note">{s.state.loading}</Text> : null
          }
        />
      </View>

      {card ? (
        <SheetLiveFile
          entry={card}
          file={cardFile}
          author={whose(cardFile)}
          onCancel={() => setOpened(null)}
        />
      ) : null}
    </Board>
  );
}

/**
 * One record in the journal. Its own component because the thought of the freshest one is still
 * being said, and being said is a thing that happens over time — which is a hook, and a hook cannot
 * be called from inside a list's render.
 */
function Record({
  entry,
  file,
  journal,
  author,
  newest,
  onPress,
}: {
  entry: JournalEntry;
  file: JournalFile | undefined;
  journal: Held;
  author: string;
  /** The record at the top of the feed: the one wearing the spark dot, and the only one typing. */
  newest: boolean;
  onPress: () => void;
}) {
  const s = useStrings();
  // «сейчас» is the newest record *and* one that landed while somebody was watching — a journal
  // opened on a montage cut last week has a newest record too, and it happened at 16:43.
  const now = newest && isFresh(journal, entry);
  const thought = useTypedThought(entry.thought, now);
  const marks = marksOf(entry, s);
  const time = now ? s.montage.live.justNow : formatTime(entry.created_at);

  // A thought about the plan as a whole is a plate across the width of the journal and nothing else
  // — no frame, no author, nothing to open (spec detail 61).
  if (entry.media_id === null) {
    return (
      <LogEntry time={time} fresh={newest}>
        <NoteThought text={thought.said} unsaid={thought.unsaid} />
      </LogEntry>
    );
  }

  return (
    <LogEntry
      time={time}
      fresh={newest}
      // A frame that has since been deleted comes without any file at all, and the record about it
      // stays — it is drawn without a picture rather than dropped (api README).
      uri={file?.thumbnail_url ?? undefined}
      length={formatRuntime(file?.duration_seconds ?? null)}
      source={author}
      text={thought.said}
      unsaid={thought.unsaid}
      marks={marks.map((mark, at) => (
        <BadgeDecision
          key={mark}
          kind={entry.decision === 'take' ? (at === 0 ? 'take' : 'part') : 'pass'}
          label={mark}
        />
      ))}
      onPress={onPress}
    />
  );
}

// Nothing here carries a colour of its own — every piece on this screen brings the kit's with it.
const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: space.s4 },
  // The screen's own margin lives here so the line behind the list is measured from it; the records
  // then stand 22 in, which is where the kit hangs their dots.
  feed: { flex: 1, paddingHorizontal: space.s4, paddingTop: space.s4 },
  records: { paddingLeft: 22, gap: 18 },
});
