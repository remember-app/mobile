import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { expect, test } from 'vitest';

import { rowHolds, Segment } from '@/kit/segment';
import { allDifferent, story } from '@/kit/story';
import { Text as KitText } from '@/kit/text';
import { setTheme, themes } from '@/theme';

/** Spec 7.3 — the choice of two or three, drawn as a row of pills inside one. */

mountsTrees();

const FACES = [
  { value: 'frames', label: 'Кадры' },
  { value: 'films', label: 'Ролики' },
  { value: 'people', label: 'Люди' },
] as const;

test('every value is on screen at once, and the chosen one is the only one filled', () => {
  const row = story(<Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />);
  for (const face of FACES) expect(row).toContain(face.label);
  // #0B0B12 on the chosen pill; the rest stay muted at #A4A1B2.
  expect(row).toContain('rgba(11,11,18,1.00)');
  expect(row).toContain('rgba(164,161,178,1.00)');
});

test('moving the choice moves the fill, and nothing else about the row', () => {
  allDifferent(
    Object.fromEntries(
      FACES.map((face) => [
        face.value,
        <Segment label="Лицо" options={FACES} value={face.value} onChange={() => {}} />,
      ]),
    ),
  );
});

test('the row is a radiogroup and each pill is a radio, so a switch reads as a switch', () => {
  const row = story(<Segment label="Лицо" options={FACES} value="films" onChange={() => {}} />);
  expect(row).toContain('role="radiogroup"');
  expect(row).toContain('aria-label="Лицо"');
  expect(row.match(/role="radio"/g)).toHaveLength(FACES.length);
});

test('the two grounds are each their own', () => {
  allDifferent({
    plain: <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />,
    inSheet: <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} onSurface />,
  });
});

test('the heading over the row can be spoken without being drawn, and the hint is read out', () => {
  const shown = story(<Segment label="Тема" options={FACES} value="frames" onChange={() => {}} />);
  const bare = story(
    <Segment label="Тема" options={FACES} value="frames" onChange={() => {}} hideLabel />,
  );
  // Drawn, it is the eyebrow every heading over a group is in the layout: caps, `muted`, a header —
  // «ФОРМАТ» on `MontageBuild` (TASK-384), not a 13 / 600 line in `paper`.
  expect(shown).toContain(
    story(
      <KitText role="eyebrow" tone="muted" accessibilityRole="header">
        ТЕМА
      </KitText>,
    ),
  );
  expect(bare).not.toContain('>ТЕМА<');
  expect(bare).not.toContain('>Тема<');
  expect(bare).toContain('aria-label="Тема"');

  const withHint = story(
    <Segment
      label="Тема"
      options={FACES}
      value="frames"
      onChange={() => {}}
      hint="Меняется сразу — этот экран и есть образец"
    />,
  );
  expect(withHint).toContain('Меняется сразу — этот экран и есть образец');
});

/**
 * Spec 7.3, detail 18 — row or column, off the words as they are drawn. A group is mounted, then told
 * what the phone would have told it: how wide its column is and how wide each word lays out.
 */
const trees: TestRenderer.ReactTestRenderer[] = [];
const draw = async (node: ReactElement) => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(node));
  });
  trees.push(tree);
  return tree.root;
};
/** Takes down what the test drew so far: two groups standing at once share one theme, and say so. */
const release = () =>
  act(async () => {
    for (const tree of trees.splice(0)) tree.unmount();
  });

const flat = <T,>(node: ReactTestInstance) => StyleSheet.flatten(node.props.style) as T;
const container = (root: ReactTestInstance) =>
  root.findAll((one) => one.type === View && one.props.accessibilityRole === 'radiogroup')[0];
const cells = (root: ReactTestInstance) => root.findAllByType(Pressable);
const shown = (root: ReactTestInstance) => cells(root).map((cell) => cell.findByType(Text));
/** The unseen copies each word is measured on. */
const rulers = (root: ReactTestInstance) =>
  root.findAll((one) => one.type === Text && typeof one.props.onLayout === 'function');

/** The column `width` wide, and each word `words` wide at the size of the moment. */
const lay = (root: ReactTestInstance, width: number, words: number[]) =>
  act(async () => {
    root
      .findAll((one) => one.type === View && typeof one.props.onLayout === 'function')[0]
      .props.onLayout({ nativeEvent: { layout: { width } } });
    for (const [at, ruler] of rulers(root).entries())
      ruler.props.onLayout({ nativeEvent: { layout: { width: words[at] } } });
  });

