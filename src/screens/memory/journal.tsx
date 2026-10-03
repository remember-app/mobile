import { Clock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { JournalEntry, JournalFile, Member, Montage, MontageStage } from '@/api';
import { memberName } from '@/api';
import {
  BadgeDecision,
  BlockJournal,
  Button,
  CardFilmNow,
  CardFrame,
  CountPair,
  HintNote,
  PartJournal,
  PartSound,
  RowFrame,
  RowShare,
  RowStep,
  Shares,
  SummaryJournal,
  TapeCuts,
  Text,
  ThoughtJournal,
} from '@/kit';
import { formatRuntime, formatTime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import {
  assemblyProgress,
  assemblySteps,
  assemblyTiles,
  counted,
  describedFields,
  filmLength,
  framed,
  frameLine,
  inHand,
  marksOf,
  moments,
  partLine,
  parts,
  passes,
  peopleCount,
  prepared,
  type StageStanding,
  seen,
  senders,
  shares as sharesOf,
  cuts as tapeOf,
  toldInFull,
  useTypedThought,
  weighed,
} from '@/lib/montage/journal';
import { space } from '@/theme';

/**
 * The five bodies of the journal of one stage (spec 8, `Journal*Run` / `*Done`). One screen in four
 * states and one body per stage: what all five share is the head, the summary and the buttons at the
 * foot, and what differs is everything between them.
 *
 * Nothing here counts anything or reaches the api. `@/lib/montage/journal` reads the figures out of
 * the answer and `useStrings` reads the words, and this file only lays them down.
 */

/** What one stage's journal is drawn out of, and what its own presses reach. */
export type StageBody = {
  /** This stage's own row out of the answer — null while the worker has not come to it. */
  stage: MontageStage | undefined;
  /** Where it stands, out of that row. */
  how: StageStanding;
  /** This stage's own records, newest first. */
  entries: JournalEntry[];
  /** The files those records met, by id. */
  files: Record<string, JournalFile>;
  /** The roster — the api carries the names of people as ids. */
  roster: Member[] | null;
  /** The film itself, for what was ordered rather than made here. */
  montage: Montage | null;
  /** Every stage of the answer, so the music tape has the length the assembly came out at. */
  stages: MontageStage[];
  /** The part of the story whose frames stand open, by its number; zero closes it again. */
  openPart: number | null;
  onOpenPart: (at: number) => void;
  /** The record whose card stands open, by id; zero closes it again. */
  openEntry: number | null;
  onOpenEntry: (id: number) => void;
  /** The reasons under «Не взял», folded away until they are asked for. */
  openPasses: boolean;
  onOpenPasses: () => void;
};

/**
 * The journal of one stage, from its summary down. Which of the five bodies it is falls out of the
 * stage's own code and out of nothing else: the worker writes one code per stage, and the app draws
 * what that code says.
 */
export function StageBlocks(props: StageBody) {
  switch (props.stage?.stage ?? 'prep') {
    case 'analysis':
      return <Analysis {...props} />;
    case 'directing':
      return <Directing {...props} />;
    case 'music':
      return <Music {...props} />;
    case 'assembly':
      return <Assembly {...props} />;
    default:
      return <Prep {...props} />;
  }
}

/**
 * The summary block every stage opens with — what it is doing or what it came to, the time, and what
 * it counts. Four stages count one thing with one bar and a fifth counts in figures; both are the
 * same block, and a stage with neither draws the head alone.
 */
export function Summary({
  stage,
  how,
  time,
  tiles,
  children,
}: {
  stage: MontageStage | undefined;
  how: StageStanding;
  time?: string;
  /** The figures a stage has instead of one count. */
  tiles?: readonly { figure: string; label: string }[];
  children?: React.ReactNode;
}) {
  const s = useStrings();
  const code = stage?.stage ?? 'prep';
  return (
    <SummaryJournal
      what={how === 'running' ? s.montage.journal.does[code] : s.montage.journal.came[code]}
      time={time}
      count={counted(stage, s)}
      tiles={tiles}
    >
      {children}
    </SummaryJournal>
  );
}

/* ── Подготовка ───────────────────────────────────────────────────────── */

/**
 * Preparation (spec 8, `JournalPrepRun` / `*Done`): the counters, and nothing else. A row per file
 * would be hundreds of rows about the same order — the spec's own simplification is to count — and
 * every figure here is the stage's own: how much of the order is downloaded, how much of that is
 * photos and how much video, how heavy the order is, and who brought what.
 */
function Prep({ stage, roster }: StageBody) {
  const s = useStrings();
  const j = s.montage.journal;
  const came = stage?.outcome;
  const photos = prepared(stage, 'photos');
  const videos = prepared(stage, 'videos');
  const weight = weighed(came?.bytes);
  const people = senders(stage);

  return (
    <>
      {photos && videos ? (
        <BlockJournal>
          <Shares>
            <CountPair label={j.photos} done={photos.done} of={photos.of} share={photos.share} />
            <CountPair label={j.videos} done={videos.done} of={videos.of} share={videos.share} />
          </Shares>
        </BlockJournal>
      ) : null}

      {came?.photos === undefined && came?.videos === undefined ? null : (
        <BlockJournal label={j.inOrder}>
          <Shares>
            {came.photos === undefined ? null : (
              <Tile figure={String(came.photos)} label={j.photos} />
            )}
            {came.videos === undefined ? null : (
              <Tile figure={String(came.videos)} label={j.videos} />
            )}
            {came.video_seconds === undefined ? null : (
              <Tile figure={formatRuntime(came.video_seconds) ?? ''} label={j.totalVideo} />
            )}
            {weight === null ? null : <Tile figure={weight.figure} label={j[weight.unit]} />}
          </Shares>
        </BlockJournal>
      )}

      {people.length === 0 ? null : (
        <BlockJournal label={j.whoBrought}>
          <Text role="metaSm" tone="muted">
            {j.bringers(people.length)}
          </Text>
          {people.map((one) => (
            <RowShare
              key={one.id}
              name={memberName(roster?.find((member) => member.id === one.id) ?? null)}
              count={one.count}
              share={one.share}
            />
          ))}
        </BlockJournal>
      )}

      <BlockJournal>
        <HintNote icon={Clock} text={j.lateNote} />
      </BlockJournal>
    </>
  );
}

/* ── Анализ ──────────────────────────────────────────────────────────── */

/**
 * Analysis (spec 8, `JournalAnalysisRun` / `*Done`): the card «Сейчас» over the frame being
 * described while it runs, the block of descriptions either way, and — once it is behind — the three
 * figures of what it came to.
 *
 * A description taken ready-made out of a past film stands quieter than one written now: that is all
 * it is, and the screen says so in the line over the block as well as in the row itself.
 */
function Analysis(props: StageBody) {
  const s = useStrings();
  const j = s.montage.journal;
  const { stage, how, entries, files, roster, openEntry, onOpenEntry } = props;
  const now = inHand(entries);
  const shown = framed(entries);
  const open = shown.find((entry) => entry.id === openEntry);
  const came = stage?.outcome;
  const finished = how === 'done';

  return (
    <>
      {now && how === 'running' ? <NowFrame entry={now} file={fileOf(now, files)} /> : null}

      {open ? (
        <FrameCard
          entry={open}
          file={fileOf(open, files)}
          author={authorOf(open, files, roster)}
          onClose={() => onOpenEntry(0)}
        />
      ) : null}

      {finished ? (
        <BlockJournal>
          <Shares>
            {came?.described === undefined ? null : (
              <Tile figure={String(came.described)} label={j.describedNow} />
            )}
            {came?.earlier === undefined ? null : (
              <Tile figure={String(came.earlier)} label={j.ofEarlier} />
            )}
            {came?.people === undefined ? null : (
              <Tile figure={String(came.people)} label={j.peopleFound} />
            )}
          </Shares>
        </BlockJournal>
      ) : null}

      {!finished && came?.earlier === undefined ? null : (
        <Text role="note" tone="muted">
          {came?.earlier === undefined ? '' : j.earlierNote(came.earlier)}
        </Text>
      )}

      {shown.length === 0 ? null : (
        <BlockJournal label={j.described}>
          <Text role="metaSm" tone="muted">
            {j.describedQuieter}
          </Text>
          {shown.map((entry) => {
            const file = fileOf(entry, files);
            return (
              <RowFrame
                key={entry.id}
                uri={file?.thumbnail_url ?? undefined}
                length={formatRuntime(file?.duration_seconds ?? null)}
                source={frameLine(entry, file, s).join(' · ')}
                dim={entry.details?.earlier === true}
                onPress={() => onOpenEntry(entry.id)}
                label={j.described}
              />
            );
          })}
        </BlockJournal>
      )}
    </>
  );
}

/**
 * The card «Сейчас» of a stage that is working on a frame at all — the analysis describing one and
 * the assembly saying what it is gluing. The sentence types itself out as the worker says it.
 */
function NowFrame({ entry, file }: { entry: JournalEntry; file: JournalFile | undefined }) {
  const s = useStrings().montage;
  const thought = useTypedThought(entry.thought, true);
  return (
    <CardFilmNow
      who={s.live.director}
      what={s.filmScreen.at.analysis}
      now={s.live.now}
      uri={file?.thumbnail_url ?? undefined}
      thought={thought.said}
    />
  );
}

/* ── Режиссура ────────────────────────────────────────────────────────── */

/**
 * Directing (spec 8, `JournalDirectorRun` / `*Done` / `*Skipped`): the director's thought while it
 * runs, the parts of the story either way, and one block for everything that was not taken — with
 * the reasons under it as the api counts them, and the frames themselves once they are asked for.
 */
function Directing(props: StageBody) {
  const s = useStrings();
  const j = s.montage.journal;
  const { stage, how, entries, files, roster, openPart, onOpenPart, openPasses, onOpenPasses } =
    props;
  const plan = parts(stage);
  const passed = passes(stage, s);
  const thought = entries.find((entry) => entry.media_id === null && entry.decision === null);
  const typed = useTypedThought(thought?.thought, how === 'running' && thought !== undefined);

  return (
    <>
      {thought && how === 'running' ? (
        <ThoughtJournal
          label={j.directorThought}
          now={s.montage.live.now}
          said={typed.said}
          unsaid={typed.unsaid}
        />
      ) : null}

      {plan.map((part) => {
        const frames = entries.filter((entry) => entry.story_part === part.at);
        const open = openPart === part.at;
        return (
          <PartJournal
            key={part.at}
            label={j.partLabel(part.at)}
            title={part.title}
            line={partLine(part, s)}
            building={how === 'running' && open ? j.building : undefined}
            more={part.empty ? undefined : Math.max(0, (part.taken ?? 0) - frames.length)}
            onPress={part.empty ? undefined : () => onOpenPart(open ? 0 : part.at)}
          >
            {open
              ? frames.map((entry) => (
                  <RowFrame
                    key={entry.id}
                    uri={fileOf(entry, files)?.thumbnail_url ?? undefined}
                    length={formatRuntime(fileOf(entry, files)?.duration_seconds ?? null)}
                    source={sourceOf(entry, files, roster, s)}
                    text={entry.thought ?? undefined}
                    marks={<Marks entry={entry} />}
                    onPress={() => onOpenPart(0)}
                    label={part.title}
                  />
                ))
              : null}
          </PartJournal>
        );
      })}

      {passed === null ? null : (
        <BlockJournal label={j.notTaken}>
          <Text role="metaSm" tone="muted">
            {j.notTakenNote(passed.total)}
          </Text>
          <Shares>
            <Text role="metaSm" tone="muted">
              {`${j.allTaken} ${passed.total}`}
            </Text>
            {passed.reasons.map((one) => (
              <Text key={one.reason} role="metaSm" tone="muted">
                {`${one.label} ${one.count}`}
              </Text>
            ))}
          </Shares>
          {openPasses
            ? entries
                .filter((entry) => entry.decision === 'skip')
                .map((entry) => (
                  <RowFrame
                    key={entry.id}
                    uri={fileOf(entry, files)?.thumbnail_url ?? undefined}
                    length={formatRuntime(fileOf(entry, files)?.duration_seconds ?? null)}
                    source={sourceOf(entry, files, roster, s)}
                    text={entry.thought ?? undefined}
                    marks={<Marks entry={entry} />}
                    onPress={onOpenPasses}
                    label={j.notTaken}
                  />
                ))
            : null}
          <Button size="xs" wide={false} label={j.seeAll} onPress={onOpenPasses} />
        </BlockJournal>
      )}
    </>
  );
}

/* ── Музыка ──────────────────────────────────────────────────────────── */

/**
 * Music (spec 8, `JournalMusicRun` / `*Done` / `*None`): the track the cuts were laid to, the tape
 * they stand on, and one block per part of the story with the two shares of sound in it.
 *
 * A film ordered without music still has this stage and still cuts — by sense and by the pauses in
 * the speech rather than by the beat — so what changes is the head of the block and the bars under
 * each part, not whether any of it is drawn.
 */
function Music({ stage, how, entries, montage, stages }: StageBody) {
  const s = useStrings();
  const j = s.montage.journal;
  const tracks = stage?.outcome.tracks ?? stage?.outcome.track ?? [];
  const withTrack = tracks.length > 0;
  const length = filmLength(
    stages.find((one) => one.stage === 'assembly'),
    montage?.params.target_seconds,
  );
  const tape = tapeOf(stage, length);
  const plan = parts(stage);
  const tempo = stage?.outcome.bpm;

  return (
    <>
      <BlockJournal>
        {withTrack ? (
          <>
            <Text role="row">{tracks[0]}</Text>
            {tempo === undefined || length === null ? null : (
              <Text role="metaSm" tone="muted">
                {`${s.montage.filmScreen.bpm(tempo)} · ${formatRuntime(length)}`}
              </Text>
            )}
          </>
        ) : (
          <>
            <Text role="row">{j.noMusicTitle}</Text>
            <Text role="metaSm" tone="muted">
              {j.noMusicNote}
            </Text>
            <Text role="note" tone="muted">
              {j.noMusicText}
            </Text>
          </>
        )}
      </BlockJournal>

      <BlockJournal label={withTrack ? j.cutsToBeat : j.cutsBySense}>
        {tape === null ? null : (
          <>
            <TapeCuts cuts={tape} />
            <Text role="metaSm" tone="muted">
              {j.ticksAreCuts}
            </Text>
          </>
        )}
      </BlockJournal>

      {plan.map((part) => {
        const entry = entries.find((one) => one.story_part === part.at);
        const both = sharesOf(entry);
        const ahead = how === 'running' && entry === undefined;
        return (
          <PartSound
            key={part.at}
            title={part.title}
            line={`${part.from}–${part.to}`}
            now={how === 'running' && entry !== undefined}
            shares={
              withTrack && both
                ? [
                    both.music === null ? null : { label: j.musicShare, share: both.music },
                    both.live === null ? null : { label: j.liveShare, share: both.live },
                  ].filter((one): one is { label: string; share: number } => one !== null)
                : undefined
            }
            why={ahead ? j.yetAhead : (entry?.thought ?? undefined)}
          />
        );
      })}
    </>
  );
}

/* ── Сборка ──────────────────────────────────────────────────────────── */

/**
 * Assembly (spec 8, `JournalAssemblyRun` / `*Done`): the percent the worker reckons and the substep
 * it is on, the figures of what came out, the card «Сейчас», and the substeps that are already
 * done. A finished assembly adds the notice that went out and the way to watch the film.
 */
function Assembly({ stage, how, entries, montage }: StageBody) {
  const s = useStrings();
  const j = s.montage.journal;
  const progress = assemblyProgress(stage, s);
  const steps = assemblySteps(stage, s);
  const tiles = assemblyTiles(stage, s);
  const thought = entries.find((entry) => entry.media_id === null);
  const typed = useTypedThought(thought?.thought, how === 'running' && thought !== undefined);
  const shape = montage?.params.orientation;

  return (
    <>
      <BlockJournal>
        {progress ? (
          <>
            <Text role="figure">{`${progress.percent}%`}</Text>
            <Text role="metaSm" tone="muted">
              {progress.step ?? j.gluing}
            </Text>
          </>
        ) : null}
        {shape === undefined ? null : (
          <Text role="metaSm" tone="muted">
            {s.montage.filmScreen.orientationWord[shape]}
          </Text>
        )}
        {tiles.length === 0 ? null : (
          <Shares>
            {tiles.map((tile) => (
              <Tile key={tile.label} figure={tile.figure} label={tile.label} />
            ))}
          </Shares>
        )}
      </BlockJournal>

      {thought && how === 'running' ? (
        <ThoughtJournal
          label={progress?.step ?? j.gluing}
          now={s.montage.live.now}
          said={typed.said}
          unsaid={typed.unsaid}
        />
      ) : null}

      {steps.length === 0 ? null : (
        <BlockJournal label={j.doneAlready}>
          {steps.map((step, i) => (
            <RowStep key={step.step} at={i + 1} label={step.label} state={step.state} />
          ))}
        </BlockJournal>
      )}
    </>
  );
}

/**
 * The card one frame of the analysis opens into — the whole of `JournalAnalysisCardOpen`. A field the
 * worker did not write is not drawn, and the comments stand empty because the product has no
 * comments yet (m-32).
 */
function FrameCard({
  entry,
  file,
  author,
  onClose,
}: {
  entry: JournalEntry;
  file: JournalFile | undefined;
  author: string;
  onClose: () => void;
}) {
  const s = useStrings();
  const j = s.montage.journal;
  const people = peopleCount(entry);
  return (
    <CardFrame
      uri={file?.thumbnail_url ?? undefined}
      title={
        file === undefined
          ? author
          : `${file.file_name ?? s.montage.journal.noName} · ${s.media[file.kind]}${
              file.duration_seconds === null ? '' : ` ${formatRuntime(file.duration_seconds)}`
            }`
      }
      meta={file === undefined ? undefined : `${author} · ${formatTime(entry.created_at)}`}
      words={{ what: j.whatHappens, who: j.whoInFrame, moments: j.moments, comments: j.comments }}
      what={entry.thought ?? undefined}
      fields={describedFields(entry, s)}
      marks={seen(entry, s)}
      people={people === null ? undefined : j.peopleTotal(people)}
      moments={moments(entry)}
      comments={j.noCommentsYet}
      fold={toldInFull(entry) === undefined ? undefined : j.inFull}
      close={j.collapse}
      onClose={onClose}
    />
  );
}

/* ── Общее ───────────────────────────────────────────────────────────── */

/** One record's marks — «Взял», «Взял 0:04–0:07», «Не взял» and why — in the kit's own pills. */
export function Marks({ entry }: { entry: JournalEntry }) {
  const s = useStrings();
  const marks = marksOf(entry, s);
  if (marks.length === 0) return null;
  return (
    <>
      {marks.map((mark, at) => (
        <BadgeDecision
          key={mark}
          kind={entry.decision === 'take' ? (at === 0 ? 'take' : 'part') : 'pass'}
          label={mark}
        />
      ))}
    </>
  );
}

/** One figure with the word for what it counts — the tile a stage's own block is built out of. */
function Tile({ figure, label }: { figure: string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text role="figureTile">{figure}</Text>
      <Text role="metaSm" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const fileOf = (entry: JournalEntry, files: Record<string, JournalFile>) =>
  entry.media_id === null ? undefined : files[entry.media_id];

const authorOf = (
  entry: JournalEntry,
  files: Record<string, JournalFile>,
  roster: Member[] | null,
) => memberName(roster?.find((one) => one.id === fileOf(entry, files)?.uploaded_by) ?? null);

/** «IMG_2041 · фото · прислала Аня» — the file, what it is, and who brought it. */
const sourceOf = (
  entry: JournalEntry,
  files: Record<string, JournalFile>,
  roster: Member[] | null,
  s: ReturnType<typeof useStrings>,
): string | undefined => {
  const file = fileOf(entry, files);
  const name = file?.file_name;
  const kind = file === undefined ? undefined : s.media[file.kind];
  const who = memberName(roster?.find((one) => one.id === file?.uploaded_by) ?? null);
  return [name, kind, who].filter(Boolean).join(' · ');
};

const styles = StyleSheet.create({
  tile: { flexGrow: 1, gap: 2 },
  // The two rows of the summary sit 10 apart; nothing else on the screen carries a gap of its own.
  body: { gap: space.s3 },
});
