import { Image } from 'expo-image';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pause,
  PawPrint,
  User,
  X,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { height, radius, space, themed, useTheme } from '@/theme';
import { Divider, LiveDot, Progress, Shares, SparkMark } from './bits';
import { BlockHead } from './block-head';
import { BackButton, Button, IconButton } from './button';
import { Spinner } from './empty';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Avatar } from './member';
import { Text } from './text';
export function BlockJournal({
  label,
  children,
  style,
}: {
  label?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.block, style]}>
      {label ? (
        <Text role="eyebrow" tone="muted" accessibilityRole="header">
          {label}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
export function SummaryJournal({
  what,
  time,
  count,
  tiles,
  children,
}: {
  what: string;
  time?: string;
  count?: {
    figure: string;
    of: string;
    word: string;
    share: number;
  } | null;
  tiles?: readonly {
    figure: string;
    label: string;
  }[];
  children?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <BlockJournal>
      <View style={styles.say}>
        <Text role="row" style={styles.what}>
          {what}
        </Text>
        {time ? (
          <Text role="metaSm" tone="muted" style={styles.time}>
            {time}
          </Text>
        ) : null}
      </View>
      {count ? (
        <View style={styles.counted}>
          <Text role="figureTile">
            {count.figure}
            <Text role="figureTile" tone="muted">
              {` из ${count.of}`}
            </Text>
          </Text>
          <Text role="metaSm" tone="muted">
            {count.word}
          </Text>
          <Progress value={count.share} tone="spark" label={count.word} style={styles.bar} />
        </View>
      ) : null}
      {tiles?.length ? (
        <Shares>
          {tiles.map((tile) => (
            <View key={tile.label} accessible style={styles.tile}>
              <Text role="figureTile">{tile.figure}</Text>
              <Text role="metaSm" tone="muted">
                {tile.label}
              </Text>
            </View>
          ))}
        </Shares>
      ) : null}
      {children}
    </BlockJournal>
  );
}
export function CountPair({
  label,
  done,
  of,
  share,
}: {
  label: string;
  done: number;
  of: number;
  share: number;
}) {
  const styles = useStyles();
  return (
    <View style={styles.pair}>
      <View style={styles.say}>
        <Text role="metaSm" tone="muted" style={styles.grow}>
          {label}
        </Text>
        <Text role="metaSm">{`${done} из ${of}`}</Text>
      </View>
      <Progress value={share} tone="spark" label={label} />
    </View>
  );
}
export function RowShare({
  name,
  count,
  share,
  uri,
}: {
  name: string;
  count: number;
  share: number;
  uri?: string | null;
}) {
  const styles = useStyles();
  return (
    <View style={styles.bringer}>
      <Avatar name={name} size={38} uri={uri} />
      <Progress value={share} tone="accent" label={name} style={styles.grow} />
      <Text role="metaSm" tone="muted" style={styles.tally}>
        {String(count)}
      </Text>
    </View>
  );
}
export function ThoughtJournal({
  label,
  now,
  said,
  unsaid,
}: {
  label: string;
  now?: string;
  said: string;
  unsaid?: string;
}) {
  const styles = useStyles();
  const typing = now !== undefined && unsaid !== undefined && unsaid !== '';
  return (
    <BlockJournal>
      <View style={styles.say}>
        <SparkMark />
        <Text role="eyebrow" tone="paper">
          {label}
        </Text>
        {now ? (
          <View style={styles.grow}>
            <LiveDot />
            <Text role="eyebrow">{now}</Text>
          </View>
        ) : null}
      </View>
      <Text role="log">
        {said}
        <Text style={styles.unsaid}>{unsaid}</Text>
        {typing ? <View style={styles.cursor} /> : null}
      </Text>
    </BlockJournal>
  );
}
export function PartJournal({
  label,
  building,
  title,
  line,
  more,
  onPress,
  children,
}: {
  label: string;
  building?: string;
  title: string;
  line: string;
  more?: number;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const body = (
    <BlockJournal>
      <BlockHead label={label}>
        {building ? <Text role="eyebrow">{` · ${building}`}</Text> : null}
      </BlockHead>
      <View style={styles.say}>
        <Text role="rowSm" style={styles.grow}>
          {title}
        </Text>
        {more === undefined ? null : (
          <View style={styles.more}>
            <Text role="metaSm" tone="muted">{`+${more}`}</Text>
          </View>
        )}
      </View>
      <Text role="metaSm" tone="muted">
        {line}
      </Text>
    </BlockJournal>
  );
  return (
    <View>
      {onPress && children ? (
        <Press onPress={onPress} label={title}>
          {body}
        </Press>
      ) : (
        body
      )}
      {children}
    </View>
  );
}
export function RowFrame({
  uri,
  length,
  source,
  text,
  marks,
  dim,
  onPress,
  label,
}: {
  uri?: string;
  length?: string;
  source?: string;
  text?: string;
  marks?: ReactNode;
  dim?: boolean;
  onPress?: () => void;
  label?: string;
}) {
  const styles = useStyles();
  return (
    <Press onPress={onPress} label={label}>
      <View style={[styles.frame, dim ? styles.dim : null]}>
        <View style={styles.shot}>
          {uri ? <Image source={{ uri }} contentFit="cover" style={styles.fill} /> : null}
          {length ? (
            <Text role="runtimeXs" style={styles.length}>
              {length}
            </Text>
          ) : null}
        </View>
        <View style={styles.grow}>
          {source ? (
            <Text role="metaSm" tone="muted">
              {source}
            </Text>
          ) : null}
          {text ? <Text role="log">{text}</Text> : null}
          {marks ? <View style={styles.marks}>{marks}</View> : null}
        </View>
      </View>
    </Press>
  );
}
export function TapeCuts({
  cuts,
}: {
  cuts: readonly {
    at: number;
    share: number;
  }[];
}) {
  const styles = useStyles();
  return (
    <View style={styles.tape}>
      {cuts.map((cut, i) => (
        <View key={`${cut.at}-${i}`} style={[styles.tick, { left: `${cut.share * 100}%` }]} />
      ))}
    </View>
  );
}
export function PartSound({
  title,
  line,
  shares,
  why,
  now,
}: {
  title: string;
  line?: string;
  shares?: readonly {
    label: string;
    share: number;
  }[];
  why?: string;
  now?: boolean;
}) {
  const styles = useStyles();
  return (
    <BlockJournal>
      <BlockHead label={title}>{now ? <LiveDot /> : null}</BlockHead>
      {line ? (
        <Text role="metaSm" tone="muted">
          {line}
        </Text>
      ) : null}
      {shares?.map((one) => (
        <View key={one.label} style={styles.pair}>
          <View style={styles.say}>
            <Text role="metaSm" tone="muted" style={styles.grow}>
              {one.label}
            </Text>
            <Text role="metaSm">{`${Math.round(one.share * 100)}%`}</Text>
          </View>
          <Progress value={one.share} tone="spark" label={one.label} />
        </View>
      ))}
      {why ? (
        <Text role="note" tone="muted">
          {why}
        </Text>
      ) : null}
    </BlockJournal>
  );
}
export function RowStep({
  at,
  label,
  state,
}: {
  at: number;
  label: string;
  state: 'pending' | 'running' | 'done';
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.say}>
      <View style={[styles.stepMark, state === 'done' ? styles.stepDone : null]}>
        {state === 'done' ? (
          <Icon icon={Check} size={14} stroke={3} color={color.sparkInk} />
        ) : state === 'running' ? (
          <Spinner size={16} ring={2} track={color.line} head={color.accent} />
        ) : (
          <Text role="metaTile" tone="faint">
            {String(at)}
          </Text>
        )}
      </View>
      <Text role="rowSm" tone={state === 'pending' ? 'muted' : undefined} style={styles.grow}>
        {label}
      </Text>
    </View>
  );
}
export function CardFrame({
  uri,
  title,
  meta,
  words,
  what,
  fields,
  marks,
  people,
  moments,
  comments,
  fold,
  onClose,
  close,
}: {
  uri?: string;
  title: string;
  meta?: string;
  words: {
    what: string;
    who: string;
    moments: string;
    comments: string;
  };
  what?: string;
  fields?: readonly {
    label: string;
    value: string;
  }[];
  marks?: readonly {
    label: string;
    person: boolean;
  }[];
  people?: string;
  moments?: readonly {
    seconds: string;
    text: string;
  }[];
  comments?: string;
  fold?: string;
  onClose?: () => void;
  close?: string;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <BlockJournal>
      <View style={styles.say}>
        <View style={styles.shotBig}>
          {uri ? <Image source={{ uri }} contentFit="cover" style={styles.fill} /> : null}
        </View>
        <View style={styles.grow}>
          <Text role="row">{title}</Text>
          {meta ? (
            <Text role="metaSm" tone="muted">
              {meta}
            </Text>
          ) : null}
        </View>
        {onClose && close ? (
          <IconButton icon={X} label={close} size={height.roundRow} onPress={onClose} />
        ) : null}
      </View>

      {what ? (
        <View style={styles.wide}>
          <Text role="eyebrow" tone="muted">
            {words.what}
          </Text>
          <Text role="bodySm">{what}</Text>
        </View>
      ) : null}

      {marks ? (
        <View style={styles.wide}>
          <BlockHead label={words.who}>
            {people ? (
              <Text role="metaSm" tone="muted">
                {people}
              </Text>
            ) : null}
          </BlockHead>
          <View style={styles.marks}>
            {marks.map((mark) => (
              <View key={mark.label} style={styles.mark}>
                <Icon icon={mark.person ? User : PawPrint} size={12} color={color.muted} />
                <Text role="metaSm">{mark.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {fields?.map((field) => (
        <View key={field.label} style={styles.field}>
          <Text role="eyebrow" tone="muted">
            {field.label}
          </Text>
          <Text role="bodySm">{field.value}</Text>
        </View>
      ))}

      {moments?.length ? (
        <View style={styles.wide}>
          <Text role="eyebrow" tone="muted">
            {words.moments}
          </Text>
          {moments.map((moment) => (
            <View key={moment.seconds} style={styles.moment}>
              <Text role="metaSm" tone="spark">
                {moment.seconds}
              </Text>
              <Text role="metaSm" tone="muted" style={styles.grow}>
                {moment.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {comments !== undefined ? (
        <View style={styles.wide}>
          <Text role="eyebrow" tone="muted">
            {words.comments}
          </Text>
          <Text role="metaSm" tone="muted">
            {comments}
          </Text>
        </View>
      ) : null}

      {fold ? (
        <>
          <Divider soft />
          <Text role="rowSm">{fold}</Text>
        </>
      ) : null}
    </BlockJournal>
  );
}
export function StageNotice({
  title,
  text,
  stopped,
  action,
  onAction,
}: {
  title: string;
  text: string;
  stopped?: boolean;
  action?: string;
  onAction?: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <BlockJournal>
      <View style={styles.notice}>
        <View style={[styles.noticeSign, stopped ? styles.noticeStopped : null]}>
          <Icon
            icon={stopped ? Pause : Clock}
            size={22}
            color={stopped ? color.dangerText : color.muted}
          />
        </View>
        <Text role="titleSm" accessibilityRole="header" style={styles.centred}>
          {title}
        </Text>
        <Text role="body" tone={stopped ? undefined : 'muted'} style={styles.centred}>
          {text}
        </Text>
        {action && onAction ? (
          <Button size="xs" wide={false} label={action} onPress={onAction} />
        ) : null}
      </View>
    </BlockJournal>
  );
}
export function StagePager({
  before,
  after,
  toFilm,
  onBefore,
  onAfter,
  onFilm,
}: {
  before?: string;
  after?: string;
  toFilm?: string;
  onBefore?: () => void;
  onAfter?: () => void;
  onFilm?: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const cell = (
    label: string | undefined,
    onPress: (() => void) | undefined,
    icon: typeof ChevronLeft,
    toEnd: boolean,
  ) => {
    if (!label) return <View style={styles.pagerCell} />;
    return (
      <Press onPress={onPress} label={label} style={styles.pagerCell}>
        <View style={[styles.pagerRow, toEnd ? styles.pagerEnd : null]}>
          {toEnd ? null : <Icon icon={icon} size={17} stroke={2} color={color.paper} />}
          <Text role="rowSm" numberOfLines={1}>
            {label}
          </Text>
          {toEnd ? <Icon icon={icon} size={17} stroke={2} color={color.paper} /> : null}
        </View>
      </Press>
    );
  };
  return (
    <View style={styles.pager}>
      {cell(before, onBefore, ChevronLeft, false)}
      {cell(after ?? toFilm, onAfter ?? onFilm, ChevronRight, true)}
    </View>
  );
}
function Press({
  onPress,
  label,
  style,
  children,
}: {
  onPress?: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const ring = useFocusRing();
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [style, pressed && !reduced ? PRESS : null, focused ? ring : null]}
    >
      {children}
    </Pressable>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    block: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: 14,
      gap: space.s3,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    headWords: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flex: 1, minWidth: 0 },
    headStage: { flexShrink: 0 },
    say: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    what: { flexShrink: 1 },
    time: { flexShrink: 0 },
    grow: { flex: 1, minWidth: 0 },
    counted: { gap: 4 },
    bar: { marginTop: 4 },
    tile: { flexGrow: 1, gap: 2 },
    centred: { textAlign: 'center' },
    fill: { flex: 1 },
    pair: { flex: 1, gap: 6 },
    bringer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    tally: { width: 32, textAlign: 'right' },
    unsaid: { color: 'transparent' },
    cursor: { width: 2, height: 15, marginLeft: 2, backgroundColor: color.spark },
    more: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: color.raise,
    },
    frame: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    shot: {
      width: 44,
      height: 44,
      borderRadius: radius.thumb,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    shotBig: {
      width: 56,
      height: 56,
      borderRadius: radius.thumb,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    length: { position: 'absolute', right: 3, bottom: 3 },
    dim: { opacity: 0.5 },
    marks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
    tape: { height: 6, borderRadius: radius.pill, backgroundColor: color.line, overflow: 'hidden' },
    tick: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: color.paper },
    stepMark: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDone: { backgroundColor: color.spark },
    wide: { gap: 6 },
    field: { gap: 3, backgroundColor: color.raise, borderRadius: radius.thumb, padding: 9 },
    mark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: color.line,
    },
    moment: { flexDirection: 'row', gap: 10, alignItems: 'baseline' },
    notice: { alignItems: 'center', gap: space.s3, paddingVertical: space.s3 },
    noticeSign: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: color.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noticeStopped: { borderStyle: 'solid', backgroundColor: color.dangerTextSoft },
    pager: { flexDirection: 'row', gap: space.s2 },
    pagerCell: {
      flex: 1,
      minWidth: 0,
      minHeight: height.quietSheet,
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.lineStrong,
      backgroundColor: color.surface,
      paddingHorizontal: 14,
    },
    pagerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pagerEnd: { justifyContent: 'flex-end' },
  }),
);
export function StageHead({
  name,
  stageOf,
  onFilm,
  label,
}: {
  name: string;
  stageOf: string;
  onFilm: () => void;
  label: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.head}>
      <BackButton label={label} onPress={onFilm} />
      <View style={styles.headWords}>
        <Text role="stageName">{name}</Text>
        <Text role="metaSm" tone="muted" style={styles.headStage}>
          {stageOf}
        </Text>
      </View>
    </View>
  );
}