/**
 * Three to a row in a column 343 wide (375 less its margins): each cell is (343 − 10 − 8) / 3,
 * 108.3, and a word has that less 8 — 100.3.
 */
const THIRD = (343 - 10 - 8) / 3 - 8;

test('until its words are measured the group is not seen, so it never jumps between the two', async () => {
  const root = await draw(
    <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />,
  );
  expect(flat<ViewStyle>(container(root)).opacity).toBe(0);
  await lay(root, 343, [40, 50, 36]);
  expect(flat<ViewStyle>(container(root)).opacity).toBeUndefined();
  expect(flat<ViewStyle>(container(root)).flexDirection).toBe('row');
});

test('a row while every word fits whole in its cell with 4 to spare, a column from the first that does not', async () => {
  const root = await draw(
    <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />,
  );
  await lay(root, 343, [THIRD, 40, 40]);
  expect(flat<ViewStyle>(container(root)).flexDirection).toBe('row');
  await lay(root, 343, [THIRD + 0.1, 40, 40]);
  expect(flat<ViewStyle>(container(root)).flexDirection).toBe('column');
  // A narrower phone is the same word in less room.
  await lay(root, 303, [THIRD, 40, 40]);
  expect(flat<ViewStyle>(container(root)).flexDirection).toBe('column');
  // And the type set back down brings the row back.
  await lay(root, 343, [60, 40, 40]);
  expect(flat<ViewStyle>(container(root)).flexDirection).toBe('row');
});

test('stacked, the cells are the spec’s: 44 at least, 8 / 12 inside, 22 round the group and 18 round each', async () => {
  const root = await draw(
    <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />,
  );
  await lay(root, 343, [200, 40, 40]);
  expect(flat<ViewStyle>(container(root))).toMatchObject({
    flexDirection: 'column',
    borderRadius: 22,
    gap: 4,
    padding: 4,
  });
  for (const cell of cells(root)) {
    expect(flat<ViewStyle>(cell)).toMatchObject({
      minHeight: 44,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 18,
    });
    expect(flat<ViewStyle>(cell).flexBasis).toBeUndefined();
    // Nothing to grow out to 44 when the cell is 44 itself.
    expect(cell.props.hitSlop).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  }
  for (const word of shown(root))
    expect(flat<TextStyle>(word)).toMatchObject({
      fontSize: 14,
      lineHeight: 18,
      textAlign: 'center',
    });
});

test('in the row a cell is an equal part, drawn at 40 and felt at 44, inside its 50 of container', async () => {
  const root = await draw(
    <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />,
  );
  await lay(root, 343, [40, 40, 40]);
  for (const cell of cells(root)) {
    expect(flat<ViewStyle>(cell)).toMatchObject({ flexGrow: 1, flexBasis: 0, minHeight: 40 });
    expect(cell.props.hitSlop).toEqual({ left: 0, right: 0, top: 2, bottom: 2 });
  }
});

test('no word is ever cut to one line or given an ellipsis, and none grows past twice its size', async () => {
  const root = await draw(
    <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />,
  );
  for (const words of [
    [40, 40, 40],
    [200, 40, 40],
  ]) {
    await lay(root, 343, words);
    for (const word of [...shown(root), ...rulers(root)]) {
      expect(word.props.numberOfLines).toBeUndefined();
      expect(word.props.maxFontSizeMultiplier).toBe(2);
    }
  }
});

test('every word is set at 14 however long it is, and at 13 only where the group asks for it', async () => {
  const long = [
    { value: 'landscape', label: 'Горизонтальный' },
    { value: 'portrait', label: 'Вертикальный' },
  ] as const;
  const format = await draw(
    <Segment label="Формат" options={long} value="portrait" onChange={() => {}} />,
  );
  await lay(format, 343, [114, 95]);
  for (const word of [...shown(format), ...rulers(format)])
    expect(flat<TextStyle>(word).fontSize).toBe(14);

  const theme = await draw(
    <Segment label="Тема" small options={FACES} value="frames" onChange={() => {}} />,
  );
  for (const word of [...shown(theme), ...rulers(theme)])
    expect(flat<TextStyle>(word).fontSize).toBe(13);
  await lay(theme, 343, [200, 40, 40]);
  for (const word of shown(theme))
    expect(flat<TextStyle>(word)).toMatchObject({ fontSize: 13, lineHeight: 17 });
});

