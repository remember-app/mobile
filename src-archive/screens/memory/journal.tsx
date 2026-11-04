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
export type StageBody = {
  stage: MontageStage | undefined;
  how: StageStanding;
  entries: JournalEntry[];
  files: Record<string, JournalFile>;
  roster: Member[] | null;
  montage: Montage | null;
  stages: MontageStage[];
  openPart: number | null;
  onOpenPart: (at: number) => void;
  openEntry: number | null;
  onOpenEntry: (id: number) => void;
  openPasses: boolean;
  onOpenPasses: () => void;
  onWatch: () => void;
};
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
  tiles?: readonly {
    figure: string;
    label: string;
  }[];
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

      {finished || came?.earlier === undefined ? null : (
        <Text role="note" tone="muted">
          {j.earlierNote(came.earlier)}
        </Text>
      )}

      {shown.length === 0 ? null : (
        <BlockJournal label={finished ? j.described : j.describedLast}>
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
  const plan = parts(stages.find((one) => one.stage === 'directing'));
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
                  ].filter(
                    (
                      one,
                    ): one is {
                      label: string;
                      share: number;
                    } => one !== null,
                  )
                : undefined
            }
            why={ahead ? j.yetAhead : (entry?.thought ?? undefined)}
          />
        );
      })}
    </>
  );
}
function Assembly({ stage, how, entries, montage, onWatch }: StageBody) {
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
              {how === 'done' ? j.ready : (progress.step ?? j.gluing)}
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

      {how === 'done' ? (
        <BlockJournal>
          <Text role="metaSm" tone="muted">
            {j.noticeSent}
          </Text>
          <Button wide label={j.watchMovie} onPress={onWatch} />
        </BlockJournal>
      ) : null}
    </>
  );
}
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
          : `${file.file_name ?? s.montage.journal.noName} · ${s.media[file.kind]}${file.duration_seconds === null ? '' : ` ${formatRuntime(file.duration_seconds)}`}`
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
  body: { gap: space.s3 },
});
