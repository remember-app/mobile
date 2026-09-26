import {
  type ComponentRef,
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Text as RNText,
  type StyleProp,
  StyleSheet,
  type TextProps,
  type TextStyle,
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
  // «Приглашение» on `InviteDead`, 217.6 at 24, in the 303 an empty state leaves on 375 (TASK-400).
  emptyTitle: 1.39,
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
 * The roles set in Unbounded that grow with the system's type (TASK-400). The face is the wide one,
 * and what it carries is either measured on 375 only (`HEADING_MOST`) or cannot be measured at all —
 * a memory's name, a person's — so on a narrower phone, or with a longer word, it can outgrow its
 * line. These always keep their words whole (`useWhole`); the bar's one-line headings do not grow and
 * «Remember» shrinks to fit, so neither is here.
 */
const WIDE = new Set(
  (Object.keys(type) as TypeRole[]).filter(
    (role) =>
      String(type[role].fontFamily).startsWith('Unbounded') &&
      !ONE_WORD.has(role) &&
      HEADING_MOST[role] !== 1,
  ),
);

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
 * and is heard. The growth is the kit's and never the platform's (TASK-406): the words are drawn at
 * their size already grown, with `allowFontScaling` off. React Native measures text by its size and
 * leaves the cap out of the key, so a cap lowered over words already drawn kept their old box; and a
 * text whose props stay the same through a change of the system's type is attached again, by React's
 * next commit, as the node laid out at the old one — so every step of the type is a size of its own.
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
  /**
   * Words in a box whose width the layout fixes and that has no roomier way to stand — the caption
   * on a tile, an address: they grow only as far as the box holds the longest of them whole
   * (`useWhole`). The wide face does this unasked, and so does every text of a `WordRoom` part once
   * the part has no more room to give; `false` keeps a text of the wide face out of it.
   */
  fit?: boolean;
};

export function Text({
  role = 'body',
  tone,
  balance,
  fit,
  style,
  maxFontSizeMultiplier,
  onTextLayout,
  children,
  ...rest
}: KitTextProps) {
  const styles = useStyles();
  const room = useContext(WordRoom);
  const nested = useContext(InText);
  const words = wordsOf(children);
  const whole = useWhole(maxFontSizeMultiplier ?? HEADING_MOST[role] ?? TYPE_MOST, words);
  const face = [type[role], style];
  const set = whole.grown === 1 ? null : grownBy(face, whole.grown);
  // Only what can break a word is asked where its lines fell: measuring them is a second layout of
  // the text, and the one line of «Remember» or of a bar's heading never breaks anything.
  const watching = room !== null || (fit ?? WIDE.has(role));
  // Grown words are checked before they are first seen (TASK-407): the same words once more, unseen,
  // a piece to a line, and the widest of them against the box the text was laid out in — read in
  // the layout effect, where React Native has the layout of this very commit, and set right before
  // it reaches the screen. A span inside other words has no box of its own, and a text cut to a
  // count of lines breaks nothing; both are left to its lines.
  const pieces =
    watching && !nested && whole.grown > 1 && words !== null && rest.numberOfLines === undefined
      ? piecesOf(words)
      : null;
  const shown = useRef<ComponentRef<typeof RNText>>(null);
  const twin = useRef<ComponentRef<typeof RNText>>(null);
  /** Whether the words could be measured as they stand now — and if one is torn, it is put right. */
  const check = () => {
    if (!twin.current) return false;
    const box = widthOf(shown.current);
    const widest = widthOf(twin.current);
    if (box === 0 || widest === 0) return false;
    // The part stands the roomier way first; a word too wide even there, or with no part round it,
    // is set smaller.
    if (widest > box + SLACK && !room?.()) whole.fit(box / widest);
    return true;
  };
  useLayoutEffect(() => {
    check();
  });

  if (balance && typeof children === 'string')
    return (
      <Balanced
        role={role}
        tone={tone}
        fit={fit}
        style={style}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        onTextLayout={onTextLayout}
        {...rest}
      >
        {children}
      </Balanced>
    );
  const drawn = (
    <RNText
      // And a new node, so nothing of the torn layout is kept.
      key={whole.fitted ?? 'grown'}
      ref={shown}
      style={[styles[tone ?? (QUIET.has(role) ? 'muted' : 'paper')], ...face, set]}
      allowFontScaling={false}
      {...(ONE_WORD.has(role) ? { numberOfLines: 1, adjustsFontSizeToFit: true } : null)}
      onTextLayout={
        watching
          ? (event) => {
              onTextLayout?.(event);
              // The lines arrive after the commit that laid them out, and may speak of a layout
              // already put right; where the words can be measured as they stand, that is asked.
              const { lines } = event.nativeEvent;
              if (!check() && brokeWord(lines) && !room?.()) whole.less(lines);
            }
          : onTextLayout
      }
      {...rest}
    >
      {children}
    </RNText>
  );
  return (
    <>
      {nested || words !== null ? drawn : <InText.Provider value>{drawn}</InText.Provider>}
      {pieces === null ? null : (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={hidden.measure}
        >
          <RNText ref={twin} allowFontScaling={false} style={typeOf([...face, set])}>
            {pieces}
          </RNText>
        </View>
      )}
    </>
  );
}

