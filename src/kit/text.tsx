import { createContext, useContext, useState } from 'react';
import {
  Text as RNText,
  StyleSheet,
  type TextProps,
  useWindowDimensions,
  View,
} from 'react-native';

import { themed, type } from '@/theme';

import { TAP } from './tap';

/** The spec's type roles (section 3). Roles, not sizes: ask for `title`, not for 19px. */
export type TypeRole = keyof typeof type;

/**
 * Which of the colour roles the words are read in. Every one of them is a token — the point of
 * naming them here is that no component writes `{ color: … }` by hand, and so no component can
 * quietly invent a shade the spec does not have.
 */
export type TextTone =
  | 'paper'
  | 'muted'
  | 'faint'
  | 'dayOff'
  | 'accent'
  | 'spark'
  | 'sparkInk'
  | 'danger'
  | 'onFill'
  | 'quote';

/**
 * How far words grow with the system's type (TASK-377): twice their size and no further. ×2 is
 * Android's own largest step, and it is where the widest word the dictionary puts in running text —
 * «зарегистрироваться», Onest 400 at 16 — still fits whole in the column of the narrowest phone
 * (316 of 328 at 360); iOS goes on to ×3.571, where it would break letter by letter. Every text
 * input of the kit stops here too. A cell that measured its own room (`fitCell`) is the one thing
 * that says otherwise, and it grows down with what it holds.
 */
export const TYPE_MOST = 2;

/**
 * The headings stop earlier (TASK-377): Unbounded is wide, and a heading grows only while the widest
 * word it carries still fits whole in the room it has on the narrowest iPhone, 375 — measured off
 * the font file in `tests/kit/large-type.test.ts`, which names the words and the rooms. The bar's
 * one-line headings do not grow at all, the way an iOS navigation bar's title does not: the longest
 * of them, «Изменить воспоминание», already fills the bar at ×1.
 */
export const HEADING_MOST: Partial<Record<TypeRole, number>> = {
  hero: 1.13,
  heroNarrow: 1.33,
  heroSm: 1.51,
  display: 1.29,
  // A memory's name is the person's own and cannot be measured; it keeps the heading's ceiling.
  displayCover: 1.29,
  displaySm: 1.16,
  emptyTitle: 1.93,
  sheetTitle: 1.2,
  sheetTitleSm: 1.28,
  barTitle: 1,
  barTitleLive: 1,
  pillTitle: 1,
};

/**
 * The roles that are one word — the product's name — and so shrink to the width they are given
 * rather than break: on a phone narrower than the one the ceiling was measured on, and at any size.
 */
const ONE_WORD = new Set<TypeRole>(['hero', 'heroNarrow', 'heroSm']);

/**
 * The roles that are a secondary line by what they are, and so are read in `muted` unasked — the
 * eyebrow among them: spec 3 gives it no other colour.
 */
const QUIET = new Set<TypeRole>(['meta', 'metaSm', 'note', 'hint', 'eyebrow']);

/**
 * Text in the product's voice. CSS inherits `color` from `body`; React Native inherits nothing and
 * defaults to black, so a screen that reaches for `type.body` alone gets black on ink — invisible.
 * This is the one place that pairs a role with the colour it is read in, so no screen has to
 * remember. Both metas, `note`, `hint` and the eyebrow bring `muted` with them: spec 10.1 keeps every readable
 * secondary line on `muted` and leaves `faint` to what is unavailable or decorative.
 *
 * And the one place that says how far the role grows with the system's type ({@link TYPE_MOST},
 * {@link HEADING_MOST}) — a caller that measured its own room says so with `maxFontSizeMultiplier`,
 * and is heard.
 */
// React Native's own `role` is the ARIA one, and it is `accessibilityRole` spelled twice; the spec's
// roles are the useful meaning of the word here, so this takes the name over.
type KitTextProps = Omit<TextProps, 'role'> & {
  role?: TypeRole;
  tone?: TextTone;
  /**
   * CSS `text-wrap: balance`: the lines as even as the words allow, in as few lines as they take at
   * the full width (spec 3 — the name on the cover). Words, not a node: a string child.
   */
  balance?: boolean;
};