test('picking a value moves the fill and never the group from one view to the other', async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  const at = (value: 'frames' | 'films') => (
    <Segment label="Лицо" options={FACES} value={value} onChange={() => {}} />
  );
  await act(async () => {
    tree = mounted(TestRenderer.create(at('frames')));
  });
  await lay(tree.root, 343, [200, 40, 40]);
  await act(async () => tree.update(at('films')));
  expect(flat<ViewStyle>(container(tree.root)).flexDirection).toBe('column');
  expect(cells(tree.root).map((cell) => cell.props.accessibilityState.checked)).toEqual([
    false,
    true,
    false,
  ]);
});

test('row or column, it reads out the same: a named radiogroup of named radios, and the rulers not at all', async () => {
  const root = await draw(
    <Segment label="Лицо" options={FACES} value="films" onChange={() => {}} />,
  );
  for (const words of [
    [40, 40, 40],
    [200, 40, 40],
  ]) {
    await lay(root, 343, words);
    expect(container(root).props.accessibilityLabel).toBe('Лицо');
    expect(
      cells(root).map((cell) => [cell.props.accessibilityRole, cell.props.accessibilityLabel]),
    ).toEqual(FACES.map((face) => ['radio', face.label]));
    expect(cells(root).map((cell) => cell.props.accessibilityState.checked)).toEqual([
      false,
      true,
      false,
    ]);
    const [hidden] = root.findAll(
      (one) =>
        one.type === View &&
        one.props.accessibilityElementsHidden === true &&
        one.props.importantForAccessibility === 'no-hide-descendants',
    );
    expect(rulers(hidden)).toHaveLength(FACES.length);
  }
});

/**
 * The spec's own figures for the room a word has in a row (spec 7.3, detail 18, «Замер»): the cell
 * less its 4 a side, for three words and for two, on the columns of 375, 360 and 320 — 343, 328 and
 * 288 wide. A word of exactly that stands; a hair more makes the group a column.
 */
test.each([
  [343, 3, 100.33],
  [328, 3, 95.33],
  [288, 3, 82],
  [343, 2, 156.5],
  [328, 2, 149],
  [288, 2, 129],
])(
  'in a column %s wide, %s words stand in a row up to %s each and not a hair past it',
  (width, count, most) => {
    const words = (word: number) => Array.from({ length: count }, () => word);
    expect(rowHolds(width, words(most - 0.01))).toBe(true);
    expect(rowHolds(width, words(most + 0.01))).toBe(false);
    // The widest of them decides, wherever it stands.
    expect(rowHolds(width, [...words(most - 1).slice(1), most + 1])).toBe(false);
  },
);

test('a column with no width, or none left, holds nothing in a row', () => {
  expect(rowHolds(0, [10, 10])).toBe(false);
  expect(rowHolds(-20, [10, 10])).toBe(false);
  expect(rowHolds(10, [0, 0, 0])).toBe(false);
});

test('a group is drawn only once its column and every one of its words are measured', async () => {
  const seen = async (width: number | null, words: (number | null)[]) => {
    const root = await draw(
      <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />,
    );
    await act(async () => {
      if (width !== null)
        root
          .findAll((one) => one.type === View && typeof one.props.onLayout === 'function')[0]
          .props.onLayout({ nativeEvent: { layout: { width } } });
      for (const [at, ruler] of rulers(root).entries())
        if (words[at] !== null)
          ruler.props.onLayout({ nativeEvent: { layout: { width: words[at] } } });
    });
    const shown = flat<ViewStyle>(container(root)).opacity !== 0;
    await release();
    return shown;
  };
  // The words alone are not enough, nor the column alone, nor a column of none, nor most of the words.
  expect(await seen(null, [40, 40, 40])).toBe(false);
  expect(await seen(343, [null, null, null])).toBe(false);
  expect(await seen(0, [40, 40, 40])).toBe(false);
  expect(await seen(343, [40, 40, null])).toBe(false);
  expect(await seen(343, [null, 40, 40])).toBe(false);
  expect(await seen(343, [40, 40, 40])).toBe(true);
});

test('a press hands the value of the pill pressed, in a row and in a column, however fast they come', async () => {
  const chosen: string[] = [];
  const root = await draw(
    <Segment label="Лицо" options={FACES} value="films" onChange={(value) => chosen.push(value)} />,
  );
  for (const words of [
    [40, 40, 40],
    [200, 40, 40],
  ]) {
    await lay(root, 343, words);
    chosen.length = 0;
    // Three pills in a breath, the chosen one and one of the others twice: every press is heard.
    await act(async () => {
      for (const at of [0, 1, 2, 2, 0]) cells(root)[at].props.onPress();
    });
    expect(chosen).toEqual(['frames', 'films', 'people', 'people', 'frames']);
  }
});

