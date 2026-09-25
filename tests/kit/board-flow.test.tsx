import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { ReactElement, ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { expect, test } from 'vitest';

import { ActionBar, Board } from '@/kit/bars';
import bars from '@/kit/bars.tsx?raw';
import { Button } from '@/kit/button';
import { Text } from '@/kit/text';
import { type } from '@/theme';

/**
 * Spec 7.1 and TASK-372 — the board is where every screen scrolls. The bar and the bottom layer
 * stand still while they and one line of the body fit it; when they do not — the smallest phone at
 * the largest system type — the whole board scrolls as one, and nothing is left past the edge.
 */

mountsTrees();

/** What the phone reports once it has laid a view out. */
const laidOut = (node: ReactTestInstance, height: number) =>
  act(() => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 375, height } } }));

/** One line of the body, at the system's own size — what has to be left for the body at least. */
const LINE = type.body.lineHeight;

async function mount(board: ReactElement) {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = mounted(TestRenderer.create(board));
  });
  const root = (tree as TestRenderer.ReactTestRenderer).root;
  /** The block the board measures around a node: the nearest one it listens to the layout of. */
  const block = (node: ReactTestInstance) => {
    let up = node.parent;
    while (up && typeof up.props.onLayout !== 'function') up = up.parent;
    return up as ReactTestInstance;
  };
  const words = (text: string) =>
    root.find((one) => one.type === Text && one.props.children === text);
  return { root, block, words };
}

test('while they fit, the bar and the bottom layer stand still and only the body scrolls', async () => {
  const { root, block, words } = await mount(
    <Board
      bar={<Text>Шапка</Text>}
      footer={
        <ActionBar>
          <Button variant="primary" label="Дальше" />
        </ActionBar>
      }
    >
      <Text>Тело</Text>
    </Board>,
  );
  const scroll = () => root.findByType(ScrollView);
  const inScroll = (text: string) => scroll().findAll((one) => one.props.children === text);

  // Before anything is measured the board stands as drawn.
  expect(inScroll('Тело')).not.toHaveLength(0);
  expect(inScroll('Шапка')).toHaveLength(0);
  expect(scroll().findAllByType(Button)).toHaveLength(0);

  // A phone the three of them fit on: the body is the window between the bar and the layer.
  await laidOut(block(words('Шапка')), 100);
  await laidOut(block(root.findByType(Button)), 120);
  await laidOut(scroll(), 400);
  expect(inScroll('Шапка')).toHaveLength(0);
  expect(scroll().findAllByType(Button)).toHaveLength(0);

  // The bar and the layer have left the body less than a line: the whole board scrolls as one.
  await laidOut(scroll(), LINE - 1);
  expect(inScroll('Шапка')).not.toHaveLength(0);
  expect(scroll().findAllByType(Button)).toHaveLength(1);
  expect(inScroll('Тело')).not.toHaveLength(0);

  // Scrolling as one, the window is the whole board; room for both and a line stands them back up.
  await laidOut(scroll(), 100 + 120 + LINE - 1);
  expect(inScroll('Шапка')).not.toHaveLength(0);
  await laidOut(scroll(), 100 + 120 + LINE);
  expect(inScroll('Шапка')).toHaveLength(0);
  expect(scroll().findAllByType(Button)).toHaveLength(0);
});

test('a body that is a list is handed the bar and the layer to scroll at its head and foot', async () => {
  const edges: { head: ReactNode; foot: ReactNode }[] = [];
  const { root, block, words } = await mount(
    <Board
      bar={<Text>Шапка</Text>}
      footer={<Text>Низ</Text>}
      list={(given) => {
        edges.push(given);
        return (
          <View>
            {given.head}
            <Text>Список</Text>
            {given.foot}
          </View>
        );
      }}
    >
      <Text>Поверх</Text>
    </Board>,
  );
  // The list holds its own scroll: the board draws none of its own around it.
  expect(root.findAllByType(ScrollView)).toHaveLength(0);
  // What floats over a list is still drawn — it is what `children` is for once the body is a list.
  expect(words('Поверх')).toBeDefined();
  expect(edges.at(-1)).toEqual({ head: null, foot: null });

  // The window the list was left is under a line: the bar and the layer go into it.
  await laidOut(block(words('Шапка')), 300);
  await laidOut(block(words('Низ')), 300);
  await laidOut(block(words('Список')), LINE - 1);
  expect(edges.at(-1)?.head).not.toBeNull();
  expect(edges.at(-1)?.foot).not.toBeNull();
  expect(root.findAll((one) => one.type === Text && one.props.children === 'Шапка')).toHaveLength(
    1,
  );
});

test('the keyboard is given way to once, by the board, for every screen', () => {
  // Android resizes the window for the keyboard itself; iOS is told here and nowhere else — a pinned
  // bottom layer rides up over the keyboard with the button on it, and a field in a body scrolls.
  expect(bars).toContain("behavior={Platform.OS === 'ios' ? 'padding' : undefined}");
  expect(bars).toContain('keyboardShouldPersistTaps="handled"');
  // A body that fits neither scrolls nor bounces (spec 1, rule 5).
  expect(bars).toContain('alwaysBounceVertical={false}');
});
