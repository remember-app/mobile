import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { space, themed } from '@/theme';

import { Divider } from './bits';
import { Avatar } from './member';
import { Text } from './text';

/**
 * Spec 7.7 — the heading over a group of frames: a label, a hairline stretching across the gap, and
 * on the right either a count or a button. Four kinds, and they differ only in what stands at the
 * two ends:
 *
 * - **a day and a count** — «14 сентября» / «174 кадра»;
 * - **a day and «Выбрать все N»** — only in picking mode and in the phone's own gallery;
 * - **a person** — their circle at 26, ringed in `spark` if they are the organizer, and «112 фото»;
 * - **a day under limited access** — a count of the shape «3 из 61», in `faint`, because the rest is
 *   not missing, it is unseen.
 */
export function DayMark({
  label,
  count,
  avatar,
  organizer,
  limited,
  children,
  style,
}: {
  label: string;
  /** The count on the right — «174 кадра», «112 фото», «3 из 61». */
  count?: string;
  /** A person's name: the heading then carries their circle in front of the label. */
  avatar?: string;
  organizer?: boolean;
  /** The count is about what the phone will not show, so it is drawn back rather than forward. */
  limited?: boolean;
  /** «Выбрать все 61» — a small button, which stands instead of the count. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.mark, style]}>
      {avatar ? <Avatar name={avatar} size={26} ring={organizer} /> : null}
      <Text role="label" accessibilityRole="header" numberOfLines={1}>
        {label}
      </Text>
      <Divider grow />
      {count ? (
        <Text role="meta" tone={limited ? 'faint' : 'muted'}>
          {count}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    mark: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: space.s2,
    },
  }),
);
