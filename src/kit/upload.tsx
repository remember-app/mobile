import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { Progress } from './bits';
import { IconButton } from './button';
import { Icon, type IconComponent } from './icon';
import { Text } from './text';

/**
 * Spec 7.6 — sending. The block that says how far along it is, and the row for a file that will not
 * go.
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
        <Text role="subtitleDisplay" style={styles.grow}>
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
 * A file that stopped on its way out (spec 7.6). The reason is technical and exact — «Хранилище
 * отказало на части 3 (503)», «Этого файла больше нет на телефоне» — because spec 9 would rather be
 * precise than soothing, and because a person can act on the second one.
 *
 * A file the phone no longer has has no thumbnail to show either, so a glyph square stands where the
 * picture would. The 36 cross at the end lets the file go, its glyph 16 (`UploadQueue`).
 */
export function RowStuck({
  name,
  reason,
  uri,
  icon,
  dropLabel,
  onDrop,
  style,
}: {
  name: string;
  reason: string;
  uri?: string;
  /** Drawn instead of the thumbnail when the file itself is gone. */
  icon?: IconComponent;
  /** «Убрать IMG_4471.HEIC из очереди» — what the cross is called out as. */
  dropLabel: string;
  onDrop: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.stuck, style]}>
      {uri ? (
        <Image source={{ uri }} contentFit="cover" style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbGone]}>
          {icon ? <Icon icon={icon} size={20} color={color.faint} /> : null}
        </View>
      )}
      <View style={styles.words}>
        <Text role="rowSm" numberOfLines={1}>
          {name}
        </Text>
        <Text role="meta" tone="danger">
          {reason}
        </Text>
      </View>
      <IconButton
        icon={X}
        size={height.roundRow}
        glyph={{ size: 16 }}
        label={dropLabel}
        onPress={onDrop}
      />
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
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    grow: { flex: 1, minWidth: 0 },
    // Spec 7.7, detail 51: 12 above and below, 14 at the sides.
    stuck: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.dangerEdge,
      backgroundColor: color.surface,
      paddingVertical: space.s3,
      paddingHorizontal: 14,
    },
    // The name and its reason 3 apart (`UploadQueue`).
    words: { flex: 1, minWidth: 0, gap: 3 },
    // The picture is pulled back to 60%: it is the reason that has to be read, not the frame.
    thumb: {
      width: 44,
      height: 44,
      borderRadius: radius.queue,
      backgroundColor: color.raise,
      opacity: 0.6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbGone: { opacity: 1 },
  }),
);
