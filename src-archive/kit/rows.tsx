import { ChevronRight, Pause, Play } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { height, photo, radius, space, themed, useTheme } from '@/theme';
import { Divider } from './bits';
import { IconButton } from './button';
import { Icon, type IconComponent, playFor } from './icon';
import { hitSlop, PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';
export function RowSummary({
  label,
  value,
  onPress,
  divider,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  return (
    <View>
      {divider ? <Divider soft /> : null}
      <Tappable
        label={`${label}: ${value}`}
        onPress={onPress}
        style={[styles.summary, onPress ? styles.summaryTap : null]}
      >
        <Text role="meta" style={styles.summaryLabel}>
          {label}
        </Text>
        <Text role="summary" style={styles.grow}>
          {value}
        </Text>
        {onPress ? <Icon icon={ChevronRight} size={18} color={color.faint} /> : null}
      </Tappable>
    </View>
  );
}
export function RowEdit({
  value,
  edit,
  onEdit,
  divider,
}: {
  value: string;
  edit: string;
  onEdit?: () => void;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const focusRing = useFocusRing();
  return (
    <View>
      {divider ? <Divider soft /> : null}
      <View style={styles.edit}>
        <Text role="row" style={[styles.grow, styles.figures]}>
          {value}
        </Text>
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${edit}: ${value}`}
            hitSlop={hitSlop(EDIT_TAIL)}
            onPress={onEdit}
            {...props}
            style={({ pressed }) => [
              styles.editAt,
              pressed && !reduced ? PRESS : null,
              focused ? focusRing : null,
            ]}
          >
            <Text role="controlSm" tone="accent">
              {edit}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
export function ShotCells({
  cells,
  style,
}: {
  cells: readonly (string | null)[];
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const said = cells.filter((one): one is string => one !== null);
  if (said.length === 0) return null;
  return (
    <View accessible accessibilityLabel={said.join(' · ')} style={[styles.shotCells, style]}>
      {said.map((cell, at) => (
        <View key={at} style={[styles.shotCell, at === 0 ? null : styles.shotCellAfter]}>
          <Text role="timecode" tone="muted" style={styles.shotFigures}>
            {cell}
          </Text>
        </View>
      ))}
    </View>
  );
}
export const TRACK_ROW = 52;
const PLAY_GLYPH = { size: playFor(16), filled: true } as const;
export const WISH_GLYPH = { size: 15, stroke: 1.9 } as const;
export function RowTrack({
  title,
  length,
  wish,
  picked,
  playing,
  grip,
  play,
  action,
  divider,
  children,
}: {
  title: string;
  length: string;
  wish?: string;
  picked?: boolean;
  playing?: boolean;
  grip?: ViewProps;
  play?: {
    label: string;
    onPress: () => void;
  };
  action?: ReactNode;
  divider?: boolean;
  children?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View>
      {divider ? <Divider soft style={picked ? styles.insetPicked : styles.insetTrack} /> : null}
      <View style={[styles.track, picked ? styles.trackPicked : null, wish ? styles.wished : null]}>
        {play ? (
          <IconButton
            icon={playing ? Pause : Play}
            label={play.label}
            size={picked ? height.roundRow : height.roundTrack}
            tone="raise"
            glyph={PLAY_GLYPH}
            onPress={play.onPress}
          />
        ) : null}
        <View {...grip} style={[styles.grow, styles.trackWords]}>
          <View style={styles.trackLine}>
            <Text role="row" tone={playing ? 'spark' : 'paper'} style={styles.shrink}>
              {title}
            </Text>
            <Text role="meta">{length}</Text>
          </View>

          {wish ? (
            <Text role="meta" numberOfLines={1} style={styles.wish}>
              {wish}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children ? <View style={styles.unfolded}>{children}</View> : null}
    </View>
  );
}
export function Waveform() {
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.wave}
    >
      {BARS.map((tall, i) => (
        <View key={i} style={[styles.waveBar, { height: tall }]} />
      ))}
    </View>
  );
}
const BARS = [6, 10, 15, 9, 18, 12, 7, 14, 17, 9, 13, 6, 11, 16, 8, 12, 15, 7, 10, 14];
export function RowRejected({
  icon,
  title,
  count,
  children,
  divider,
}: {
  icon: IconComponent;
  title: string;
  count: string;
  children?: ReactNode;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  return (
    <View>
      {divider ? <Divider /> : null}
      <View style={styles.rejected}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.square}
        >
          <Icon icon={icon} size={18} color={color.muted} />
        </View>
        <View style={styles.grow}>
          <Text role="row">{title}</Text>
          <Text role="meta">{count}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}
export function RowAction({
  icon,
  label,
  danger,
  onPress,
  divider,
}: {
  icon: IconComponent;
  label: string;
  danger?: boolean;
  onPress?: () => void;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const tint = danger ? color.dangerText : color.paper;
  return (
    <View>
      {divider ? <Divider soft /> : null}
      <Tappable label={label} onPress={onPress} style={styles.action}>
        <Text role="rowPlain" style={[styles.grow, { color: tint }]}>
          {label}
        </Text>
        <Icon icon={icon} size={19} color={tint} />
      </Tappable>
    </View>
  );
}
export function RowSection({
  heading,
  title,
  meta,
  sign,
  onPress,
  style,
}: {
  heading?: string;
  title: string;
  meta?: string;
  sign?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const card = (
    <Tappable onPress={onPress} style={[styles.section, heading ? null : style]}>
      {sign}
      <View style={[styles.grow, styles.sectionWords]}>
        <Text role="subtitle">{title}</Text>
        {meta ? <Text role="meta">{meta}</Text> : null}
      </View>
      <Icon icon={ChevronRight} size={20} color={color.faint} />
    </Tappable>
  );
  return heading ? (
    <View style={[styles.headed, style]}>
      <Text role="eyebrow" tone="muted" accessibilityRole="header">
        {heading.toUpperCase()}
      </Text>
      {card}
    </View>
  ) : (
    card
  );
}
function Tappable({
  label,
  onPress,
  selected,
  slop,
  style,
  children,
}: {
  label?: string;
  onPress?: () => void;
  selected?: boolean;
  slop?: ReturnType<typeof hitSlop>;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const state = selected === undefined ? undefined : { selected };
  if (!onPress)
    return (
      <View accessible accessibilityLabel={label} accessibilityState={state} style={style}>
        {children}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={state}
      hitSlop={slop}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        style,
        hovered ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
const EDIT_TAIL = 28;
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    hover: { backgroundColor: color.raise },
    summary: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: space.s3,
      paddingVertical: 11,
      paddingHorizontal: space.s4,
    },
    edit: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.s3,
      paddingTop: 14,
      paddingBottom: 12,
      paddingHorizontal: space.s4,
    },
    editAt: { minHeight: EDIT_TAIL },
    figures: { fontVariant: ['tabular-nums'] },
    summaryTap: { minHeight: height.small },
    summaryLabel: { width: 96 },
    shotCells: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: color.raise,
      backgroundColor: color.surface,
    },
    shotCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 11 },
    shotCellAfter: { borderLeftWidth: 1, borderLeftColor: color.raise },
    shotFigures: { textAlign: 'center' },
    track: {
      minHeight: TRACK_ROW,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s3,
    },
    trackPicked: { gap: 10, paddingLeft: space.s3, paddingRight: space.s2 },
    wished: { minHeight: 60 },
    insetTrack: { marginLeft: 64 },
    insetPicked: { marginLeft: 60 },
    trackWords: { gap: 2 },
    trackLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      columnGap: space.s2,
    },
    shrink: { flexShrink: 1 },
    wish: { lineHeight: 16 },
    unfolded: { paddingLeft: space.s3, paddingRight: space.s2, paddingBottom: 10 },
    wave: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 18 },
    waveBar: { width: 3, borderRadius: radius.pill, backgroundColor: color.faint },
    rejected: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: 10,
    },
    square: {
      width: 38,
      height: 38,
      borderRadius: radius.thumb,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    step: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: 14,
    },
    stepLarge: { minHeight: 58 },
    stepWordsLarge: { gap: 2 },
    stepAhead: { minHeight: height.small },
    aheadWords: { lineHeight: 18 },
    stepOpen: { backgroundColor: color.accentNote },
    stepMark: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepMarkLarge: { width: 26, height: 26 },
    stepDone: { backgroundColor: color.spark },
    stepFailed: { borderColor: color.dangerText },
    stepWaiting: { borderColor: color.line },
    note: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      paddingRight: 14,
      paddingLeft: 50,
    },
    noteWords: { alignItems: 'flex-start', gap: 6 },
    noteShot: {
      width: 34,
      height: 34,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: color.raise,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    },
    noteLength: { color: photo.on, paddingRight: 3, paddingBottom: 2 },
    quoted: { lineHeight: 16 },
    action: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
      borderRadius: radius.cell,
    },
    headed: { gap: 10 },
    section: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      padding: space.s4,
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.cover,
      backgroundColor: color.surface,
    },
    sectionWords: { gap: 2 },
  }),
);
