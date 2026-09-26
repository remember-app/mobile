import { beforeAll, expect, test, vi } from 'vitest';

// The system's type size, turned by the test; the system's own size unless a test says otherwise.
const { phone } = vi.hoisted(() => ({ phone: { fontScale: 1 } }));

vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: 375, height: 667, scale: 2, fontScale: phone.fontScale }),
  };
});

import { fontFile, wordWidth } from '@tests/helpers/font';
import type { ReactElement } from 'react';
import { Text as RNText, StyleSheet, type TextStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { allDifferent, story } from '@/kit/story';
import {
  balanced,
  fitCell,
  HEADING_MOST,
  HiddenLabel,
  Text,
  type TextTone,
  TYPE_MOST,
  type TypeRole,
} from '@/kit/text';
import { setTheme, type } from '@/theme';

/** Spec 3 — every type role and every tone words can be read in, drawn once each. */

beforeAll(async () => {
  await setTheme('dark');
});

const ROLES = Object.keys(type) as TypeRole[];

test('every role in the scale is a role the text can actually be asked for', () => {
  allDifferent(
    Object.fromEntries(ROLES.map((role) => [role, <Text role={role}>Воспоминания</Text>])),
  );
});

test('the two families are the two families, and each weight is its own loaded face', () => {
  // Spec 3: headings in Unbounded, everything else in Onest — and a weight is a family name here,
  // because asking a single-weight loaded face for a `fontWeight` makes Android synthesise one.
  for (const role of ROLES) {
    expect(type[role].fontFamily, role).toMatch(/^(Unbounded|Onest)_/);
    expect(type[role], role).not.toHaveProperty('fontWeight');
  }
  expect(type.hero.fontFamily).toBe('Unbounded_700Bold');
  expect(type.body.fontFamily).toBe('Onest_400Regular');
});

test('words are read in paper unless they are asked for in something else', () => {
  // React Native inherits no colour at all and falls back to black, so a role without one is black
  // on ink — invisible. This is the one place that pairs the two.
  expect(story(<Text>Абзац</Text>)).toBe(story(<Text tone="paper">Абзац</Text>));

  const tones: TextTone[] = [
    'paper',
    'muted',
    'faint',
    'accent',
    'spark',
    'sparkInk',
    'danger',
    'onFill',
    'quote',
  ];
  allDifferent(Object.fromEntries(tones.map((tone) => [tone, <Text tone={tone}>Абзац</Text>])));
});

test('the eyebrow is always muted, asked or not (spec 3, 10.11)', () => {
  // «`eyebrow` — всегда `muted`, в контактах и приглашении тоже»: the role has no other colour, so
  // an eyebrow written without a tone — «ИЗ КОНТАКТОВ» on `SheetInvite` — is not `paper`.
  expect(story(<Text role="eyebrow">ИЗ КОНТАКТОВ</Text>)).toBe(
    story(
      <Text role="eyebrow" tone="muted">
        ИЗ КОНТАКТОВ
      </Text>,
    ),
  );
  expect(story(<Text role="eyebrow">ИЗ КОНТАКТОВ</Text>)).not.toBe(
    story(
      <Text role="eyebrow" tone="paper">
        ИЗ КОНТАКТОВ
      </Text>,
    ),
  );
});

test('meta and note bring muted with them, and spec 10.1 is why', () => {
  // `faint` is 3.8 : 1 on ink and the layout had it under running text; 10.1 settles that every
  // readable secondary line takes `muted` and `faint` keeps what is unavailable or decorative.
  expect(story(<Text role="meta">12 сентября</Text>)).toBe(
    story(
      <Text role="meta" tone="muted">
        12 сентября
      </Text>,
    ),
  );
  expect(story(<Text role="note">Чем точнее, тем меньше сюрпризов</Text>)).toBe(
    story(
      <Text role="note" tone="muted">
        Чем точнее, тем меньше сюрпризов
      </Text>,
    ),
  );
  // And `faint` is still reachable where the layout really means unavailable.
  expect(story(<Text role="meta">3 из 61</Text>)).not.toBe(
    story(
      <Text role="meta" tone="faint">
        3 из 61
      </Text>,
    ),
  );
});

test('every figure on screen is tabular, so a counter never dances', () => {
  expect(type.meta.fontVariant).toEqual(['tabular-nums']);
});

test('a label the eye does not need is still there for a screen reader', () => {
  // Spec 7.9: clipped to 1 × 1 rather than removed, because a placeholder is not a label.
  const hidden = story(<HiddenLabel>Ник</HiddenLabel>);
  expect(hidden).toContain('Ник');
  // Clipped rather than styled out of the way: nothing it shares with a line that is meant to be
  // read, which is the whole difference between a hidden label and an invisible one.
  expect(hidden).not.toBe(story(<Text role="label">Ник</Text>));
});

/** How the name on a cover is set: its words off the font file, Unbounded 700 at 26 and −0.78. */
const COVER = fontFile('@expo-google-fonts/unbounded/700Bold/Unbounded_700Bold.ttf');
const coverWide = (words: string, scale = 1) =>
  (wordWidth(COVER, words, Number(type.displayCover.fontSize)) +
    Number(type.displayCover.letterSpacing) * [...words].length) *
  scale;

/** The lines words fall into at `width`, each filled before the next is begun. */
function setIn(words: readonly string[], width: number, scale = 1): string[] {
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last !== undefined && coverWide(`${last} ${word}`, scale) <= width)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

test('the name on a cover is balanced: its lines as even as its words allow (spec 3)', () => {
  // TASK-398 (R'7). `Main.json` e14: «Свадьба Лизы и Марка» with `text-wrap: balance` in a block of
  // 322 — «Свадьба» over «Лизы и Марка», its text 231.67 wide. Filled line by line, the same words go
  // «Свадьба Лизы и» over «Марка», and did.
  const words = 'Свадьба Лизы и Марка'.split(' ');
  const space = coverWide('Свадьба Лизы') - coverWide('Свадьба') - coverWide('Лизы');
  expect(setIn(words, 322)).toEqual(['Свадьба Лизы и', 'Марка']);
  const even = balanced(
    words.map((word) => coverWide(word)),
    space,
    322,
    3,
  );
  expect(even?.lines).toBe(2);
  const width = even?.width ?? 322;
  // The kit sets it a point wider than found, for the rounding of what it measured.
  for (const room of [width, width + 1])
    expect(setIn(words, room)).toEqual(['Свадьба', 'Лизы и Марка']);
  expect(Math.abs(width - 231.67)).toBeLessThan(3);
});

test('a balanced name never takes more lines than it would, nor a word less room than it needs', () => {
  const words = 'Свадьба Лизы и Марка'.split(' ');
  const measure = (scale: number) => ({
    widths: words.map((word) => coverWide(word, scale)),
    space:
      coverWide('Свадьба Лизы', scale) - coverWide('Свадьба', scale) - coverWide('Лизы', scale),
  });
  // On large type (the heading's ceiling, ×1.29) the name takes more lines, and stays as many.
  const grown = measure(HEADING_MOST.displayCover ?? 1);
  const even = balanced(grown.widths, grown.space, 322, 3);
  const full = setIn(words, 322, HEADING_MOST.displayCover);
  expect(even?.lines).toBe(full.length);
  expect(setIn(words, even?.width ?? 0, HEADING_MOST.displayCover)).toHaveLength(full.length);
  expect(even?.width).toBeGreaterThanOrEqual(Math.max(...grown.widths));
  // Nothing to even out: one line, a word wider than the room, more lines than are shown.
  const plain = measure(1);
  expect(balanced(plain.widths, plain.space, 1000)).toBeUndefined();
  expect(balanced(plain.widths, plain.space, 100)).toBeUndefined();
  expect(balanced(plain.widths, plain.space, 322, 1)).toBeUndefined();
});

test('a balanced text is the words once, read out once', () => {
  // The measures laid out beside it are unseen and never read out: the name is said once.
  const name = story(
    <Text role="displayCover" balance numberOfLines={3}>
      Свадьба Лизы и Марка
    </Text>,
  );
  expect(name.match(/>Свадьба Лизы и Марка</g)).toHaveLength(1);
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <Text role="displayCover" balance>
        Свадьба Лизы и Марка
      </Text>,
    );
  });
  const unseen = tree.root.findAll(
    (node) =>
      node.props.accessibilityElementsHidden === true &&
      node.props.importantForAccessibility === 'no-hide-descendants',
  );
  expect(unseen.length).toBeGreaterThan(0);
  const measures = unseen[0].findAllByType(RNText).map((one) => one.props.children);
  expect(measures).toEqual(['Свадьба', 'Лизы', 'и', 'Марка', 'Свадьба Лизы']);
  // Each on one line, whatever the box the name stands in: held to the card, «Свадьба Лизы» on the
  // largest type came out wrapped and as wide as the card — a space of 4.5 between the words, and
  // the name balanced a line longer than counted (TASK-406).
  expect(StyleSheet.flatten(unseen[0].props.style)).toMatchObject({
    width: 4096,
    alignItems: 'flex-start',
  });
  act(() => tree.unmount());
  // One word has nothing to balance, and is the plain text.
  expect(
    story(
      <Text role="displayCover" balance>
        Свадьба
      </Text>,
    ),
  ).toBe(story(<Text role="displayCover">Свадьба</Text>));
});

