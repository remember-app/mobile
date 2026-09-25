import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { faceOf, font, height, radius, space, themed, useTheme } from '@/theme';

import { Divider, LiveDot } from './bits';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.5 — people. Three parts: the circle that stands for someone, the row they occupy inside a
 * memory, and the row they occupy in the address book. None of them knows a word: a name, a
 * username and a standing all arrive as text.
 */

/**
 * The sizes the layout draws an avatar at, each with the type size that goes inside it (spec 7.5,
 * detail 31): 16 in a day gap, 18 on a frame on air, 24 and 36 alone, 30 in a chip, 32 in a sheet,
 * 38 in a member row, 42 in a contact row, 48 as a face in the filter, 64 on a confirmation and on
 * the account. A stack, at 24 and 36, sets its letters itself (`STACK`).
 * Roughly a third of the circle, rounded the way the layout rounded it.
 */
const LETTERS: Record<number, number> = {
  16: 6,
  18: 7,
  24: 9,
  26: 10,
  30: 11,
  32: 11,
  36: 12,
  38: 13,
  42: 14,
  48: 15,
  64: 18,
};

/** The sizes whose initials are 700 (spec 7.5, detail 31); the rest — 32, 42, 64 — are 600. */
const BOLD = new Set([16, 18, 24, 36, 38, 48]);

/**
 * Initials in a circle, or the person's own photograph if there is one — the initials stay the
 * spare (spec 7.5). The circle's colour is dealt from the palette of faces by the name itself, so
 * two people side by side are two colours and the same person is the same colour everywhere.
 *
 * `ring` is the `spark` collar the organizer wears — the only place a person is marked by colour in
 * this product — and it lies *outside* the circle. The collar that cuts overlapping circles apart is
 * the stack's (`AvatarStack`), and arrives in `style`.
 */
