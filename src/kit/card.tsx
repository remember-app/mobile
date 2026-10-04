import { Check, WifiOff, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { font, height, radius, space, themed, useTheme } from '@/theme';

import { Button, IconButton } from './button';
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
          {/* Spec detail 45: the sign 24 in `paper` (sw 1.7), on the `raise` square. */}
          <Icon icon={icon} size={24} stroke={1.7} color={color.paper} />
        </View>
      ) : null}
      {/* Spec 7.6, detail 45: the paragraph 15 / 22 — three lines in `UploadAccess`, not four. */}
      <Text role="bodySm" tone="muted">
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
 *
 * The button is the plate's to draw, the way «Отмена» is the wizard bar's: detail 46 names it — a 40
 * in a row, ringed in `lineStrong`, 13 / 600 — and gives it 16 a side where every other one in a row
 * has 14 (spec 7.2; `UploadLimited.json` e8: «Отдать ещё» 108.34 — the hairline, 16 and the words).
 */
export function HintNote({
  icon,
  tone = 'muted',
  text,
  action,
  style,
}: {
  icon?: IconComponent;
  tone?: 'spark' | 'muted';
  text: string;
  /** «Отдать ещё» — its words and what it does. */
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  // The button stands under the words and not under the glyph (`UploadLimited`: «Отдать ещё» at 64,
  // the words' own edge) — it belongs to what they say.
  return (
    <View style={[styles.note, style]}>
      {icon ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.noteIcon}
        >
          {/* Spec detail 46: 19 at 1.8. */}
          <Icon
            icon={icon}
            size={19}
            stroke={1.8}
            color={tone === 'spark' ? color.spark : color.muted}
          />
        </View>
      ) : null}
      <View style={styles.noteWords}>
        <Text role="note">{text}</Text>
        {action ? (
          <Button
            size="xs"
            wide={false}
            label={action.label}
            onPress={action.onPress}
            style={styles.noteAction}
          />
        ) : null}
      </View>
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

/**
 * The words of a refusal, held so they cannot be read off a failure and handed to `Banner` as its
 * `text`. A branded `string` would not do: it is still a string, and a string is exactly what
 * `text` takes — so the sign would stay droppable. This is opaque instead, and `Banner` is what
 * unwraps it, which is what makes a refusal reachable only as a whole (TASK-275).
 */
const said: unique symbol = Symbol('said');
export type Said = { readonly [said]: string };

/**
 * A refused call as a banner says it: the words, and the sign beside them — one value, so a screen
 * cannot hand over half of it. No sign is the banner's own «no signal», which only a request that
 * never got an answer has earned (see `@/lib/failure`).
 */
export type Failure = { text: Said; icon?: IconComponent };

/** The words of a refusal, from wherever they were written. The one way to make a `Said`. */
export const saying = (text: string): Said => ({ [said]: text });

/** What a `Said` says. The banner and its tests; a screen has no reason to. */
export const read = (these: Said): string => these[said];

export function Banner({
  text,
  tone = 'error',
  icon,
  failure,
  hide,
  children,
  style,
}: {
  /**
   * What the banner says where it is not a refused call: a link is back, a save went through, a
   * counter. A refusal is not said here — it is said as a whole, in `failure`.
   */
  text?: string;
  tone?: BannerTone;
  /** An override where the banner is not about the connection at all. */
  icon?: IconComponent;
  /**
   * A refused call, whole — the words and the sign its reason chose, in one prop. The only way to
   * say one: the words alone are not a string a screen may pass, so a banner about a refusal
   * cannot be put together with the sign left off.
   */
  failure?: Failure;
  /**
   * «Скрыть сообщение» — the cross the banner draws itself, on the `error` tone alone (spec 7.6,
   * detail 47): a 32 with its sign at 15 / 2.2, 13 in from the right edge.
   */
  hide?: { label: string; onPress: () => void };
  /** What else the words call for — «Повторить». */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const done = tone === 'done';
  const words = failure ? read(failure.text) : (text ?? '');
  const sign = failure ? failure.icon : icon;

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
          <Icon icon={sign ?? WifiOff} size={19} color={color.dangerText} />
        </View>
      )}
      <Text role="banner" style={[styles.grow, done ? styles.firm : null]}>
        {words}
      </Text>
      {done ? null : children}
      {done || !hide ? null : (
        <IconButton
          icon={X}
          label={hide.label}
          size={height.roundTiny}
          tone="danger"
          glyph={CROSS}
          onPress={hide.onPress}
        />
      )}
    </View>
  );
}

/** The banner's cross (spec 7.6, detail 47; `HomeOffline.json` e7): 15 at 2.2 in its 32. */
const CROSS = { size: 15, stroke: 2.2 } as const;

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    message: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: space.s5,
      // `UploadAccess`: 16 from the square to the paragraph and from the paragraph to the button.
      gap: space.s4,
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
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.s3,
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      paddingVertical: 14,
      paddingHorizontal: space.s4,
    },
    noteWords: { flex: 1, minWidth: 0, gap: space.s3 },
    // Under the words and from their edge, as wide as its own words with detail 46's 16 a side.
    noteAction: { alignSelf: 'flex-start', paddingHorizontal: space.s4 },
    // The glyph sits on the first line of the words rather than in the middle of the block.
    noteIcon: { paddingTop: 1 },
    // A «Повторить» handed in wraps under the words on the largest type instead of past the edge.
    banner: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s3,
      borderRadius: radius.cell,
      borderWidth: 1,
      paddingLeft: space.s4,
    },
    // Spec 7.6, detail 47 — «поля 12–13 / 16», as the layout splits them: the error closes to 12 on
    // the right, where its cross stands; the `done` one has no cross and a 22 circle, and takes 13.
    // Spec 2: one red for the banner wherever it stands, `.12` under `.40`.
    bannerError: {
      backgroundColor: color.bannerSoft,
      borderColor: color.bannerEdge,
      paddingVertical: space.s3,
      paddingRight: space.s3,
    },
    bannerDone: {
      backgroundColor: color.sparkSoft,
      borderColor: color.sparkEdge,
      paddingVertical: 13,
      paddingRight: space.s4,
    },
    // «Соединение установлено» is said at 600, the lost connection at the role's 500.
    firm: { fontFamily: font.semi },
    tick: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // The words keep at least half the row: a «Повторить» handed in goes under them rather than
    // squeeze them to a letter a line on large type (TASK-377).
    grow: { flex: 1, minWidth: '50%' },
  }),
);