test('words in a cell the layout fixes grow as far as the cell holds them, and the cell grows down', () => {
  // A day of the calendar: two tabular figures in a 40 circle, 15 / 22 (TASK-372).
  const day = { role: 'bodySm', em: 1.35, rest: 40 } as const;
  // At the system's own size the cell is the layout's 40, whatever could be held back.
  expect(fitCell({ ...day, fontScale: 1, width: 40 }).height).toBe(40);
  // AX5 on the zoomed iPhone SE: the column is 37 wide, so the figures stop where two still fit…
  const tight = fitCell({ ...day, fontScale: 3.571, width: 37.4 });
  const most = tight.most ?? Number.POSITIVE_INFINITY;
  expect(15 * most * 1.35).toBeLessThanOrEqual(37.4 - 4 + 1e-9);
  expect(most).toBeLessThan(3.571);
  // …and the row grows under them instead, never under the 44 a finger needs.
  expect(tight.height).toBeGreaterThanOrEqual(44);
  expect(tight.height).toBeGreaterThanOrEqual(22 * most);
  // A cell with room to spare holds nothing back: the type grows as the phone asks.
  const roomy = fitCell({ ...day, fontScale: 1.2, width: 200 });
  expect(roomy.most).toBeGreaterThan(1.2);
  expect(roomy.height).toBe(Math.max(44, Math.ceil(22 * 1.2) + 4));
  // Not measured yet: nothing is held, and the cell is as tall as the type it will hold.
  expect(fitCell({ ...day, fontScale: 2, width: 0 })).toEqual({ most: undefined, height: 48 });
});

