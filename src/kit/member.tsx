import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { faceOf, font, height, radius, space, themed, useTheme } from '@/theme';

import { Divider, LiveDot } from './bits';
import { Text } from './text';

/**
 * Spec 7.5 — people. Three parts: the circle that stands for someone, the row they occupy inside a
 * memory, and the row they occupy in the address book. None of them knows a word: a name, a
 * username and a standing all arrive as text.
 */

/**
 * The sizes the layout draws an avatar at, each with the type size that goes inside it (spec 7.5):
 * 16 in a day gap, 18 on a frame on air, 24 in a stack, 30 in a filter chip, 32 in a sheet, 34 in a
 * section row, 38 in a member row, 42 in a contact row, 64 on a confirmation, 68 on the account.
 * Roughly a third of the circle, rounded the way the layout rounded it.
 */
const LETTERS: Record<number, number> = {
  16: 6,
  18: 7,
  24: 9,
  26: 10,
  30: 11,
  32: 11,
  34: 11,
  38: 13,
  42: 14,
  64: 18,
  68: 20,
};

/**
 * Initials in a circle, or the person's own photograph if there is one — the initials stay the
 * spare (spec 7.5). The circle's colour is dealt from the palette of faces by the name itself, so
 * two people side by side are two colours and the same person is the same colour everywhere.
 *
 * Two rings, and they are different things: `ring` is the `spark` collar the organizer wears — the
 * only place a person is marked by colour in this product — and it lies *outside* the circle, while
 * `ringColor` is the 1.5 hairline in the colour of whatever is underneath, which is what lets
 * overlapping circles cut each other. An organizer inside a stack wears both.
 */