/** Words inside other words: a kit `Text` in a kit `Text` is a span of it, with no box of its own. */
const InText = createContext(false);

/** The words of a text that is only words — a string, a number, or a run of them — else `null`. */
function wordsOf(children: ReactNode): string | null {
  const plain = (one: unknown) => typeof one === 'string' || typeof one === 'number';
  if (plain(children)) return String(children);
  return Array.isArray(children) && children.every(plain) ? children.join('') : null;
}

/**
 * The pieces a line may not break inside, one to a line: the words, and a word with a hyphen or a
 * dash in it cut after that — where the phone may take it to the next line without tearing it.
 */
export function piecesOf(words: string): string {
  return words
    .split(/\s+/)
    .flatMap((word) => word.match(/[^-‐–—]+[-‐–—]*|[-‐–—]+/g) ?? [])
    .join('\n');
}

/** Rounding of the phone's own measures: a word wider than its box by less than this is not torn. */
const SLACK = 0.5;

/**
 * How wide a laid-out text is, read from the layout React Native has for the commit that drew it.
 * The new architecture answers there and then; anywhere it does not, this is 0 and nothing is asked.
 */
function widthOf(
  node: { measure?: (answer: (x: number, y: number, width: number) => void) => void } | null,
) {
  let width = 0;
  node?.measure?.((_x, _y, wide) => {
    width = wide;
  });
  return width;
}

/** What of a text's style sets how wide its words run — the rest is the box's, not the words'. */
const TYPE_KEYS = [
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'letterSpacing',
  'textTransform',
] as const;

function typeOf(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  return Object.fromEntries(
    TYPE_KEYS.filter((key) => flat[key] !== undefined).map((key) => [key, flat[key]]),
  );
}

/** Whether the phone broke a word where these two lines meet: neither a space nor a hyphen or dash. */
const tornAt = (above: { text: string }, below: { text: string }) =>
  !/[\s\-‐–—]$/.test(above.text) && !/^\s/.test(below.text);

/**
 * Whether a laid-out text broke a word between two of its lines: at some join of the lines the phone
 * reports (`onTextLayout`) there is neither a space nor a hyphen or a dash. The one sign the layout
 * gives that a box is narrower than a word it holds — Yoga has no min-content to keep it from being so.
 */
export function brokeWord(lines: readonly { text: string }[]): boolean {
  return lines.some((line, i) => i > 0 && tornAt(lines[i - 1], line));
}

/**
 * How far words laid out at `grown` times their size may grow for every word the phone broke to
 * stand whole on one line (TASK-400); `undefined` where none broke. The line is as wide as the widest
 * one laid out — a word too wide for it fills it to the last letter that fits — and a piece of a word
 * on a line it shares with others counts by its share of that line's letters; 2% under that, for the
 * rounding of the phone's own measures, which otherwise tore the word by a hair once more. Never
 * more than 95% of `grown`, so each answer is a step down even where that share guessed short; a
 * word the phone still breaks at the new size asks again on the next layout.
 */
export function wholeAt(
  lines: readonly { text: string; width: number }[],
  grown: number,
): number | undefined {
  const share = (line: { text: string; width: number }, piece: string) =>
    (line.width * piece.length) / Math.max(1, line.text.trimEnd().length);
  let widest = 0;
  let word = 0;
  lines.forEach((line, i) => {
    if (i === 0 || !tornAt(lines[i - 1], line)) {
      widest = Math.max(widest, word);
      word = 0;
      return;
    }
    const above = lines[i - 1];
    if (word === 0) word = share(above, above.text.split(/\s/).pop() ?? '');
    const text = line.text.trimEnd();
    const piece = text.split(/\s/)[0];
    word += piece.length === text.length ? line.width : share(line, piece);
  });
  widest = Math.max(widest, word);
  if (widest === 0) return undefined;
  const held = (0.98 * Math.max(...lines.map((line) => line.width))) / widest;
  // A line the phone told no width of is a step down all the same.
  return grown * (held < 0.95 ? held : 0.95);
}

/**
 * The growth a text keeps its words whole at (TASK-400): the role's ceiling, until a word breaks at
 * the phone's type size and width — then as far as the break says, and no lower than the spec's own
 * size. Held while the type size, the window's width and the words themselves stay what they were;
 * on a change of any of them the text grows to its ceiling again and asks anew.
 */
function useWhole(most: number, words: string | null) {
  const { fontScale, width } = useWindowDimensions();
  const here = `${fontScale} ${width}`;
  const full = Math.min(fontScale, most);
  const [held, setHeld] = useState<{ here: string; words: typeof words; most: number } | null>(
    null,
  );
  const heldAt = (had: typeof held) =>
    had?.here === here && had.words === words && had.most < full ? had.most : null;
  /** How far the words are grown once set smaller; `null` while they grow as the role says. */
  const fitted = heldAt(held);
  const grown = fitted ?? full;
  // A measure speaks only of the size it was taken at: one that arrives after the words were set
  // again — the phone's lines of the commit a layout effect already put right — says nothing.
  const setTo = (next: number) => {
    if (grown > 1)
      setHeld((had) =>
        (heldAt(had) ?? full) === grown ? { here, words, most: Math.max(1, next) } : had,
      );
  };
  return {
    fitted,
    grown,
    less: (lines: readonly { text: string; width: number }[]) => {
      const next = wholeAt(lines, grown);
      if (next !== undefined) setTo(next);
    },
    /** Set `share` of the size drawn now, 2% under it for the rounding of the phone's measures. */
    fit: (share: number) => setTo(grown * share * 0.98),
  };
}

