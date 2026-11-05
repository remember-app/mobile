import { ArrowUp, Check, Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Icon, playFor } from '@/ui/kit/icon';
import { Text } from '@/ui/kit/text';
import { font, photo, radius, space, themed, useTheme } from '@/ui/theme';
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
export function BadgeFilms({ label, filled }: { label: string; filled?: boolean }) {
  const { color } = useTheme();
  const styles = useStyles();
  const box = filled ? FILMS_PLAY.filled : FILMS_PLAY.outlined;
  return (
    <View style={[styles.pill, styles.films, filled ? styles.accent : styles.accentLine]}>
      <View style={[styles.playBox, { width: box, height: box }]}>
        <Icon
          icon={Play}
          size={playFor(box)}
          color={filled ? color.onFill : color.accentText}
          fill={filled ? color.onFill : color.accentText}
        />
      </View>
      <Text role="meta" tone={filled ? 'onFill' : 'accent'} style={styles.count}>
        {label}
      </Text>
    </View>
  );
}
const FILMS_PLAY = { filled: 13, outlined: 12 } as const;
export type MontageState = 'ready' | 'pending' | 'failed';
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
export type Contribution = 'done' | 'planned';
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
    organizer: { paddingVertical: 6, paddingHorizontal: 11, borderWidth: 0 },
    caps: { lineHeight: 14 },
    films: { gap: 6, paddingVertical: 6, paddingLeft: 10, paddingRight: 12, borderWidth: 0 },
    count: { fontFamily: font.semi, lineHeight: 16 },
    playBox: { alignItems: 'center', justifyContent: 'center' },
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
    mark: {
      flexShrink: 1,
      minHeight: 22,
      justifyContent: 'center',
      paddingHorizontal: space.s2,
      borderRadius: radius.pill,
    },
    tag: { minHeight: 28, paddingHorizontal: 10 },
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
  }),
);