export function Avatar({
  name,
  size = 42,
  uri,
  ring,
  ringColor,
  gone,
  style,
}: {
  name: string;
  size?: number;
  uri?: string | null;
  ring?: boolean;
  /** What the hairline is drawn in when it is separating overlapping circles rather than marking one. */
  ringColor?: string;
  /** A contact that has just been removed: the circle goes out without leaving the row. */
  gone?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  // No border at all unless there is one to draw: a transparent 0-wide ring still writes its colour
  // into the style, and a circle that carries a hairline it cannot be seen against is a lie the next
  // reader has to check by eye.
  const collar = ringColor ? { borderWidth: 1.5, borderColor: ringColor } : null;
  const circle = { width: size, height: size, borderRadius: size / 2, ...collar };

  return (
    <View
      // The initials repeat a name that is written out beside them on every screen that draws one.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        circle,
        // Spec 7.5: the organizer's collar is a shadow and not a border, so it can stand outside the
        // hairline instead of replacing it.
        ring ? { boxShadow: `0 0 0 1.5px ${color.spark}` } : null,
        // A removed contact's circle goes a step down from `raise` and no further: the layout draws it
        // #1B1B24, between `surface` and `raise`, so it is still a circle on the `ink` of a list.
        { backgroundColor: gone ? color.surface : faceOf(name) },
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} contentFit="cover" style={[StyleSheet.absoluteFill, circle]} />
      ) : (
        <Text
          role={size >= 68 ? 'subtitleDisplay' : 'row'}
          tone={gone ? 'faint' : 'paper'}
          style={{ fontSize: LETTERS[size] ?? Math.round(size / 3) }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

/** Two letters, and one where a name has no second word. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const two = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return two.toUpperCase();
}

/**
 * Circles overlapping in a row, each ringed in the colour of whatever they lie on so the edges stay
 * apart — the sign on the «Контакты» row of the account screen, and the faces inside the «смотрят
 * сейчас» pill (spec 7.5). They overlap by 12 at 34 and by 7 at 24: the smaller the circle, the less
 * of it there is to give away.
 *
 * Four circles at most. Past that the fourth stops being a face and becomes «+N», because a row of
 * faces is a glance and not a list — and the number it carries is the people it stands for, the
 * three drawn ones excluded.
 */
export function AvatarStack({
  names,
  on,
  size = 34,
}: {
  names: readonly string[];
  /** The surface underneath, which is what the separating ring is drawn in. */
  on?: string;
  size?: number;
}) {
  const { color } = useTheme();
  const styles = useStackStyles();
  const under = on ?? color.surface;
  const over = { marginLeft: size >= 30 ? -12 : -7 };
  const rest = names.length > 4 ? names.length - 3 : 0;
  const faces = rest ? names.slice(0, 3) : names.slice(0, 4);

  return (
    <View style={styles.row}>
      {faces.map((name, i) => (
        <Avatar
          key={`${name}-${i}`}
          name={name}
          size={size}
          ringColor={under}
          style={i === 0 ? undefined : over}
        />
      ))}
      {rest ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.more,
            over,
            { width: size, height: size, borderRadius: size / 2, borderColor: under },
          ]}
        >
          <Text role="row" style={{ fontSize: LETTERS[size] ?? Math.round(size / 3) }}>
            +{rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Spec 7.5 — «смотрят сейчас»: the faces of the people watching a montage go out, the live dot, and
 * how many they are. It stands on the right of the bar over a montage on air and nowhere else, and
 * with nobody watching it is not drawn at all — the screen decides that, because zero is a fact
 * about people and not a state of a pill.
 *
 * One thing to a screen reader, because three faces and a number read out one at a time are noise:
 * the whole pill is the sentence the screen hands it.
 */
export function WatchingPill({
  names,
  count,
  label,
  style,
}: {
  names: readonly string[];
  /** Said as a figure — it can be larger than the faces there is room for. */
  count: number;
  /** «Смотрят сейчас: 3» — the sentence, from the screen. */
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStackStyles();

  return (
    <View accessible accessibilityLabel={label} style={[styles.pill, style]}>
      {/* The hairline is `ink` and not the pill's own fill: at 24 the circles overlap by 7, and the
          darker cut is what keeps three faces from reading as one shape. */}
      <AvatarStack names={names} size={24} on={color.ink} />
      <View style={styles.pillCount}>
        <LiveDot />
        <Text role="meta" style={styles.pillFigure}>
          {count}
        </Text>
      </View>
    </View>
  );
}

const useStackStyles = themed(({ color }) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    more: {
      borderWidth: 1.5,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pill: {
      height: height.watchPill,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: space.s3 - 2,
      borderRadius: radius.pill,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    pillCount: { flexDirection: 'row', alignItems: 'center', gap: space.s1 },
    // The figure is read in `paper` and a weight heavier than a meta line: it is the point of the pill.
    pillFigure: { color: color.paper, fontFamily: font.semi },
  }),
);

/**
 * Spec 7.5 — a person inside a memory: the circle, their name, a second line of what they have
 * brought, and one mark at the right edge. Rows are separated by a hairline, which React Native has
 * no sibling selector for — so a list passes `divider` on every row but the first.
 *
 * The right edge holds exactly one thing and the screen says which: the 28 contribution circle,
 * the 44 button that is your own standing, or — while the roster is being edited — the 36 cross
 * that takes this person out (spec 10.8.4). They replace each other rather than queue up, because
 * two marks in a 56 row is a row nobody can scan.
 *
 * Nobody's role is written out here. The organizer is told by the `spark` collar on their circle
 * and by nothing else: «Организатор» beside a name that already wears the ring is the same word
 * said twice.
 */
export function RowMember({
  name,
  meta,
  status,
  divider,
  gone,
  uri,
  ring,
}: {
  name: string;
  /** «128 кадров» — written by the screen, because every part of it is a word. */
  meta?: string;
  /** The one mark at the right edge: the contribution circle, your own button, or the cross. */
  status?: ReactNode;
  divider?: boolean;
  gone?: boolean;
  uri?: string | null;
  /** The `spark` collar: the organizer, and yourself. */
  ring?: boolean;
}) {
  const styles = useStyles();

  return (
    <View>
      {divider ? <Divider soft style={styles.inset} /> : null}
      <View style={styles.member}>
        <Avatar name={name} size={38} uri={uri} ring={ring} gone={gone} />
        <View style={styles.rowWords}>
          <Text role="row" tone={gone ? 'faint' : 'paper'} numberOfLines={1}>
            {name}
          </Text>
          {meta ? (
            <Text role="meta" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {status}
      </View>
    </View>
  );
}

/**
 * Spec 7.5 — a person in the address book, in the three states a name there can be in:
 *
 * - `saved` — a plain row with a cross on the end;
 * - `found` — someone the search turned up who is not saved yet, so the row becomes a card and the
 *   cross becomes a «Сохранить»;
 * - `gone` — just removed: the circle and the words go out, the username gives way to a line saying
 *   so, and a way back stands where the cross was for five seconds.
 */
export function RowContact({
  name,
  handle,
  variant = 'saved',
  divider,
  children,
}: {
  name: string;
  /**
   * «@marina.k», or — for a row just removed — the line that says it is gone. Left off where the
   * name above it is already the username: whoever signed in by e-mail is called by their own
   * username, and printing it twice spends a line saying nothing (`memberHandle`).
   */
  handle?: string;
  variant?: 'saved' | 'found' | 'gone';
  divider?: boolean;
  /** The cross, the «Сохранить», the «Вернуть» — whichever belongs to this state. */
  children?: ReactNode;
}) {
  const styles = useStyles();
  const gone = variant === 'gone';

  return (
    <View>
      {divider && variant === 'saved' ? <Divider /> : null}
      <View style={[styles.row, variant === 'found' ? styles.card : null]}>
        <Avatar name={name} size={42} gone={gone} />
        <View style={styles.rowWords}>
          <Text role="row" tone={gone ? 'faint' : 'paper'} numberOfLines={1}>
            {name}
          </Text>
          {handle ? (
            <Text role="meta" tone={gone ? 'faint' : 'muted'} numberOfLines={1}>
              {handle}
            </Text>
          ) : null}
        </View>
        {children}
      </View>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    avatar: { backgroundColor: color.raise, alignItems: 'center', justifyContent: 'center' },
    row: {
      minHeight: height.row,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: 11,
    },
    // Spec 7.5: a member stands 56 to a contact's 64 — inside a memory the list is long and the
    // circle is smaller, so the row closes up with it.
    member: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: 14,
    },
    // The hairline starts where the words do, not where the circle does.
    inset: { marginLeft: 64 },
    card: {
      paddingHorizontal: space.s3,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.field,
    },
    rowWords: { flex: 1, minWidth: 0, gap: 2 },
    rowLine: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    grow: { flexShrink: 1 },
  }),
);