/** What the kit hands the platform's own text for one role, on a phone at `fontScale`. */
function drawnAs(text: ReactElement, fontScale = 1) {
  phone.fontScale = fontScale;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(text);
  });
  const { props } = tree.root.findAllByType(RNText)[0];
  act(() => tree.unmount());
  phone.fontScale = 1;
  return props;
}

/** How many times its role's own size the platform is told to draw a text — and nothing more. */
function grownAs(text: ReactElement, fontScale: number) {
  const props = drawnAs(text, fontScale);
  // The platform does not grow it on top: the size handed over is the size drawn.
  expect(props.allowFontScaling).toBe(false);
  expect(props.maxFontSizeMultiplier).toBeUndefined();
  const role = (text.props as { role?: TypeRole }).role ?? 'body';
  const drawn = StyleSheet.flatten(props.style) as TextStyle;
  const by = (drawn.fontSize ?? 0) / Number(type[role].fontSize);
  if (type[role].lineHeight !== undefined)
    expect(drawn.lineHeight, role).toBeCloseTo(Number(type[role].lineHeight) * by, 5);
  return by;
}

test('every role grows with the system type only as far as its ceiling, and a caller can say less', () => {
  // TASK-377: the numbers themselves are measured in `large-type.test.ts`; here, that each role
  // gets its own — and that nothing is left to grow as far as the phone asks.
  for (const role of ROLES)
    expect(grownAs(<Text role={role}>Слово</Text>, 3.571), role).toBeCloseTo(
      HEADING_MOST[role] ?? TYPE_MOST,
      5,
    );
  expect(grownAs(<Text role="body">Абзац</Text>, 3.571)).toBeCloseTo(2, 5);
  expect(grownAs(<Text role="hero">Remember</Text>, 3.571)).toBeCloseTo(1.13, 5);
  // Under its ceiling a role grows as far as the phone asks, and shrinks with it below its size.
  expect(grownAs(<Text role="body">Абзац</Text>, 1.353)).toBeCloseTo(1.353, 5);
  expect(grownAs(<Text role="body">Абзац</Text>, 0.823)).toBeCloseTo(0.823, 5);
  // A cell that measured its own room says so, and is heard.
  expect(grownAs(<Text maxFontSizeMultiplier={1.4}>12</Text>, 3.571)).toBeCloseTo(1.4, 5);
});

