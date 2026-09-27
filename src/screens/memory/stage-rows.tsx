import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { MONTAGE_STAGES, type MontageStageCode } from '@/api';
import { BadgeDecision, Divider, RowStep, StepLink, StepNote } from '@/kit';
import { formatRuntime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import {
  type Journal,
  lastOfStage,
  marksOf,
  recordsOf,
  stageLine,
  stageStanding,
} from '@/lib/montage/journal';
import { radius, themed } from '@/theme';

/**
 * The five stages of a making as one block (spec 7.6, detail 56): every stage the worker has reached
 * is a row of its own, and those still ahead are one quiet line naming them — «Дальше: ритм трека ·
 * склейка» (`MontageLive`). All five are always accounted for: what is ahead is part of the answer
 * to «how far along is it». The live screen and the finished film's page draw the very same rows, so
 * they are drawn here once.
 *
 * Every row that has been reached opens its stage's own journal, and so does the link under an
 * opened one; an opened row shows its last two records at a glance.
 */
export function StageRows({
  memoryId,
  montageId,
  journal,
  opens,
  large,
}: {
  memoryId: string;
  montageId: string;
  journal: Pick<Journal, 'stages' | 'entries' | 'files'>;
  /**
   * Whether a stage is opened out — and only ever one with records to open out to. Left off, none
   * is: the finished film's page lists its five closed (`MontageLiveDone`).
   */
  opens?: (code: MontageStageCode) => boolean;
  /**
   * The five as the main block of the film's own screen (`Film`, detail 56 «крупная свёрнутая»):
   * larger rows in a card of 20, the rule between them 52 in.
   */
  large?: boolean;
}) {
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const toStage = (code: MontageStageCode) =>
    router.push({
      pathname: '/memory/[id]/montage/[montageId]/stage/[stage]',
      params: { id: memoryId, montageId, stage: code },
    });
  const rowOf = (code: MontageStageCode) => journal.stages.find((one) => one.stage === code);
  const ahead = MONTAGE_STAGES.filter((code) => stageStanding(rowOf(code)) === 'waiting');
  const reached = MONTAGE_STAGES.filter((code) => !ahead.includes(code));
  const between = large ? styles.betweenLarge : styles.between;

  return (
    <View style={[styles.stages, large ? styles.stagesLarge : null]}>
      {reached.map((code, at) => {
        const row = rowOf(code);
        const last = lastOfStage(journal.entries, code);

        return (
          <Fragment key={code}>
            {/* The hairline between two stages, inset to where their names start — the kit's soft
                rule, because five of `line` in a row would read as a grid. */}
            {at > 0 ? <Divider soft style={between} /> : null}
            <RowStep
              large={large}
              title={s.montage.stage[code]}
              meta={row && stageLine(row, s)}
              state={stageStanding(row)}
              open={(opens?.(code) ?? false) && last.length > 0}
              onPress={() => toStage(code)}
            >
              {/* A glance while the montage is still being cut: the record is a second old, and the
                  frame's own card is one press further, on the stage's journal. */}
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
                  onPress={() => toStage(code)}
                />
              ) : null}
            </RowStep>
          </Fragment>
        );
      })}
      {ahead.length > 0 ? (
        <>
          {reached.length > 0 ? <Divider soft style={between} /> : null}
          <RowStep
            title={s.montage.live.ahead(ahead.map((code) => s.montage.stageAhead[code]))}
            state="waiting"
          />
        </>
      ) : null}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 7.6: the five stages are one block of surface with the rows inside it, not five cards.
    stages: {
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    stagesLarge: { borderRadius: radius.section },
    // Spec detail 56: the rule between two stages starts where their names do.
    between: { marginLeft: 50 },
    betweenLarge: { marginLeft: 52 },
  }),
);
