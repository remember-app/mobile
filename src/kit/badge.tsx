import { ArrowUp, Check, Minus, Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { radius, space, themed, useTheme } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/**
 * Spec 7.4 — the badges. Every one of them is a word first and a colour second, and `spark` is
 * spent on exactly one of them per screen: the organizer, «готово», progress. Two `spark` badges
 * beside each other means one of them is wrong.
 */

/**
 * «ОРГАНИЗАТОР» — the only `spark` pill on a screen. `sm` is the size it takes inside a member row,
 * where it stands beside a name rather than over a cover.
 */
export function BadgeOrganizer({ label, sm }: { label: string; sm?: boolean }) {
  const styles = useStyles();

  return (
    <View style={[styles.pill, styles.spark, sm ? styles.pillSm : null]}>
      <Text role={sm ? 'badgeSm' : 'badge'} tone="sparkInk">
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * How many montages a memory has: filled on the large card, outlined on the ordinary one. The
 * declension — «1 ролик», «2 ролика», «5 роликов» — is a word, so the label arrives ready.
 */
export function BadgeFilms({ label, filled }: { label: string; filled?: boolean }) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.pill, filled ? styles.accent : styles.accentLine]}>
      <Icon
        icon={Play}
        size={filled ? 13 : 12}
        color={filled ? color.onFill : color.accentText}
        fill={filled ? color.onFill : color.accentText}
      />
      <Text role="badge" tone={filled ? 'onFill' : 'accent'}>
        {label}
      </Text>
    </View>
  );
}

/** Where a montage stands (spec 7.4). Three states, and the words for them belong to the screen. */
export type MontageState = 'ready' | 'pending' | 'failed';

export function BadgeMontage({ label, state }: { label: string; state: MontageState }) {
  const styles = useStyles();

  return (
    <View
      style={[
        styles.pill,
        state === 'ready' ? styles.spark : state === 'pending' ? styles.pending : styles.failed,
      ]}
    >
      <Text
        role="badge"
        tone={state === 'ready' ? 'sparkInk' : state === 'pending' ? 'accent' : 'danger'}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/** What a participant has contributed, as it stands at the right edge of their row (spec 7.4). */
export type Contribution = 'done' | 'planned' | 'nothing';

/**
 * The 28 circle on a member row. Filled `spark` with a check when everything is in, an outline with
 * an arrow while it is still coming, an outline with a dash when there is nothing to bring — and
 * `label` is what it says out loud, because a circle says nothing on its own.
 */
export function BadgeContribution({
  state,
  label,
}: {
  state: Contribution;
  label: string;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View
      accessibilityLabel={label}
      style={[
        styles.circle,
        state === 'done' ? styles.spark : null,
        state === 'planned' ? styles.circlePlanned : null,
        state === 'nothing' ? styles.circleNothing : null,
      ]}
    >
      <Icon
        icon={state === 'done' ? Check : state === 'planned' ? ArrowUp : Minus}
        size={14}
        color={
          state === 'done' ? color.sparkInk : state === 'planned' ? color.muted : color.faint
        }
      />
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: space.s2,
      paddingVertical: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    pillSm: { paddingHorizontal: space.s2, paddingVertical: 3 },
    spark: { backgroundColor: color.spark },
    accent: { backgroundColor: color.accent },
    accentLine: { borderColor: color.accentText },
    pending: { backgroundColor: color.pendingSoft },
    failed: { backgroundColor: color.failedSoft },
    circle: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    circlePlanned: { borderColor: color.lineStrong },
    circleNothing: { borderColor: color.line },
  }),
);