export function Text({
  role = 'body',
  tone,
  balance,
  style,
  maxFontSizeMultiplier,
  onTextLayout,
  children,
  ...rest
}: KitTextProps) {
  const styles = useStyles();
  const room = useContext(WordRoom);

  if (balance && typeof children === 'string')
    return (
      <Balanced
        role={role}
        tone={tone}
        style={style}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        onTextLayout={onTextLayout}
        {...rest}
      >
        {children}
      </Balanced>
    );
  return (
    <RNText
      style={[styles[tone ?? (QUIET.has(role) ? 'muted' : 'paper')], type[role], style]}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? HEADING_MOST[role] ?? TYPE_MOST}
      {...(ONE_WORD.has(role) ? { numberOfLines: 1, adjustsFontSizeToFit: true } : null)}
      onTextLayout={
        room
          ? (event) => {
              onTextLayout?.(event);
              if (brokeWord(event.nativeEvent.lines)) room();
            }
          : onTextLayout
      }
      {...rest}
    >
      {children}
    </RNText>
  );
}

/**
 * Whether a laid-out text broke a word between two of its lines: at some join of the lines the phone
 * reports (`onTextLayout`) there is neither a space nor a hyphen or a dash. The one sign the layout
 * gives that a box is narrower than a word it holds — Yoga has no min-content to keep it from being so.
 */
export function brokeWord(lines: readonly { text: string }[]): boolean {
  return lines.some(
    (line, i) => i > 0 && !/[\s\-‐–—]$/.test(lines[i - 1].text) && !/^\s/.test(line.text),
  );
}

/**
 * CSS `text-wrap: balance` for words of known widths (spec 3): the narrowest width at which they still
 * take no more lines than they take in `room` — so the lines come out as even as the words allow,
 * «Свадьба / Лизы и Марка» where filling each line first gives «Свадьба Лизы и / Марка» (`Main.json`
 * e14). Nothing to even out — one line, a word wider than the room, more lines than `most` shows — is
 * `undefined`.
 */
export function balanced(
  words: readonly number[],
  space: number,
  room: number,
  most = Number.POSITIVE_INFINITY,
): { width: number; lines: number } | undefined {
  const linesAt = (width: number) => {
    let lines = 1;
    let run = words[0];
    for (const word of words.slice(1)) {
      if (run + space + word <= width) run += space + word;
      else {
        lines += 1;
        run = word;
      }
    }
    return lines;
  };
  const widest = Math.max(...words);
  const lines = linesAt(room);
  if (lines < 2 || lines > most || widest > room) return undefined;
  // The narrower the width, the more lines, never fewer — so halving finds the edge.
  let short = widest;
  let width = room;
  while (width - short > 0.01) {
    const mid = (short + width) / 2;
    if (linesAt(mid) > lines) short = mid;
    else width = mid;
  }
  return { width, lines };
}

/**
 * `balance` on a kit `Text`. React Native has no `text-wrap: balance`, so the words are laid out once
 * more, unseen and one by one — each exactly as wide as the phone draws it at its type size, and the
 * first two together for the space between — and the visible text is narrowed to what `balanced`
 * finds, a point over it for the rounding of the measures. It is not seen until they are measured, so
 * its lines never jump in front of anyone; and if the phone still sets it in more lines than they were
 * counted in, it goes back to the full width rather than lose a line under `numberOfLines`.
 */