export function Avatar({
  name,
  size = 42,
  uri,
  ring,
  gone,
  display,
  stacked,
  style,
}: {
  name: string;
  size?: number;
  uri?: string | null;
  ring?: boolean;
  /** A contact that has just been removed: the circle goes out without leaving the row. */
  gone?: boolean;
  /**
   * The account's own circle (spec 8, `Account`): the initials in the headline face, 19 at 64 — the
   * one place a person's letters are set like a name rather than like a label.
   */
  display?: boolean;
  /**
   * A circle in a stack (spec 7.5, detail 32): the initials at the stack's own size in 700, centred
   * in what the next circle leaves showing — `covered` is how much of the right side it lies over.
   */
  stacked?: { letters: number; covered: number };
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const circle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      // The initials repeat a name that is written out beside them on every screen that draws one.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        circle,
        // Spec 7.5: the organizer's collar is a shadow and not a border, so it stands outside the
        // circle instead of eating into it.
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
          role={display ? 'subtitleDisplay' : 'row'}
          tone={gone ? 'faint' : 'paper'}
          // The circle is a picture of a fixed size and the letters are part of it, set for that
          // size (TASK-375): grown with the system's type they ran out of it — «БН» past both sides
          // of a 38. The name they stand for is written out beside them, and that is what grows.
          maxFontSizeMultiplier={1}
          style={
            stacked
              ? {
                  fontSize: stacked.letters,
                  fontFamily: font.bold,
                  // The letters' box grows on the right by what is hidden there, so the circle's own
                  // centring puts the glyphs in the middle of what is left showing.
                  paddingRight: stacked.covered,
                }
              : {
                  fontSize: display
                    ? Math.round(size * 0.3)
                    : (LETTERS[size] ?? Math.round(size / 3)),
                  ...(!display && BOLD.has(size) ? { fontFamily: font.bold } : null),
                  // The headline face is borrowed for its letters, not the field's tracking.
                  letterSpacing: 0,
                }
          }
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

/**
 * Two characters: the first of each of the first two words, or the first two of a lone word. A
 * character is what the eye takes for one, not a UTF-16 unit (`lead`) — an emoji in a name is an
 * initial like any letter, and never half of one.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = lead(words[0]);
  const second = lead(words.length > 1 ? words[1] : words[0].slice(first.length));
  return (first + second).toUpperCase();
}

/**
 * The first character of a word whole: a flag (two regional letters), or one code point with all
 * that hangs on it — combining marks and variation selectors (`\p{M}`), a skin tone, the tags of a
 * subdivision flag — and whatever a ZWJ joins on after it. Hermes has no `Intl.Segmenter` to ask.
 */
const LEAD =
  /^(?:\p{Regional_Indicator}{2}|.[\p{M}\p{Emoji_Modifier}\u{E0020}-\u{E007F}]*(?:\u200D.[\p{M}\p{Emoji_Modifier}\u{E0020}-\u{E007F}]*)*)/u;

function lead(word: string): string {
  return LEAD.exec(word)?.[0] ?? '';
}

/**
 * The two stacks the layout draws (spec 7.5, detail 32): 36 on the account's «Контакты», 24 in the
 * «смотрят сейчас» pill. `overlap` is how far a circle slides under the next one; the collar that cuts
 * them apart is `halo` of the colour underneath standing *outside* the circle at 36, and a 1
 * hairline inside it at 24 (`halo` 0); `letters` is the initials' size, in 700.
 */
const STACK = {
  36: { overlap: 12, halo: 2, letters: 11 },
  24: { overlap: 7, halo: 0, letters: 8 },
} as const;

/**
 * Circles overlapping in a row, each collared in the colour of whatever they lie on so the edges
 * stay apart — the sign on the «Контакты» card of the account screen, and the faces inside the
 * «смотрят сейчас» pill (spec 7.5). They overlap by 12 at 36 and by 7 at 24: the smaller the circle,
 * the less of it there is to give away.
 *
 * The next circle, collar and all, hides the right side of the one under it — 14 of 36, 7 of 24 — so
 * every circle but the last centres its initials in the part still showing: centred in the whole
 * circle, «МК» reads «МI». The last one, and a «+N», have nothing over them and keep the middle.
 *
 * Four circles at most. Past that the fourth stops being a face and becomes «+N», because a row of
 * faces is a glance and not a list — and the number it carries is the people it stands for, the
 * three drawn ones excluded.
 */
export function AvatarStack({
  names,
  on,
  size = 36,
}: {
  names: readonly string[];
  /** The surface underneath, which is what the separating collar is drawn in. */
  on?: string;
  size?: keyof typeof STACK;
}) {
  const { color } = useTheme();
  const styles = useStackStyles();
  const under = on ?? color.surface;
  const { overlap, halo, letters } = STACK[size];
  const collar = halo
    ? { boxShadow: `0 0 0 ${halo}px ${under}` }
    : { borderWidth: 1, borderColor: under };
  const over = { marginLeft: -overlap };
  const rest = names.length > 4 ? names.length - 3 : 0;
  const faces = rest ? names.slice(0, 3) : names.slice(0, 4);
  const last = rest ? -1 : faces.length - 1;

  return (
    <View style={styles.row}>
      {faces.map((name, i) => (
        <Avatar
          key={`${name}-${i}`}
          name={name}
          size={size}
          stacked={{ letters, covered: i === last ? 0 : overlap + halo }}
          style={[collar, i === 0 ? null : over]}
        />
      ))}
      {rest ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.more, collar, over, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Text role="row" style={{ fontSize: letters, fontFamily: font.bold }}>
            +{rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Spec 7.5 — the face as a switch: «Кто принёс» in the filter is a row of these and nothing else. The
 * circle alone, 48 and without a hairline, and no name beside it — a person is known by their
 * circle, and the name is what it is called out as.
 *
 * Chosen, it stands in a double ring — 2 of the sheet's `surface`, then 2 of `paper` — with a `paper`
 * tick in its lower corner; `excluded`, the whole face goes down to half. It lives on the sheet, so
 * `surface` is what the inner ring and the tick's collar are cut in.
 */
export function FaceToggle({
  name,
  selected,
  excluded,
  onPress,
}: {
  /** The whole name: the initials come out of it, and it is what the face is read out as. */
  name: string;
  selected: boolean;
  /** Left out of the feed — somebody else is chosen and this one is not. The row says when. */
  excluded?: boolean;
  onPress: () => void;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useFaceStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityLabel={name}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.face,
        selected
          ? { boxShadow: `0 0 0 2px ${color.surface}, 0 0 0 4px ${color.paper}` }
          : excluded
            ? styles.dim
            : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      <Avatar name={name} size={height.face} />
      {selected ? (
        <View style={styles.tick}>
          <Icon icon={Check} size={9} color={color.ink} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** The least air between two faces: a chosen one's ring reaches 4 past its edge on either side. */
const FACE_AIR = space.s2;
/** The row stands 2 in from the sheet's edges, so the ring of a face at either end is not cut. */
const FACE_EDGE = 2;

/**
 * How far apart the faces stand once they no longer fit one row. One row is spread edge to edge
 * (`space-between`, spec 8) and needs no number — that is `undefined`, and so is a row not measured
 * yet. Past one row the faces wrap (TASK-294: no scrolling and no «+N»), and every row keeps the
 * columns of the first: a wrapped `space-between` would spread two faces of a last row to the two
 * edges and three to the edges and the middle, under nothing in the row above.
 *
 * Whole pixels, rounded down: the gaps summed to the exact width let Yoga's float round the last face
 * of a row onto the next one.
 */
export function faceGap(width: number, count: number): number | undefined {
  const across = Math.floor((width + FACE_AIR) / (height.face + FACE_AIR));
  if (count <= across || across < 2) return undefined;
  return Math.floor((width - across * height.face) / (across - 1));
}

/**
 * The row the faces stand in (spec 8, «Кто принёс»): spread across the sheet and wrapping onto a
 * second row rather than scrolling or hiding anybody (TASK-294). It measures itself — how many faces
 * fit is a question of the phone's width. The eyebrow over it is what names the group.
 *
 * Half strength means «left out», and whether anybody is left out is the row's to know, not a face's
 * (spec 7.5, detail 31): with nobody chosen there is no filter by people and every face stands at full
 * strength; once one is chosen, every face that is not goes down to half.
 */
export function FaceRow({
  faces,
  onToggle,
}: {
  faces: readonly { id: string; name: string; selected: boolean }[];
  onToggle: (id: string) => void;
}) {
  const styles = useFaceStyles();
  const [width, setWidth] = useState(0);
  const gap = faceGap(width - FACE_EDGE * 2, faces.length);
  const filtering = faces.some((face) => face.selected);

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.row, gap === undefined ? styles.spread : { columnGap: gap }]}
    >
      {faces.map((face) => (
        <FaceToggle
          key={face.id}
          name={face.name}
          selected={face.selected}
          excluded={filtering && !face.selected}
          onPress={() => onToggle(face.id)}
        />
      ))}
    </View>
  );
}

const useFaceStyles = themed(({ color }) =>
  StyleSheet.create({
    face: { width: height.face, height: height.face, borderRadius: radius.pill },
    dim: { opacity: 0.5 },
    // Spec 7.5: 18 of `paper` hanging 2 past the lower right, collared 2 in the sheet's own colour.
    tick: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 18,
      height: 18,
      borderRadius: radius.pill,
      backgroundColor: color.paper,
      borderWidth: 2,
      borderColor: color.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: space.s3,
      paddingTop: FACE_EDGE,
      paddingHorizontal: FACE_EDGE,
    },
    spread: { justifyContent: 'space-between' },
  }),
);

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
 * Nobody's role is marked here — not in words and not by the organizer's `spark` collar, which
 * stands only in the seam of «По людям» (spec 7.5, detail 31): a roster is read for who has brought
 * what, and the role is not what it is scanned for.
 */
export function RowMember({
  name,
  meta,
  status,
  divider,
  gone,
  uri,
}: {
  name: string;
  /** «128 кадров» — written by the screen, because every part of it is a word. */
  meta?: string;
  /** The one mark at the right edge: the contribution circle, your own button, or the cross. */
  status?: ReactNode;
  divider?: boolean;
  gone?: boolean;
  uri?: string | null;
}) {
  const styles = useStyles();

  return (
    <View>
      {divider ? <Divider soft style={styles.inset} /> : null}
      <View style={styles.member}>
        <Avatar name={name} size={38} uri={uri} gone={gone} />
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
      <View style={[styles.contact, variant === 'found' ? styles.card : null]}>
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
    // «Сохранить» and «Вернуть» move under the name when the system type leaves them no room beside it.
    contact: {
      minHeight: height.row,
      flexDirection: 'row',
      flexWrap: 'wrap',
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
    // `Contacts`: 10 round the circle and 12 on the far side of «Сохранить», 66 tall with it.
    card: {
      paddingVertical: 10,
      paddingLeft: 10,
      paddingRight: space.s3,
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
