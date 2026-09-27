import { X } from 'lucide-react-native';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { height, radius, space, themed } from '@/theme';

import { Divider, Progress } from './bits';
import { IconButton } from './button';
import { Text } from './text';

/**
 * Spec 7.6 — sending. The block that says how far along it is, and the block for the files that
 * will not go.
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

/** One reason files stopped for, in `BlockStuck`. */
export type StuckLine = {
  key: string;
  /** «3 файла». */
  count: string;
  /** «Связь с хранилищем оборвалась». */
  reason: string;
  /** «Убрать 3 файла из очереди» — what the cross is called out as. */
  dropLabel: string;
  onDrop: () => void;
};

/**
 * The files that stopped on their way out (spec 7.6), in one block and not a card each: ten files
 * that did not go are one thing gone wrong in a few ways, and ten red cards said it ten times
 * (TASK-417). A line to every reason — how many, and why — and the 36 cross at its end, glyph 16,
 * that lets all of them go (`UploadQueue`).
 *
 * The reason is technical and exact — «Хранилище отказало (503)», «Больше нет на этом телефоне» —
 * because spec 9 would rather be precise than soothing, and because a person can act on the second
 * one. Each line keeps detail 51's measure: 12 above and below, 14 at the sides, the count 3 over
 * its reason; a soft hairline between two, as inside any list.
 */
export function BlockStuck({
  lines,
  style,
}: {
  lines: readonly StuckLine[];
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.stuck, style]}>
      {lines.map((line, index) => (
        <View key={line.key}>
          {index > 0 ? <Divider soft /> : null}
          <View style={styles.line}>
            <View style={styles.words}>
              <Text role="rowSm">{line.count}</Text>
              <Text role="meta" tone="danger">
                {line.reason}
              </Text>
            </View>
            <IconButton
              icon={X}
              size={height.roundRow}
              glyph={{ size: 16 }}
              label={line.dropLabel}
              onPress={line.onDrop}
            />
          </View>
        </View>
      ))}
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
    lead: { flexGrow: 1 },
    // Spec 7.7, detail 51: 12 above and below, 14 at the sides.
    stuck: {
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.dangerEdge,
      backgroundColor: color.surface,
      paddingHorizontal: 14,
    },
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: space.s3,
    },
    // The count and its reason 3 apart (`UploadQueue`).
    words: { flex: 1, minWidth: 0, gap: 3 },
  }),
);
