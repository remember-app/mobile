import { ArrowUp, Check, Play } from 'lucide-react-native';
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

/**
 * What a participant has contributed, as it stands at the right edge of their row (spec 7.4). Two
 * of them and no third: everything is either in or still coming. «Мне нечего добавлять» used to be
 * a state of its own here and is not one any more — somebody who has nothing to bring has brought
 * all of it, and a third grey circle only made the column harder to scan.
 */
export type Contribution = 'done' | 'planned';

/**
 * The 28 circle on a member row. Filled `spark` with a check when everything is in, an outline with
 * an arrow up while it is still coming — and `label` is what it says out loud, because a circle says
 * nothing on its own. Your own row wears the same circle inside a 44 button (spec 7.4): the standing
 * is yours to change at any moment.
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
  const done = state === 'done';

  return (
    <View
      accessibilityLabel={label}
      style={[styles.circle, done ? styles.spark : styles.circlePlanned]}
    >
      <Icon
        icon={done ? Check : ArrowUp}
        size={done ? 14 : 13}
        color={done ? color.sparkInk : color.muted}
      />
    </View>
  );
}

/**
 * Spec 7.4 — what the director decided about one file, as a 22 pill beside the thought that led to
 * it. «Беру», «Беру 0:04–0:07» and «Взял 1 из 4» are one kind and not three: spec 1.2 gives `spark`
 * the meaning «taken» in the montage, so anything taken wears it and the words say how much.
 *
 * «часть 2» is the third kind and it stands *beside* a `take`, never instead of one — where a taken
 * frame ends up in the film is a second fact about the same decision.
 */
export type Decision = 'take' | 'pass' | 'part';

export function BadgeDecision({ label, kind }: { label: string; kind: Decision }) {
  const styles = useStyles();

  return (
    <View
      style={[
        styles.mark,
        kind === 'take' ? styles.spark : kind === 'pass' ? styles.raise : styles.pending,
      ]}
    >
      <Text
        role="decision"
        numberOfLines={1}
        tone={kind === 'take' ? 'sparkInk' : kind === 'pass' ? 'muted' : 'accent'}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Spec 7.4 — one word of what the director saw on a frame: «Бабушка», «смех», «тёплый свет». It is
 * not a chip and never becomes one — nothing here filters, selects or presses. A row of them wraps.
 */
export function Tag({ label }: { label: string }) {
  const styles = useStyles();

  return (
    <View style={[styles.mark, styles.tag, styles.raise]}>
      <Text role="meta" tone="paper" numberOfLines={1}>
        {label}
      </Text>
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
    raise: { backgroundColor: color.raise },
    accent: { backgroundColor: color.accent },
    accentLine: { borderColor: color.accentText },
    pending: { backgroundColor: color.pendingSoft },
    failed: { backgroundColor: color.failedSoft },
    // Spec 7.4 — the decision mark and the tag word are the same 22/28 pill at two widths; what
    // differs between them is the fill and whether anything ever presses it.
    mark: { height: 22, justifyContent: 'center', paddingHorizontal: space.s2, borderRadius: radius.pill },
    tag: { height: 28, paddingHorizontal: 10 },
    circle: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    circlePlanned: { borderColor: color.lineStrong },
  }),
);
