import { Check, WifiOff } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { Text } from './text';

/**
 * Spec 7.6 — the three surfaces that carry a sentence rather than a thing: a message with something
 * to do about it, a hint that explains itself once, and the banner that says where the connection
 * stands.
 */

/**
 * The message card (spec 7.6): a 52 icon square, a paragraph, and the action the paragraph is about,
 * full width under it. It stands in the flow of the screen and not over it — «Remember не видит вашу
 * галерею» is something to answer, not something to dismiss.
 */
export function CardMessage({
  icon,
  text,
  children,
  style,
}: {
  icon?: IconComponent;
  text: string;
  /** The button. A message card without one is a paragraph, and a paragraph is not a card. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.message, style]}>
      {icon ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.square}
        >
          <Icon icon={icon} size={24} color={color.muted} />
        </View>
      ) : null}
      <Text role="body" tone="muted">
        {text}
      </Text>
      {children}
    </View>
  );
}

/**
 * The hint plate (spec 7.6): a glyph, one quiet line, and — in the version that has one — a small
 * button under it. `spark` when the hint is about people, muted when it is about anything else;
 * spec 1.2 keeps `spark` for the organizer, «готово» and progress, and inviting people is the first
 * of those.
 */
export function HintNote({
  icon,
  tone = 'muted',
  text,
  children,
  style,
}: {
  icon?: IconComponent;
  tone?: 'spark' | 'muted';
  text: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.note, style]}>
      <View style={styles.noteLine}>
        {icon ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.noteIcon}
          >
            <Icon icon={icon} size={18} color={tone === 'spark' ? color.spark : color.muted} />
          </View>
        ) : null}
        <Text role="note" style={styles.grow}>
          {text}
        </Text>
      </View>
      {children}
    </View>
  );
}

/**
 * The connection banner (spec 7.6). Two tones and they behave differently on purpose:
 *
 * - `error` — the connection is gone. It carries a way to put it away, because it will be there for
 *   as long as the connection is not;
 * - `done` — the connection is back. No button at all: it leaves by itself after three seconds, and
 *   a button on something that is already going is a button nobody will reach.
 *
 * It stands at the top of the body and pushes the content down rather than lying over it: the
 * connection is a line at the top of the screen, never a replacement for what is on it.
 */
export type BannerTone = 'error' | 'done';

export function Banner({
  text,
  tone = 'error',
  icon,
  children,
  style,
}: {
  text: string;
  tone?: BannerTone;
  /** An override where the banner is not about the connection at all. */
  icon?: IconComponent;
  /** «Скрыть сообщение» — the 32 round button, on the `error` tone alone. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const done = tone === 'done';

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, done ? styles.bannerDone : styles.bannerError, style]}
    >
      {done ? (
        <View style={styles.tick}>
          <Icon icon={Check} size={13} color={color.sparkInk} />
        </View>
      ) : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon icon={icon ?? WifiOff} size={18} color={color.dangerText} />
        </View>
      )}
      <Text role="label" style={styles.grow}>
        {text}
      </Text>
      {done ? null : children}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    message: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: space.s5,
      gap: space.s3,
    },
    square: {
      width: 52,
      height: 52,
      borderRadius: radius.cell,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    note: {
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      paddingVertical: 14,
      paddingHorizontal: space.s4,
      gap: space.s3,
    },
    noteLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
    // The glyph sits on the first line of the words rather than in the middle of the block.
    noteIcon: { paddingTop: 1 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      borderRadius: radius.cell,
      borderWidth: 1,
      paddingVertical: space.s3,
      paddingHorizontal: space.s4,
    },
    bannerError: { backgroundColor: color.dangerSoft, borderColor: color.dangerEdge },
    bannerDone: { backgroundColor: color.sparkSoft, borderColor: color.sparkEdge },
    tick: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grow: { flex: 1, minWidth: 0 },
  }),
);
