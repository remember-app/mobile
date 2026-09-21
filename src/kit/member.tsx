import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { Divider } from './bits';
import { Text } from './text';

/**
 * Spec 7.5 — people. Three parts: the circle that stands for someone, the row they occupy inside a
 * memory, and the row they occupy in the address book. None of them knows a word: a name, a
 * username and a standing all arrive as text.
 */

/** The sizes the layout draws an avatar at, each with the type size that goes inside it. */
const LETTERS: Record<number, number> = { 26: 10, 32: 11, 34: 11, 42: 14, 64: 18, 68: 20 };

/**
 * Initials in a circle, or the person's own photograph if there is one — the initials stay the
 * spare (spec 7.5).
 *
 * `ring` is the 2px `spark` collar the organizer and «вы» wear, and it is the only place a person
 * is marked by colour anywhere in the product.
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
  /** What the ring is drawn in when it is separating overlapping circles rather than marking one. */
  ringColor?: string;
  /** A contact that has just been removed: the circle goes out without leaving the row. */
  gone?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  // No border at all unless there is one to draw: a transparent 0-wide ring still writes its colour
  // into the style, and a circle that carries `spark` without wearing it is a lie the next reader
  // has to check by eye.
  const collar = ring || ringColor ? { borderWidth: 2, borderColor: ringColor ?? color.spark } : null;
  const circle = { width: size, height: size, borderRadius: size / 2, ...collar };

  return (
    <View
      // The initials repeat a name that is written out beside them on every screen that draws one.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, circle, gone ? styles.avatarGone : null, style]}
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
 * Three circles overlapping by 12, each ringed in the colour of whatever they lie on so the edges
 * stay apart — the sign on the «Контакты» row of the account screen (spec 7.5).
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

  return (
    <View style={stack.row}>
      {names.slice(0, 3).map((name, i) => (
        <Avatar
          key={`${name}-${i}`}
          name={name}
          size={size}
          ringColor={on ?? color.surface}
          style={i === 0 ? undefined : stack.over}
        />
      ))}
    </View>
  );
}

const stack = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  over: { marginLeft: -12 },
});

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
    // A removed contact goes a step under the surface rather than simply translucent: the row still
    // has to be read while it stands there offering the way back.
    avatarGone: { backgroundColor: color.ink },
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
