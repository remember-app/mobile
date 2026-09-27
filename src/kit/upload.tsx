import { ChevronDown, TriangleAlert, X } from 'lucide-react-native';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { Divider, Progress } from './bits';
import { Button, IconButton } from './button';
import { Icon } from './icon';
import { useFocusRing, useHoverFocus } from './interaction';
import { Text } from './text';

/**
 * Spec 7.6 — sending. The block that says how far along it is, the same thing said as one line over
 * somebody's own feed, and the block for the files that will not go.
 */

/**
 * The sending block: what is going, how much of it is left, the bar, and the line underneath saying
 * the phone can be put away. Every word comes from the screen — this only sets the ritual.
 *
 * Paused is not a state of its own here: the bar simply stops where it is and `hint` says why
 * («Продолжим, когда появится связь»). A bar that went backwards, or a block that vanished when the
 * signal did, would both be lying about what is on the disk.
 */
export function Upload({
  title,
  meta,
  value,
  hint,
  style,
}: {
  /** «Отправляем» — and while it is paused, still «Отправляем»: the queue did not go anywhere. */
  title: string;
  /** «Осталось 9 файлов». */
  meta?: string;
  /** 0…1 */
  value: number;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.upload, style]}>
      <View style={styles.head}>
        <Text role="subtitleDisplay" style={styles.lead}>
          {title}
        </Text>
        {/* Spec detail 48: «Осталось 9 файлов» 13 / 600 `muted` — not the meta's 12 / 500. */}
        {meta ? (
          <Text role="label" tone="muted">
            {meta}
          </Text>
        ) : null}
      </View>
      <Progress value={value} label={meta ?? title} />
      {/* 12 / 400 / 16 `muted` (spec 7.6, detail 48 and 10.1; `UploadQueue`): at the meta's 500 the
          line ran 3 past the block's 324 and broke in two. */}
      {hint ? (
        <Text role="noteSm" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Spec detail 48, «строка отправки» (`MyFrames`): the same sending said as one line over one's own
 * feed, and the whole line is the way into `UploadQueue`. «Отправляем» and what is left over the
 * bar, and under it the line of what did not go with «Разобрать» at its end. With nothing going up
 * the top floor and the bar go and the line of failures stays alone; with nothing failed that line
 * is simply not there.
 */
export function UploadLine({
  title,
  meta,
  value = 0,
  failed,
  action,
  label,
  onPress,
  style,
}: {
  /** «Отправляем» — left off while nothing is going up. */
  title?: string;
  /** «осталось 9». */
  meta?: string;
  /** 0…1 */
  value?: number;
  /** «5 файлов не ушли». */
  failed?: string;
  /** «Разобрать». */
  action: string;
  /** The whole line read out: «Отправляем, осталось 9, 5 файлов не ушли. Разобрать». */
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const { focused, props } = useHoverFocus();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      {...props}
      style={[styles.line, focused ? focusRing : null, style]}
    >
      {title ? (
        <>
          <View style={styles.lineTop}>
            <Text role="row" style={styles.lead}>
              {title}
            </Text>
            {meta ? (
              <Text role="timecode" tone="muted">
                {meta}
              </Text>
            ) : null}
          </View>
          <Progress value={value} />
        </>
      ) : null}
      {failed ? (
        <View style={styles.lineFailed}>
          <Icon icon={TriangleAlert} size={14} stroke={1.9} color={color.dangerText} />
          <Text role="meta" tone="danger" style={styles.lead}>
            {failed}
          </Text>
          <Text role="timecode" tone="muted">
            {action}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** One file that did not go, in `BlockStuck`. */
export type StuckLine = {
  key: string;
  /** «IMG_4471.HEIC». */
  name: string;
  /** «Хранилище отказало (503)», «Больше нет на этом телефоне». */
  reason: string;
  /** «Убрать IMG_4471.HEIC из очереди» — what the cross is called out as. */
  dropLabel: string;
  onDrop: () => void;
};

/** How many of the files stand open before the rest fold away (spec detail 78). */
const SHOWN = 2;

/**
 * Spec detail 78 — every file that did not go, in one block (`UploadQueue`). The next failure is
 * not a new block: the number in the head changes and a line is added. The head carries the count
 * and «Ещё раз», which sends every file of the block again.
 *
 * A line to a file (detail 51): its name, cut short, and why it stopped, which wraps — it is the
 * part a person acts on. The freshest two stand open; the rest are folded behind «Ещё 3 файла»,
 * which opens them where they stand, so a sudden run of failures never pushes the grid under it
 * off the screen. Whether the fold is open is the screen's to hold.
 */
export function BlockStuck({
  title,
  retry,
  lines,
  open,
  onToggle,
  more,
  less,
  style,
}: {
  /** «Не ушли 5 файлов». */
  title: string;
  /** «Ещё раз» — every file of the block, again. */
  retry: { label: string; onPress: () => void };
  /** The freshest first. */
  lines: readonly StuckLine[];
  /** Whether the folded lines are shown. */
  open: boolean;
  onToggle: () => void;
  /** «Ещё 3 файла» — how many are folded away. */
  more: string;
  /** «Свернуть». */
  less: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const folds = lines.length > SHOWN;
  const shown = folds && !open ? lines.slice(0, SHOWN) : lines;

  return (
    <View accessibilityLabel={title} style={[styles.stuck, style]}>
      <View style={styles.stuckHead}>
        <Icon icon={TriangleAlert} size={18} stroke={1.9} color={color.dangerText} />
        <Text role="row" style={styles.lead}>
          {title}
        </Text>
        <Button
          variant="secondary"
          size="xxs"
          wide={false}
          label={retry.label}
          onPress={retry.onPress}
        />
      </View>
      <Divider style={styles.stuckRule} />
      {shown.map((line, index) => (
        <View key={line.key}>
          {index > 0 ? <Divider soft /> : null}
          <View style={styles.file}>
            <View style={styles.words}>
              <Text role="rowSm" numberOfLines={1}>
                {line.name}
              </Text>
              <Text role="meta" tone="danger">
                {line.reason}
              </Text>
            </View>
            <IconButton
              icon={X}
              size={height.roundRow}
              glyph={{ size: 15, stroke: 2 }}
              tint={color.faint}
              label={line.dropLabel}
              onPress={line.onDrop}
              style={styles.drop}
            />
          </View>
        </View>
      ))}
      {folds ? (
        <>
          <Divider />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={onToggle}
            style={styles.fold}
          >
            <Text role="label" tone="muted">
              {open ? less : more}
            </Text>
            <View style={open ? styles.flipped : null}>
              <Icon icon={ChevronDown} size={15} stroke={2} color={color.muted} />
            </View>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    upload: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: space.s4,
      gap: space.s3,
    },
    // «Осталось 9 файлов» goes under «Отправляем» once the two no longer share a line, rather than
    // squeeze it a letter at a time: the title is as wide as its word and the rest of the line.
    head: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: space.s3,
      rowGap: space.s1,
    },
    lead: { flexGrow: 1, flexShrink: 1 },
    // Spec detail 48, the line: 13 / 16 inside, 9 between its floors.
    line: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      paddingVertical: 13,
      paddingHorizontal: space.s4,
      gap: 9,
    },
    lineTop: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      columnGap: space.s3,
    },
    lineFailed: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    // Spec detail 78: 14 / 16 inside, the whole width of the column.
    stuck: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.dangerEdge,
      backgroundColor: color.surface,
      paddingVertical: 14,
      paddingHorizontal: space.s4,
    },
    stuckHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    stuckRule: { marginTop: space.s3 },
    // Spec detail 51: 9 over and under, 10 between the words and the cross.
    file: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
    words: { flex: 1, minWidth: 0, gap: 2 },
    drop: { marginRight: -6 },
    fold: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: -6,
    },
    flipped: { transform: [{ rotate: '180deg' }] },
  }),
);