test('the size a text is drawn at is in its props, so a change of the system’s type reaches every text', () => {
  // TASK-406. React Native keys its measured text on the size and not the cap, and a text whose
  // props stayed the same through a change of the system's type was attached again, by React's next
  // commit, as the node laid out at the old one: on the iPhone SE turned from AX5 to L with the
  // app open, the finished film's tiles and stages stayed as tall as at AX5 around words drawn at L.
  // So the platform scales nothing, and every step of the system's type is another size handed over.
  const at = (fontScale: number) =>
    StyleSheet.flatten(drawnAs(<Text role="meta">Проявляем…</Text>, fontScale).style) as TextStyle;
  const sizes = [0.823, 1, 1.118, 1.353, 1.786, 2.143, 3.571].map((scale) => at(scale).fontSize);
  // Every step up to the ceiling a size of its own; the steps past it all at the ceiling.
  expect(new Set(sizes.slice(0, 5)).size).toBe(5);
  expect(sizes[5]).toBe(sizes[6]);
  expect(sizes[6]).toBeCloseTo(Number(type.meta.fontSize) * TYPE_MOST, 5);
  // At the system's own size the words are the role's, as drawn.
  expect(at(1)).toMatchObject({ fontSize: type.meta.fontSize, lineHeight: type.meta.lineHeight });
});

test('the product’s name is one line that shrinks to its room, and nothing else is', () => {
  // «Remember» is one word: on a phone narrower than the one its ceiling was measured on, it gets
  // smaller rather than broken — «Remem» on one line and «ber» on the next was the defect.
  for (const role of ['hero', 'heroNarrow'] as const) {
    const props = drawnAs(<Text role={role}>Remember</Text>);
    expect(props.numberOfLines, role).toBe(1);
    expect(props.adjustsFontSizeToFit, role).toBe(true);
  }
  const heading = drawnAs(<Text role="display">Как смонтировать этот ролик</Text>);
  expect(heading.numberOfLines).toBeUndefined();
  expect(heading.adjustsFontSizeToFit).toBeUndefined();
});

test('a cell is the layout’s own at the system’s size or smaller, and never below a finger from the first size up', () => {
  const day = { role: 'bodySm', em: 1.35, rest: 40 } as const;
  // Smaller than the system's default is the layout's cell too, whatever room the column has.
  for (const fontScale of [0.5, 0.85, 1])
    for (const width of [0, 10, 37.4, 400])
      expect(fitCell({ ...day, fontScale, width }).height, `×${fontScale} in ${width}`).toBe(40);
  // The first hair past the system's size is a 44 at least, and the tightest cell keeps to it.
  for (const width of [0, 20, 37.4, 400])
    expect(
      fitCell({ ...day, fontScale: 1.0001, width }).height,
      `in ${width}`,
    ).toBeGreaterThanOrEqual(44);
});

test('the type is held only to what the cell holds and never below the system’s own size, an unmeasured cell holds nothing', () => {
  const day = { role: 'bodySm', em: 1.35, rest: 40 } as const;
  // A column too narrow for even one size of it still shows the size the person has: it is the
  // cell that has to give, and the floor is the type's, not the cell's.
  expect(fitCell({ ...day, fontScale: 3, width: 10 }).most).toBe(1);
  expect(fitCell({ ...day, fontScale: 3, width: 4 }).most).toBe(1);
  // Nothing measured is nothing held — a width of nothing, and a width less than nothing.
  for (const width of [0, -1, -37.4])
    expect(fitCell({ ...day, fontScale: 3, width }).most).toBeUndefined();
  // Held to the column less 4, in em of the role's own size: 60 leaves 56 for 15 × 1.35 a size.
  expect(fitCell({ ...day, fontScale: 3.571, width: 60 }).most).toBeCloseTo(56 / (15 * 1.35), 6);
});

test('the cell grows down by the line the held type takes, rounded up, and 4 more — 44 at the least', () => {
  const day = { role: 'bodySm', em: 1.35, rest: 40 } as const;
  // Room to spare: the type is the system's own, 22 × 3.571 = 78.56, so 79 and 4.
  expect(fitCell({ ...day, fontScale: 3.571, width: 200 }).height).toBe(83);
  // Held to ×2.765 in a column of 60: 22 × 2.765 = 60.8, so 61 and 4 — not the 83 the system asked for.
  expect(fitCell({ ...day, fontScale: 3.571, width: 60 }).height).toBe(65);
  // Held to ×1.65 in the zoomed SE's 37.4: 37 and 4 is 41, and a finger wants 44.
  expect(fitCell({ ...day, fontScale: 3.571, width: 37.4 }).height).toBe(44);
});
