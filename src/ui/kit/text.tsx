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
import { themed, type } from '@/ui/theme';
import { TAP } from './tap';

type TypeRole = keyof typeof type;
type TextTone =
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
export const TYPE_MOST = 2;
const HEADING_MOST: Partial<Record<TypeRole, number>> = {
  hero: 1.13,
  heroNarrow: 1.33,
  heroSm: 1.51,
  display: 1.29,
  displayCover: 1.29,
  displaySm: 1.16,
  emptyTitle: 1.39,
  sheetTitle: 1.2,
  sheetTitleSm: 1.28,
  barTitle: 1,
  barTitleLive: 1,
  pillTitle: 1,
  stageName: 1,
};
const ONE_WORD = new Set<TypeRole>(['hero', 'heroNarrow', 'heroSm']);
const WIDE = new Set(
  (Object.keys(type) as TypeRole[]).filter(
    (role) =>
      String(type[role].fontFamily).startsWith('Unbounded') &&
      !ONE_WORD.has(role) &&
      HEADING_MOST[role] !== 1,
  ),
);
const QUIET = new Set<TypeRole>(['meta', 'metaSm', 'note', 'hint', 'eyebrow']);
type KitTextProps = Omit<TextProps, 'role'> & {
  role?: TypeRole;
  tone?: TextTone;
  fit?: boolean;
};
export function Text({
  role = 'body',
  tone,
  fit,
  style,
  maxFontSizeMultiplier,
  onTextLayout,
  children,
  ...rest
}: KitTextProps) {
  const styles = useStyles();
  const nested = useContext(InText);
  const words = wordsOf(children);
  const whole = useWhole(maxFontSizeMultiplier ?? HEADING_MOST[role] ?? TYPE_MOST, words);
  const face = [type[role], style];
  const set = whole.grown === 1 ? null : grownBy(face, whole.grown);
  const watching = fit ?? WIDE.has(role);
  const pieces =
    watching && !nested && whole.grown > 1 && words !== null && rest.numberOfLines === undefined
      ? piecesOf(words)
      : null;
  const shown = useRef<ComponentRef<typeof RNText>>(null);
  const twin = useRef<ComponentRef<typeof RNText>>(null);
  const check = () => {
    if (!twin.current) return false;
    const box = widthOf(shown.current);
    const widest = widthOf(twin.current);
    if (box === 0 || widest === 0) return false;
    if (widest > box + SLACK) whole.fit(box / widest);
    return true;
  };
  useLayoutEffect(() => {
    check();
  });
  const drawn = (
    <RNText
      key={whole.fitted ?? 'grown'}
      ref={shown}
      style={[styles[tone ?? (QUIET.has(role) ? 'muted' : 'paper')], ...face, set]}
      allowFontScaling={false}
      {...(ONE_WORD.has(role) ? { numberOfLines: 1, adjustsFontSizeToFit: true } : null)}
      onTextLayout={
        watching
          ? (event) => {
              onTextLayout?.(event);
              const { lines } = event.nativeEvent;
              if (!check() && brokeWord(lines)) whole.less(lines);
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
const InText = createContext(false);
function wordsOf(children: ReactNode): string | null {
  const plain = (one: unknown) => typeof one === 'string' || typeof one === 'number';
  if (plain(children)) return String(children);
  return Array.isArray(children) && children.every(plain) ? children.join('') : null;
}
function piecesOf(words: string): string {
  return words
    .split(/\s+/)
    .flatMap((word) => word.match(/[^-‐–—]+[-‐–—]*|[-‐–—]+/g) ?? [])
    .join('\n');
}
const SLACK = 0.5;
function widthOf(
  node: {
    measure?: (answer: (x: number, y: number, width: number) => void) => void;
  } | null,
) {
  let width = 0;
  node?.measure?.((_x, _y, wide) => {
    width = wide;
  });
  return width;
}
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
const tornAt = (
  above: {
    text: string;
  },
  below: {
    text: string;
  },
) => !/[\s\-‐–—]$/.test(above.text) && !/^\s/.test(below.text);
function brokeWord(
  lines: readonly {
    text: string;
  }[],
): boolean {
  return lines.some((line, i) => i > 0 && tornAt(lines[i - 1], line));
}
function wholeAt(
  lines: readonly {
    text: string;
    width: number;
  }[],
  grown: number,
): number | undefined {
  const share = (
    line: {
      text: string;
      width: number;
    },
    piece: string,
  ) => (line.width * piece.length) / Math.max(1, line.text.trimEnd().length);
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
  return grown * Math.min(held, 0.95);
}
function useWhole(most: number, words: string | null) {
  const { fontScale, width } = useWindowDimensions();
  const here = `${fontScale} ${width}`;
  const full = Math.min(fontScale, most);
  const [held, setHeld] = useState<{
    here: string;
    words: typeof words;
    most: number;
  } | null>(null);
  const heldAt = (had: typeof held) =>
    had?.here === here && had.words === words && had.most < full ? had.most : null;
  const fitted = heldAt(held);
  const grown = fitted ?? full;
  const setTo = (next: number) => {
    if (grown > 1)
      setHeld((had) =>
        (heldAt(had) ?? full) === grown ? { here, words, most: Math.max(1, next) } : had,
      );
  };
  return {
    fitted,
    grown,
    less: (
      lines: readonly {
        text: string;
        width: number;
      }[],
    ) => {
      const next = wholeAt(lines, grown);
      if (next !== undefined) setTo(next);
    },
    fit: (share: number) => setTo(grown * share * 0.98),
  };
}
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
const FIT_INSET = 4;
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
}): {
  most: number | undefined;
  height: number;
} {
  const { fontSize, lineHeight } = type[role];
  const most = width > 0 ? Math.max(1, (width - FIT_INSET) / (fontSize * em)) : undefined;
  const grown = Math.min(fontScale, most ?? fontScale);
  return {
    most,
    height: fontScale > 1 ? Math.max(TAP, Math.ceil(lineHeight * grown) + FIT_INSET) : rest,
  };
}
const hidden = StyleSheet.create({
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
