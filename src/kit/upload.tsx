import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme } from '@/theme';

import { Progress } from './bits';
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
        {meta ? <Text role="meta">{meta}</Text> : null}
      </View>
      <Progress value={value} label={meta ?? title} />
      {hint ? (
        <Text role="meta" tone="faint">
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
 * picture would.
 */
export function RowStuck({
  name,
  reason,
  uri,
  icon,
  children,
  style,
}: {
  name: string;
  reason: string;
  uri?: string;
  /** Drawn instead of the thumbnail when the file itself is gone. */
  icon?: IconComponent;
  /** The 36 cross, «Убрать из очереди». */
  children?: ReactNode;
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
          {icon ? <Icon icon={icon} size={18} color={color.faint} /> : null}
        </View>
      )}
      <View style={styles.grow}>
        <Text role="row" numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        <Text role="meta" tone="danger">
          {reason}
        </Text>
      </View>
      {children}
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
    stuck: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.dangerEdge,
      backgroundColor: color.surface,
      padding: space.s3,
    },
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
    name: { fontSize: 14 },
  }),
);
