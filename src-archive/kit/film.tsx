import { Image } from 'expo-image';
import { Bell, Check, Pause } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, space, themed, useTheme } from '@/theme';
import { Divider, LiveDot, Progress } from './bits';
import { Spinner } from './empty';
import { Icon } from './icon';
import { PRESS, useReducedMotion } from './interaction';
import { Text } from './text';
export function FilmStageLine({
  name,
  of,
  stageOf,
  right,
  done,
  share,
  stopped,
}: {
  name: string;
  of: number;
  stageOf: string;
  right?: string;
  done: number;
  share?: number | null;
  stopped?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <View style={styles.say}>
        <Text role="section" style={styles.name}>
          {name}
        </Text>
        {stageOf ? (
          <Text role="timecode" tone="muted">
            {stageOf}
          </Text>
        ) : null}
        <View style={styles.grow} />
        {right ? (
          <Text role="meta" style={stopped ? styles.stopped : null}>
            {right}
          </Text>
        ) : null}
      </View>
      {stageOf ? (
        <FilmStageScale of={of} done={done} share={share} stopped={stopped} label={stageOf} />
      ) : null}
    </View>
  );
}
export function FilmStageScale({
  of,
  done,
  share,
  stopped,
  label,
}: {
  of: number;
  done: number;
  share?: number | null;
  stopped?: boolean;
  label?: string;
}) {
  const styles = useStyles();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: of, now: done }}
      style={styles.scale}
    >
      {Array.from({ length: of }, (_, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            i < done - 1 ? styles.behind : null,
            i === done - 1 && stopped ? styles.stoppedBar : null,
            i === done - 1 && !stopped ? styles.here : null,
          ]}
        >
          {i === done - 1 && !stopped && share ? (
            <Progress value={share} tone="spark" style={styles.share} />
          ) : null}
        </View>
      ))}
    </View>
  );
}
export type FilmStageState = 'done' | 'running' | 'waiting' | 'failed';
export function RowFilmStage({
  at,
  title,
  meta,
  state,
  onPress,
  children,
}: {
  at: number;
  title: string;
  meta?: string;
  state: FilmStageState;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const waiting = state === 'waiting';
  return (
    <View style={state === 'running' ? styles.running : null}>
      <FilmPress onPress={waiting ? undefined : onPress} style={styles.stageRow}>
        <View
          style={[
            styles.stageMark,
            state === 'done' ? styles.markDone : null,
            state === 'running' ? styles.markRunning : null,
            state === 'failed' ? styles.markFailed : null,
          ]}
        >
          {state === 'done' ? (
            <Icon icon={Check} size={14} stroke={3} color={color.sparkInk} />
          ) : state === 'failed' ? (
            <Icon icon={Pause} size={12} color={color.dangerText} />
          ) : waiting ? (
            <Text role="metaTile" tone="faint">
              {String(at)}
            </Text>
          ) : (
            <Spinner size={26} ring={2} track={color.line} head={color.accent} />
          )}
        </View>
        <View style={styles.stageWords}>
          <Text role="rowSm" tone={waiting ? 'muted' : undefined}>
            {title}
          </Text>
          {meta ? (
            <Text
              role="metaSm"
              numberOfLines={2}
              style={state === 'failed' ? styles.dangerText : null}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </FilmPress>
      {state === 'running' ? children : null}
    </View>
  );
}
export function FilmStageList({ children, style }: { children: ReactNode; style?: object }) {
  const styles = useStyles();
  return <View style={[styles.list, style]}>{children}</View>;
}
export function FilmStageDivider() {
  return <Divider soft style={FILM_DIVIDER} />;
}
const FILM_DIVIDER = { marginLeft: 52 } as const;
export function CardFilmNow({
  who,
  what,
  now,
  uri,
  thought,
  marks,
  onPress,
}: {
  who: string;
  what: string;
  now: string;
  uri?: string;
  thought?: string;
  marks?: ReactNode;
  onPress?: () => void;
}) {
  const styles = useStyles();
  return (
    <FilmPress onPress={onPress} style={styles.nowCard}>
      <View>
        <View style={styles.nowHead}>
          <Text role="badgeSm">{who}</Text>
          <Text role="metaSm" tone="muted" style={styles.grow}>
            {what}
          </Text>
          <View style={styles.nowMark}>
            <LiveDot />
            <Text role="badgeSm">{now}</Text>
          </View>
        </View>
        {uri || thought ? (
          <View style={styles.nowBody}>
            {uri ? (
              <View style={styles.nowShot}>
                <Image source={{ uri }} contentFit="cover" style={styles.nowShotFill} />
              </View>
            ) : null}
            <View style={styles.grow}>
              {thought ? (
                <Text accessibilityLiveRegion="polite" role="bodyXs" tone="paper">
                  {thought}
                </Text>
              ) : null}
              {marks ? <View style={styles.nowMarks}>{marks}</View> : null}
            </View>
          </View>
        ) : null}
      </View>
    </FilmPress>
  );
}
function FilmPress({
  onPress,
  style,
  children,
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [style, pressed && !reduced ? PRESS : null]}
    >
      {children}
    </Pressable>
  );
}
export function stageShare(
  stage:
    | {
        done_count: number;
        total_count: number | null;
      }
    | undefined,
) {
  if (!stage || stage.total_count === null || stage.total_count === 0) return null;
  return stage.done_count / stage.total_count;
}
export function TileOrder({
  label,
  figure,
  note,
}: {
  label: string;
  figure: ReactNode;
  note?: string;
}) {
  const styles = useStyles();
  return (
    <View accessible style={styles.tile}>
      <Text role="meta" tone="muted">
        {label}
      </Text>
      {typeof figure === 'string' ? <Text role="figureTile">{figure}</Text> : figure}
      {note ? <Text role="metaSm">{note}</Text> : null}
    </View>
  );
}
export function TileOrderRow({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.tiles}>{children}</View>;
}
export function FilmBlock({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.block}>
      <Text role="eyebrow" tone="muted" accessibilityRole="header">
        {label}
      </Text>
      {children}
    </View>
  );
}
export function FilmCloseNote({ text }: { text: string }) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.close}>
      <Icon icon={Bell} size={18} color={color.muted} />
      <Text role="meta" style={styles.grow}>
        {text}
      </Text>
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    line: { gap: 8 },
    say: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    name: { flexShrink: 1 },
    at: { flexShrink: 0 },
    grow: { flex: 1, minWidth: 0 },
    stopped: { color: color.dangerText },
    scale: { flexDirection: 'row', gap: 4 },
    bar: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: color.line },
    behind: { backgroundColor: color.spark },
    here: { overflow: 'hidden' },
    share: { height: '100%' },
    stoppedBar: { backgroundColor: color.dangerText },
    list: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 58 },
    stageMark: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: color.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markDone: { backgroundColor: color.spark, borderColor: color.spark },
    markRunning: { borderColor: color.line },
    markFailed: { borderColor: color.dangerText },
    running: { backgroundColor: color.accentNote },
    stageWords: { flex: 1, minWidth: 0, gap: 2 },
    dangerText: { color: color.dangerText },
    tile: {
      flexGrow: 1,
      flexBasis: '46%',
      gap: 3,
      padding: space.s3,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
    tileLabel: {},
    tileFigure: {},
    tileNote: { color: color.faint },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
    nowCard: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: space.s3,
      gap: 10,
    },
    nowHead: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    nowMark: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nowBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    nowShot: {
      width: 72,
      height: 72,
      borderRadius: radius.thumb,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    nowShotFill: { flex: 1 },
    nowMarks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
    close: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: space.s3,
      paddingHorizontal: 14,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
    block: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      paddingHorizontal: 14,
      paddingVertical: space.s3,
      gap: 6,
    },
  }),
);