test('the group’s hint is read out with it, and the unseen words stand out of the way and out of every press', async () => {
  const root = await draw(
    <Segment
      label="Лицо"
      options={FACES}
      value="films"
      onChange={() => {}}
      hint="Меняется сразу"
    />,
  );
  await lay(root, 343, [40, 40, 40]);
  expect(container(root).props.accessibilityHint).toBe('Меняется сразу');
  const [hidden] = root.findAll(
    (one) => one.type === View && one.props.accessibilityElementsHidden === true,
  );
  expect(hidden.props.pointerEvents).toBe('none');
  // Laid out for the measure but never drawn: absolute, so no gap of the group is spent on it, and
  // clear.
  expect(flat<ViewStyle>(hidden)).toMatchObject({ position: 'absolute', opacity: 0 });
});

test('the row is a pill of 4 and 4 inside a hairline, its cells 4 in from each side of their word', async () => {
  const root = await draw(
    <Segment label="Лицо" options={FACES} value="films" onChange={() => {}} />,
  );
  await lay(root, 343, [40, 40, 40]);
  expect(flat<ViewStyle>(container(root))).toMatchObject({
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  });
  for (const cell of cells(root)) expect(flat<ViewStyle>(cell).paddingHorizontal).toBe(4);
  // Stacked, the hairline and the 4 stay and only the corners and the cells change.
  await lay(root, 343, [200, 40, 40]);
  expect(flat<ViewStyle>(container(root))).toMatchObject({ borderWidth: 1, padding: 4, gap: 4 });
});

/** The tokens the group is drawn in, read off the theme it stands in and not off the colour it happened to be. */
test.each(['dark', 'light'] as const)(
  'in the %s theme the chosen pill is paper with ink on it, the rest muted, and the ground is surface — ink in a sheet',
  async (name) => {
    await setTheme(name);
    try {
      const { color } = themes[name];
      for (const stacked of [false, true]) {
        const words = stacked ? [200, 40, 40] : [40, 40, 40];
        const sheet = await draw(
          <Segment label="Лицо" options={FACES} value="films" onChange={() => {}} onSurface />,
        );
        await lay(sheet, 343, words);
        expect(flat<ViewStyle>(container(sheet)).backgroundColor).toBe(color.ink);
        await release();
        const plain = await draw(
          <Segment label="Лицо" options={FACES} value="films" onChange={() => {}} />,
        );
        await lay(plain, 343, words);
        expect(flat<ViewStyle>(container(plain))).toMatchObject({
          backgroundColor: color.surface,
          borderColor: color.line,
        });
        expect(cells(plain).map((cell) => flat<ViewStyle>(cell).backgroundColor)).toEqual([
          undefined,
          color.paper,
          undefined,
        ]);
        expect(shown(plain).map((word) => flat<TextStyle>(word).color)).toEqual([
          color.muted,
          color.ink,
          color.muted,
        ]);
        // On the web the one under the cursor lights up on its way to being picked; the chosen one
        // stays as it is.
        await act(async () => {
          cells(plain)[0].props.onHoverIn();
          cells(plain)[1].props.onHoverIn();
        });
        expect(shown(plain).map((word) => flat<TextStyle>(word).color)).toEqual([
          color.paper,
          color.ink,
          color.muted,
        ]);
        await release();
      }
    } finally {
      await setTheme('dark');
    }
  },
);

test('the words change with the language and the group decides again off the new ones', async () => {
  const at = (labels: readonly string[]) => (
    <Segment
      label="Лицо"
      options={FACES.map((face, i) => ({ value: face.value, label: labels[i] }))}
      value="frames"
      onChange={() => {}}
    />
  );
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(at(['Кадры', 'Ролики', 'Люди'])));
  });
  await lay(tree.root, 343, [40, 50, 36]);
  expect(flat<ViewStyle>(container(tree.root)).flexDirection).toBe('row');
  await act(async () => tree.update(at(['Frames', 'Movies', 'People'])));
  expect(shown(tree.root).map((word) => word.props.children)).toEqual([
    'Frames',
    'Movies',
    'People',
  ]);
  // The new words lay themselves out and say how wide they are: one is too wide for its cell.
  await lay(tree.root, 343, [45, 130, 40]);
  expect(flat<ViewStyle>(container(tree.root)).flexDirection).toBe('column');
  expect(cells(tree.root).map((cell) => cell.props.accessibilityLabel)).toEqual([
    'Frames',
    'Movies',
    'People',
  ]);
});
