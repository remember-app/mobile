import { ArrowUp, Check, Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { font, photo, radius, space, themed, useTheme } from '@/theme';

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
    <View style={[styles.pill, styles.spark, sm ? styles.pillSm : styles.organizer]}>
      <Text role={sm ? 'badgeSm' : 'badge'} tone="sparkInk" style={sm ? null : styles.caps}>
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
    <View style={[styles.pill, styles.films, filled ? styles.accent : styles.accentLine]}>
      <Icon
        icon={Play}
        size={filled ? 13 : 12}
        color={filled ? color.onFill : color.accentText}
        fill={filled ? color.onFill : color.accentText}
      />
      <Text role="meta" tone={filled ? 'onFill' : 'accent'} style={styles.count}>
        {label}
      </Text>
    </View>
  );
}

/** Where a montage stands (spec 7.4). Three states, and the words for them belong to the screen. */
export type MontageState = 'ready' | 'pending' | 'failed';

/**
 * It always lies on a poster, so «СОБИРАЕТСЯ» is the photograph's blue and not the theme's (spec 2:
 * `rgba(75,91,255,.28)` under `#C9CDFF`). Two sizes (spec 7.4, detail 24): `sm` on a card in the
 * strip — `badgeSm` in caps, 21 tall on `0 9`, as `MemoryFrames` draws «ГОТОВ» and «СОБИРАЕТСЯ»;
 * left off, the large poster of `MontageLiveDone` — «Готов» as it is written, 11 / 700 with no
 * tracking, in the 22 pill of a decision mark.
 */
export function BadgeMontage({
  label,
  state,
  sm,
}: {
  label: string;
  state: MontageState;
  sm?: boolean;
}) {
  const styles = useStyles();

  return (
    <View
      style={[
        sm ? styles.strip : styles.mark,
        state === 'ready' ? styles.spark : state === 'pending' ? styles.filming : styles.failed,
      ]}
    >
      <Text
        role={sm ? 'badgeSm' : 'decision'}
        tone={state === 'ready' ? 'sparkInk' : state === 'failed' ? 'danger' : undefined}
        style={state === 'pending' ? styles.filmingInk : null}
      >
        {sm ? label.toUpperCase() : label}
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
export function BadgeContribution({ state, label }: { state: Contribution; label: string }) {
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
    // Spec 7.4, details 22–23, as `Main` draws them over a cover and on a card: «ОРГАНИЗАТОР» 6 / 11
    // round its caps, 26 tall; the films count 6 / 12 / 6 / 10 round a 12 / 600, 28 filled — and the
    // outlined one is that pill plus its hairline, 30, pulled a point in at the sides.
    organizer: { paddingVertical: 6, paddingHorizontal: 11, borderWidth: 0 },
    caps: { lineHeight: 14 },
    films: { gap: 6, paddingVertical: 6, paddingLeft: 10, paddingRight: 12, borderWidth: 0 },
    count: { fontFamily: font.semi, lineHeight: 16 },
    // A floor and not a height: the caps grow with the system's type, and the pill with them.
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 21,
      paddingHorizontal: 9,
      borderRadius: radius.pill,
    },
    filming: { backgroundColor: photo.pending },
    filmingInk: { color: photo.pendingInk },
    spark: { backgroundColor: color.spark },
    raise: { backgroundColor: color.raise },
    accent: { backgroundColor: color.accent },
    accentLine: { borderWidth: 1, borderColor: color.accent, paddingLeft: 9, paddingRight: 11 },
    pending: { backgroundColor: color.pendingSoft },
    failed: { backgroundColor: color.failedSoft },
    // Spec 7.4 — the decision mark and the tag word are the same 22/28 pill at two widths; what
    // differs between them is the fill and whether anything ever presses it. The 22 is a floor: the
    // mark is also «Готов» on the large poster, and its words grow with the system's type — and wrap
    // at their spaces where a line is narrower than the mark.
    mark: {
      flexShrink: 1,
      minHeight: 22,
      justifyContent: 'center',
      paddingHorizontal: space.s2,
      borderRadius: radius.pill,
    },
    tag: { height: 28, paddingHorizontal: 10 },
    circle: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Spec 7.4, detail 27: «ещё будет» is ringed 1 in `lineStrong`.
    circlePlanned: { borderColor: color.lineStrong },
  }),
);
