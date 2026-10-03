import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  listMembers,
  listMontages,
  type Member,
  MONTAGE_STAGES,
  type Montage,
  type MontageStageCode,
} from '@/api';
import { Banner, Board, StageHead, StageNotice, StagePager, StepScale } from '@/kit';
import { useAuth } from '@/lib/auth';
import { useStrings } from '@/lib/language';
import {
  codeOf,
  currentStage,
  minutesLeft,
  STAGE_COUNT,
  stageNumber,
  standing,
  stoppedWord,
  timeWord,
  useMontageJournal,
} from '@/lib/montage/journal';
import { StageBlocks, Summary } from '@/screens/memory/journal';
import { MontageGone } from '@/screens/memory/montage-gone';
import { space } from '@/theme';

/**
 * The journal of one stage of a film (spec 8, `Journal*`) — one screen in four states: waits, runs,
 * ready, stopped. Somebody came here to know what the stage did and why, so the screen is that
 * stage's own row, its own counts and its own records, and nothing about the other four.
 *
 * The journal is read narrowed to this stage (`useMontageJournal(…, { stage })`), so what is on the
 * screen is that stage's and not the whole film's; the poll stops the moment the film is ready or
 * has fallen over, because nothing more is coming.
 *
 * Two of the four states are the same screen in a thinner dress — a stage nobody has come to yet
 * and a stage that stopped are one notice each ({@link StageNotice}) — and the film itself being
 * gone is the api's 404, where there is nothing of it left to draw at all.
 */
export default function JournalStageScreen() {
  const { id, montageId, stage } = useLocalSearchParams<{
    id: string;
    montageId: string;
    /** One of the five codes the worker writes (`MONTAGE_STAGES`). */
    stage: string;
  }>();
  const router = useRouter();
  const { token } = useAuth();
  const s = useStrings();
  const code = codeOf(stage);

  const journal = useMontageJournal(token, id, montageId, { stage: code });
  const [montage, setMontage] = useState<Montage | null>(null);
  const [roster, setRoster] = useState<Member[] | null>(null);
  const [openPart, setOpenPart] = useState<number | null>(null);
  const [openEntry, setOpenEntry] = useState<number | null>(null);
  const [openPasses, setOpenPasses] = useState(false);

  const film = useCallback(
    () =>
      router.replace({
        pathname: '/memory/[id]/montage/[montageId]/film',
        params: { id, montageId },
      }),
    [router, id, montageId],
  );

  /**
   * The film itself and the roster beside it. The film is what the assembly says its shape in, and
   * the roster is what turns the ids the api carries people under into names — both read on the way
   * in, so the screen never draws a bare id where a name belongs.
   */
  const read = useCallback(() => {
    if (!token) return;
    listMontages(token, id).then(
      (films) => setMontage(films.find((one) => one.id === montageId) ?? null),
      () => {},
    );
    listMembers(token, id).then(setRoster, () => {});
  }, [token, id, montageId]);

  useEffect(read, [read]);

  // Another stage is another journal: whatever was left open under the last one does not carry over,
  // and the poll under this stage starts from nothing.
  useEffect(() => {
    setOpenPart(null);
    setOpenEntry(null);
    setOpenPasses(false);
  }, [code]);

  const row = journal.stages.find((one) => one.stage === code);
  const how = standing(row);
  const hand = currentStage(journal.stages);
  const at = stageNumber(code);
  const neighbours = {
    before: MONTAGE_STAGES[at - 2],
    after: MONTAGE_STAGES[at],
  };

  const pager = (
    <StagePager
      before={neighbours.before === undefined ? undefined : s.montage.stage[neighbours.before]}
      after={neighbours.after === undefined ? undefined : s.montage.stage[neighbours.after]}
      toFilm={neighbours.after === undefined ? s.montage.journal.toFilm : undefined}
      onBefore={
        neighbours.before === undefined
          ? undefined
          : () => toStage(router, id, montageId, neighbours.before)
      }
      onAfter={
        neighbours.after === undefined
          ? film
          : () => toStage(router, id, montageId, neighbours.after)
      }
    />
  );

  const frame = (children: React.ReactNode) => (
    <Board
      bar={
        <View>
          <StepScale
            tone="paper"
            steps={STAGE_COUNT}
            done={how === 'waiting' ? at - 1 : at}
            stopped={how === 'failed'}
            label={s.montage.live.stageOf(at, STAGE_COUNT)}
            style={styles.scale}
          />
          <StageHead
            name={s.montage.stage[code]}
            stageOf={s.montage.live.stageOf(at, STAGE_COUNT)}
            onFilm={film}
            label={s.montage.journal.toFilm}
          />
        </View>
      }
      body={styles.body}
      footer={pager}
    >
      {children}
    </Board>
  );

  if (journal.standing === 'refused') {
    return <MontageGone title={s.montage.journal.gone} onBack={film} />;
  }

  // Nobody has come to this stage yet: it opens by itself when the making gets to it, and the way
  // to wait for it is the stage that is running now.
  if (how === 'waiting') {
    return frame(
      <StageNotice
        title={s.montage.journal.notStartedTitle}
        text={
          hand === null
            ? s.montage.journal.notStartedQuiet
            : s.montage.journal.notStartedText(s.montage.stage[hand.stage])
        }
        action={
          hand === null ? undefined : s.montage.journal.watchStage(s.montage.stage[hand.stage])
        }
        onAction={hand === null ? undefined : () => toStage(router, id, montageId, hand.stage)}
      />,
    );
  }

  const blocks = (
    <StageBlocks
      stage={row}
      how={how}
      entries={journal.entries}
      files={journal.files}
      roster={roster}
      montage={montage}
      stages={journal.stages}
      openPart={openPart}
      onOpenPart={setOpenPart}
      openEntry={openEntry}
      onOpenEntry={setOpenEntry}
      openPasses={openPasses}
      onOpenPasses={() => setOpenPasses((was) => !was)}
      onWatch={film}
    />
  );

  // The making stopped on this stage. Its own notice says why, and everything the stage did get
  // through stands under it — those keys are still in its `outcome`, and they are the part of it
  // that is worth keeping.
  if (how === 'failed') {
    return frame(
      <>
        <StageNotice
          stopped
          title={s.montage.journal.stoppedTitle}
          text={`${stoppedWord(row, s)}. ${s.montage.journal.stoppedNote}`}
        />
        {blocks}
      </>,
    );
  }

  return frame(
    <>
      {journal.standing === 'offline' ? <Banner text={s.montage.live.lost} /> : null}
      <Summary stage={row} how={how} time={timeWord(row, s, minutesLeft(journal.stages))} />
      {blocks}
    </>,
  );
}

/** The way into a stage of the same film. */
const toStage = (
  router: ReturnType<typeof useRouter>,
  id: string,
  montageId: string,
  at: MontageStageCode,
) =>
  router.push({
    pathname: '/memory/[id]/montage/[montageId]/stage/[stage]',
    params: { id, montageId, stage: at },
  });

const styles = StyleSheet.create({
  // The scale of the five stands above the bar (detail 75); the blocks are 10 apart under it.
  scale: { marginHorizontal: space.s4, marginBottom: space.s2 },
  body: { gap: space.s3, paddingBottom: space.s6 },
});