function Balanced({
  children,
  role,
  tone,
  maxFontSizeMultiplier,
  numberOfLines,
  style,
  onTextLayout,
  ...rest
}: Omit<KitTextProps, 'balance' | 'children'> & { children: string }) {
  const words = children.split(' ').filter(Boolean);
  const [room, setRoom] = useState(0);
  const [drawn, setDrawn] = useState<readonly number[]>([]);
  const [missed, setMissed] = useState<string | null>(null);
  const face = { role, tone, maxFontSizeMultiplier, style };
  if (words.length < 2)
    return (
      <Text {...face} numberOfLines={numberOfLines} onTextLayout={onTextLayout} {...rest}>
        {children}
      </Text>
    );

  const measures = [...words, `${words[0]} ${words[1]}`];
  const measured = room > 0 && measures.every((_, at) => drawn[at] !== undefined);
  const even = measured
    ? balanced(
        drawn.slice(0, words.length),
        drawn[words.length] - drawn[0] - drawn[1],
        room,
        numberOfLines,
      )
    : undefined;
  const width = even ? Math.ceil(even.width) + 1 : undefined;
  const tried = `${room} ${width}`;
  const narrow = even && missed !== tried ? { maxWidth: width } : null;

  return (
    <View onLayout={(event) => setRoom(event.nativeEvent.layout.width)}>
      <Text
        {...face}
        style={[style, narrow, measured ? null : hidden.unseen]}
        numberOfLines={numberOfLines}
        onTextLayout={(event) => {
          onTextLayout?.(event);
          if (narrow && even && event.nativeEvent.lines.length > even.lines) setMissed(tried);
        }}
        {...rest}
      >
        {children}
      </Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={hidden.measure}
      >
        {measures.map((words, at) => (
          <Text
            key={at}
            {...face}
            onLayout={(event) => {
              const wide = event.nativeEvent.layout.width;
              setDrawn((had) => (had[at] === wide ? had : Object.assign([...had], { [at]: wide })));
            }}
          >
            {words}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * Where a kit `Text` says it has broken a word: every `Text` inside the provider tells it, whichever
 * part drew it — a button handed in through a slot as well as the part's own words.
 */
export const WordRoom = createContext<(() => void) | null>(null);

/**
 * A part whose words share a line with something else — round buttons, a badge, a stack of photos,
 * the other half of a grid — and that has a roomier way to stand (TASK-375). It stands the drawn way
 * until one of its words breaks mid-word at the phone's type size and width, and the roomier way from
 * then on, until either changes: in the roomier way nothing breaks any more, so it is not what decides.
 * `room` goes to `WordRoom.Provider` round the words.
 */
export function useWordRoom(): { roomy: boolean; room: () => void } {
  const { fontScale, width } = useWindowDimensions();
  const here = `${fontScale} ${width}`;
  const [broke, setBroke] = useState<string | null>(null);
  return { roomy: broke === here, room: () => setBroke(here) };
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    paper: { color: color.paper },
    muted: { color: color.muted },
    faint: { color: color.faint },
    dayOff: { color: color.dayOff },
    accent: { color: color.accentText },
    spark: { color: color.spark },
    sparkInk: { color: color.sparkInk },
    danger: { color: color.dangerText },
    onFill: { color: color.onFill },
    quote: { color: color.quote },
  }),
);

/** What words keep clear of the sides of a cell they are fitted into, so they never meet the next. */
const FIT_INSET = 4;

/**
 * Words in a cell whose width the layout fixes — a day of the calendar, a ready length on the
 * slider — on large system type (TASK-372). The words grow only as far as the cell holds them
 * (`em`: how wide the widest of them runs, in em of the role's size), since beyond that they are
 * read, and pressed, as the next cell's; the cell grows down with them instead, never under the 44 a
 * finger needs. At the system's own size the cell is the layout's `rest`. Unmeasured (`width` 0),
 * nothing is held back.
 */
export function fitCell({
  fontScale,
  width,
  role,
  em,
  rest,
}: {
  fontScale: number;
  width: number;
  role: TypeRole;
  em: number;
  rest: number;
}): { most: number | undefined; height: number } {
  const { fontSize, lineHeight } = type[role];
  const most = width > 0 ? Math.max(1, (width - FIT_INSET) / (fontSize * em)) : undefined;
  const grown = Math.min(fontScale, most ?? fontScale);
  return {
    most,
    height: fontScale > 1 ? Math.max(TAP, Math.ceil(lineHeight * grown) + FIT_INSET) : rest,
  };
}

/**
 * A label the eye does not need and a screen reader does (spec 7.9, «скрытая подпись»): the field
 * in `SheetInvite`, the search in `Contacts`, the story box in `MontageStory` all carry one. Clipped
 * to 1 × 1 rather than removed, because a placeholder is not a label.
 */
export function HiddenLabel({ children, nativeID }: { children: string; nativeID?: string }) {
  return (
    <RNText nativeID={nativeID} style={hidden.clip}>
      {children}
    </RNText>
  );
}

const hidden = StyleSheet.create({
  clip: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  unseen: { opacity: 0 },
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
  },
});
