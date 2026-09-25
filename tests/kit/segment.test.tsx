import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { expect, test } from 'vitest';

import { Segment } from '@/kit/segment';
import { allDifferent, story } from '@/kit/story';

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
  expect(shown).toContain('>Тема<');
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
const draw = async (node: ReactElement) => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(node));
  });
  return tree.root;
};

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
