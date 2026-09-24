import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { type JournalEntry, MONTAGE_STAGES, type MontageStageCode } from '@/api';
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
 * The five stages of a making as one block (spec 7.6, detail 56) — all five, always, whether the
 * worker has reached them or not: what is ahead is part of the answer to «how far along is it», and a
 * list that grew a row at a time would move under the finger every minute. The live screen and the
 * finished film's page draw the very same rows, so they are drawn here once.
 *
 * Every row that has been reached opens its stage's own journal, and so does the link under an
 * opened one; an opened row shows its last two records.
 */
export function StageRows({
  memoryId,
  montageId,
  journal,
  opens,
  onRecord,
}: {
  memoryId: string;
  montageId: string;
  journal: Pick<Journal, 'stages' | 'entries' | 'files'>;
  /** Whether a stage is opened out — and only ever one with records to open out to. */
  opens: (code: MontageStageCode) => boolean;
  /**
   * A record about a frame, pressed — the finished page opens that frame's card. Without it a record
   * is a glance, which is what it is while the montage is still being cut.
   */
  onRecord?: (entry: JournalEntry) => void;
}) {
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const toStage = (code: MontageStageCode) =>
    router.push({
      pathname: '/memory/[id]/montage/[montageId]/stage/[stage]',
      params: { id: memoryId, montageId, stage: code },
    });

  return (
    <View style={styles.stages}>
      {MONTAGE_STAGES.map((code, at) => {
        const row = journal.stages.find((one) => one.stage === code);
        const last = lastOfStage(journal.entries, code);

        return (
          <Fragment key={code}>
            {/* The hairline between two stages, inset to where their names start — the kit's soft
                rule, because five of `line` in a row would read as a grid. */}
            {at > 0 ? <Divider soft style={styles.between} /> : null}
            <RowStep
              title={s.montage.stage[code]}
              meta={row && stageLine(row, s)}
              state={stageStanding(row)}
              open={opens(code) && last.length > 0}
              onPress={() => toStage(code)}
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
                    // A thought about the plan as a whole has no frame to open.
                    onPress={
                      onRecord && entry.media_id !== null ? () => onRecord(entry) : undefined
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
    // Spec detail 56: the rule between two stages starts where their names do.
    between: { marginLeft: 50 },
  }),
);