/** The size, and the line under it, of words drawn `by` times their own: set, not grown. */
function grownBy(style: StyleProp<TextStyle>, by: number) {
  const { fontSize, lineHeight } = StyleSheet.flatten(style) as {
    fontSize?: number;
    lineHeight?: number;
  };
  return {
    fontSize: (fontSize ?? 14) * by,
    ...(lineHeight === undefined ? null : { lineHeight: lineHeight * by }),
  };
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
  fit,
  maxFontSizeMultiplier,
  numberOfLines,
  style,
  onTextLayout,
  ...rest
}: Omit<KitTextProps, 'balance' | 'children'> & { children: string }) {
  const words = children.split(' ').filter(Boolean);
  const [room, setRoom] = useState(0);
  const [drawn, setDrawn] = useState<readonly number[]>([]);
  /** How tall one line of the words is, off the first of them measured alone. */
  const [line, setLine] = useState(0);
  const [missed, setMissed] = useState<string | null>(null);
  const box = useRef<ComponentRef<typeof View>>(null);
  const face = { role, tone, maxFontSizeMultiplier, style };
  const measures = [...words, `${words[0]} ${words[1]}`];
  const measured =
    words.length > 1 && room > 0 && measures.every((_, at) => drawn[at] !== undefined);
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
  // More lines than counted, read off the layout of this very commit — the words ran wider on the
  // phone than their sum: back to the full width before it is seen. The phone's lines, a commit
  // later, may never come: a layout of the same lines at another width is not reported again, and
  // the name stood a line longer after a change of the system's type (TASK-406).
  useLayoutEffect(() => {
    if (!narrow || !even || line === 0) return;
    let tall = 0;
    box.current?.measure((_x, _y, _width, height) => {
      tall = height;
    });
    if (tall > line * (even.lines + 0.5)) setMissed(tried);
  });
  if (words.length < 2)
    return (
      <Text {...face} fit={fit} numberOfLines={numberOfLines} onTextLayout={onTextLayout} {...rest}>
        {children}
      </Text>
    );

  return (
    <View ref={box} onLayout={(event) => setRoom(event.nativeEvent.layout.width)}>
      <Text
        {...face}
        fit={fit}
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
            // A measure is the word at its full size, whatever the visible one comes to.
            fit={false}
            onLayout={(event) => {
              const { width: wide, height } = event.nativeEvent.layout;
              setDrawn((had) => (had[at] === wide ? had : Object.assign([...had], { [at]: wide })));
              if (at === 0) setLine(height);
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
 * part drew it — a button handed in through a slot as well as the part's own words. The answer is
 * whether the part made room; a part already standing its roomier way has none left to make, and the
 * text then keeps its words whole by growing less (`Text`'s `fit`).
 */
export const WordRoom = createContext<(() => boolean) | null>(null);

/**
 * A part whose words share a line with something else — round buttons, a badge, a stack of photos,
 * the other half of a grid — and that has a roomier way to stand (TASK-375). It stands the drawn way
 * until one of its words breaks mid-word at the phone's type size and width, and the roomier way from
 * then on, until either changes: in the roomier way nothing breaks any more, so it is not what decides.
 * `room` goes to `WordRoom.Provider` round the words.
 *
 * `way` is the key of the box whose style the two ways change. Yoga works a node's flex basis out
 * once it is set — `flex: 1` sets it — and React Native never has it worked out again, so a box back
 * from the whole width to its share kept the whole width: on a change of the system's type with the
 * app open, the films badge of a card stayed under a name that had room beside it (TASK-406). A new
 * key is a new node, with its basis still to work out.
 */
export function useWordRoom(): { roomy: boolean; way: 'roomy' | 'drawn'; room: () => boolean } {
  const { fontScale, width } = useWindowDimensions();
  const here = `${fontScale} ${width}`;
  const [broke, setBroke] = useState<string | null>(null);
  return {
    roomy: broke === here,
    way: broke === here ? 'roomy' : 'drawn',
    room: () => {
      if (broke === here) return false;
      setBroke(here);
      return true;
    },
  };
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
    <RNText nativeID={nativeID} allowFontScaling={false} style={hidden.clip}>
      {children}
    </RNText>
  );
}

const hidden = StyleSheet.create({
  clip: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  unseen: { opacity: 0 },
  // Words laid out unseen, each as wide as it runs: room for any of them on one line. Held to the
  // box they stand in, the balanced name's first two words on the largest type came out wrapped —
  // measured as wide as the box, a space of 4 between them, and the name one line longer than counted.
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4096,
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
  },
});
