import { expect, test, vi } from 'vitest';

// The phone, turned by the test: its window, the type size the person set and the status line. The
// board decides by them whether the bar and the bottom layer stand still.
const { phone } = vi.hoisted(() => ({ phone: { height: 667, fontScale: 1, top: 0 } }));

vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({
      width: 375,
      height: phone.height,
      scale: 2,
      fontScale: phone.fontScale,
    }),
    // The plain container `vitest.setup.ts` makes of it: this mock replaces that one, it does not add.
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: phone.top, right: 0, bottom: 0, left: 0 }),
}));

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { cloneElement, type ReactElement, type ReactNode, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';

import { ActionBar, Board } from '@/kit/bars';
import { Button } from '@/kit/button';
import { Sheet } from '@/kit/sheet';
import { Text } from '@/kit/text';
import { setTheme, themes, type } from '@/theme';

/**
 * Spec 7.1 and TASK-372 — the board is where every screen scrolls. The bar and the bottom layer
 * stand still while they and one line of the body fit the window; when they do not — the smallest
 * phone at the largest system type — the whole board scrolls as one, and nothing is left past the
 * edge.
 */

mountsTrees();

/** What the phone reports once it has laid a view out. */
const laidOut = (node: ReactTestInstance, height: number) =>
  act(() => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 375, height } } }));

/** One line of the body, at the system's own size — what has to be left for the body at least. */
const LINE = type.body.lineHeight;

async function mount(board: ReactElement) {
  Object.assign(phone, { height: 667, fontScale: 1, top: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(board));
  });
  const root = tree.root;
  /** The block the board measures around a node: the nearest one it listens to the layout of. */
  const block = (node: ReactTestInstance) => {
    let up = node.parent;
    while (up && typeof up.props.onLayout !== 'function') up = up.parent;
    return up as ReactTestInstance;
  };
  const words = (text: string) =>
    root.find((one) => one.type === Text && one.props.children === text);
  /** The same board in a window this tall — a phone turned, a smaller one, another type size. */
  const windowOf = (height: number, over: Partial<typeof phone> = {}) => {
    Object.assign(phone, { height }, over);
    return act(async () => tree.update(cloneElement(board)));
  };
  return { root, block, words, windowOf, tree };
}

test('while they fit, the bar and the bottom layer stand still and only the body scrolls', async () => {
  const { root, block, words, windowOf } = await mount(
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
  expect(inScroll('Шапка')).toHaveLength(0);
  expect(scroll().findAllByType(Button)).toHaveLength(0);

  // The bar and the layer leave the body less than a line: the whole board scrolls as one.
  await windowOf(100 + 120 + LINE - 1);
  expect(inScroll('Шапка')).not.toHaveLength(0);
  expect(scroll().findAllByType(Button)).toHaveLength(1);
  expect(inScroll('Тело')).not.toHaveLength(0);

  // Room for both and a line stands them back up.
  await windowOf(100 + 120 + LINE);
  expect(inScroll('Шапка')).toHaveLength(0);
  expect(scroll().findAllByType(Button)).toHaveLength(0);
});

test('the keyboard never moves the bar or the bottom layer, so a field in either keeps it', async () => {
  const { root } = await mount(
    <Board bar={<Text>Шапка</Text>} footer={<Text>Поле</Text>}>
      <Text>Тело</Text>
    </Board>,
  );
  // The keyboard takes the room between the two, and that room is nothing the board listens to:
  // moved into the scroll, a field would be drawn anew and the keyboard would go down with it.
  expect(root.findByType(ScrollView).props.onLayout).toBeUndefined();
});

test('a body that is a list is handed the bar and the layer to scroll at its head and foot', async () => {
  const edges: { head: ReactNode; foot: ReactNode }[] = [];
  const { root, block, words, windowOf } = await mount(
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

  // The window leaves the list under a line: the bar and the layer go into it.
  await laidOut(block(words('Шапка')), 300);
  await laidOut(block(words('Низ')), 300);
  await windowOf(600 + LINE - 1);
  expect(edges.at(-1)?.head).not.toBeNull();
  expect(edges.at(-1)?.foot).not.toBeNull();
  expect(root.findAll((one) => one.type === Text && one.props.children === 'Шапка')).toHaveLength(
    1,
  );
});

/**
 * A field that counts how many times it has been drawn from nothing and how many of it stand now:
 * a remount is the keyboard going down with it.
 */
const life = { started: 0, alive: 0 };
function Field() {
  useEffect(() => {
    life.started += 1;
    life.alive += 1;
    return () => {
      life.alive -= 1;
    };
  }, []);
  return <Text>Поле</Text>;
}

const screen = (over: Partial<Parameters<typeof Board>[0]> = {}) => (
  <Board bar={<Text>Шапка</Text>} footer={<Field />} {...over}>
    <Text>Тело</Text>
  </Board>
);

/** Where each piece of the screen stands in what was drawn, top to bottom. */
const order = (tree: TestRenderer.ReactTestRenderer, pieces = ['Шапка', 'Тело', 'Поле']) => {
  const drawn = JSON.stringify(tree.toJSON());
  return pieces
    .map((piece) => [piece, drawn.indexOf(piece)] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([piece]) => piece);
};

/** The window the bar (100), the layer (120) and `line` of body just fit. */
const fits = (line = LINE) => 100 + 120 + line;

/** A screen laid out by the phone: the bar 100 tall, the bottom layer 120. */
async function measured(board: ReactElement = screen()) {
  const it = await mount(board);
  await laidOut(it.block(it.words('Шапка')), 100);
  await laidOut(it.block(it.root.findByType(Field)), 120);
  const scroll = () => it.root.findByType(ScrollView);
  const inScroll = (text: string) => scroll().findAll((one) => one.props.children === text);
  /** Whether the bar and the layer stand outside the scroll. */
  const standing = () =>
    inScroll('Шапка').length === 0 && scroll().findAllByType(Field).length === 0;
  return { ...it, scroll, inScroll, standing };
}

test('the bar, the body and the bottom layer stand in that order, standing or scrolled alike', async () => {
  const it = await measured();
  await it.windowOf(fits());
  expect(it.standing()).toBe(true);
  expect(order(it.tree)).toEqual(['Шапка', 'Тело', 'Поле']);
  await it.windowOf(fits() - 1);
  expect(it.standing()).toBe(false);
  expect(order(it.tree)).toEqual(['Шапка', 'Тело', 'Поле']);
  // Scrolled, all three are the scroll's own: none is drawn twice, none is left outside it.
  for (const piece of ['Шапка', 'Тело']) expect(it.inScroll(piece)).not.toHaveLength(0);
  expect(it.scroll().findAllByType(Field)).toHaveLength(1);
  expect(it.root.findAllByType(Field)).toHaveLength(1);
  expect(
    it.root.findAll((one) => one.type === Text && one.props.children === 'Шапка'),
  ).toHaveLength(1);
});

test.each([
  [1, 0],
  [1, 47],
  [1.5, 0],
  [2, 47],
  [3.571, 0],
  [3.571, 47],
])(
  'at ×%s type under a status line %s high the bar and the layer stand while a line of the body is left',
  async (fontScale, top) => {
    // The line of the body grows with the type, and the status line is no room of the body's at all.
    const it = await measured();
    await it.windowOf(fits(LINE * fontScale) + top, { fontScale, top });
    expect(it.standing()).toBe(true);
    await it.windowOf(fits(LINE * fontScale) + top - 0.5, { fontScale, top });
    expect(it.standing()).toBe(false);
    // The board itself keeps clear of the status line either way.
    expect(StyleSheet.flatten(it.root.findByType(KeyboardAvoidingView).props.style)).toMatchObject({
      paddingTop: top,
    });
  },
);

test('the type size changed on the way moves the bar and the layer into the scroll and back out', async () => {
  const it = await measured();
  await it.windowOf(fits(LINE * 1.5) + 0.5);
  expect(it.standing()).toBe(true);
  await it.windowOf(fits(LINE * 1.5) + 0.5, { fontScale: 2 });
  expect(it.standing()).toBe(false);
  await it.windowOf(fits(LINE * 1.5) + 0.5, { fontScale: 1 });
  expect(it.standing()).toBe(true);
});

test('a window with no height has not been measured: the board stands as drawn, however big its pieces are', async () => {
  const it = await measured();
  await laidOut(it.block(it.words('Шапка')), 5000);
  await it.windowOf(0);
  expect(it.standing()).toBe(true);
  // A window that has a height is believed.
  await it.windowOf(1);
  expect(it.standing()).toBe(false);
});

test('a board with only a bar, only a bottom layer, or neither counts just what it has', async () => {
  const only = async (board: ReactElement, piece: string, size: number) => {
    const it = await mount(board);
    await laidOut(it.block(it.words(piece)), size);
    const scrolled = () =>
      it.root.findByType(ScrollView).findAll((one) => one.props.children === piece);
    await it.windowOf(size + LINE);
    expect(scrolled(), piece).toHaveLength(0);
    await it.windowOf(size + LINE - 1);
    expect(scrolled(), piece).not.toHaveLength(0);
  };
  await only(
    <Board bar={<Text>Шапка</Text>}>
      <Text>Тело</Text>
    </Board>,
    'Шапка',
    300,
  );
  await only(
    <Board footer={<Text>Низ</Text>}>
      <Text>Тело</Text>
    </Board>,
    'Низ',
    250,
  );
  // Nothing to move: a window shorter than a line of body changes nothing and breaks nothing.
  const bare = await mount(
    <Board>
      <Text>Тело</Text>
    </Board>,
  );
  await bare.windowOf(10);
  expect(bare.words('Тело')).toBeDefined();
});

test('a bar or a layer that has gone from the screen leaves no height behind it', async () => {
  // The wizard draws no bottom layer while its material is read, and a screen may drop its bar; the
  // height measured while they stood is not a reason to scroll what no longer has them.
  const it = await measured();
  const bare = (over: Partial<Parameters<typeof Board>[0]>) =>
    act(async () => it.tree.update(screen(over)));
  await it.windowOf(fits() - 1);
  expect(it.standing()).toBe(false);
  await bare({ footer: undefined });
  expect(it.scroll().findAll((one) => one.props.children === 'Шапка')).toHaveLength(0);
  await bare({ bar: undefined, footer: <Field /> });
  expect(it.scroll().findAllByType(Field)).toHaveLength(0);
});

test('what stands at the bottom rides up over the keyboard on iOS, and Android is left to do it itself', async () => {
  const system = Platform.OS;
  try {
    for (const [os, behavior] of [
      ['ios', 'padding'],
      ['android', undefined],
    ] as const) {
      Platform.OS = os;
      const it = await mount(screen());
      const avoiding = it.root.findAllByType(KeyboardAvoidingView);
      expect(avoiding, os).toHaveLength(1);
      expect(avoiding[0].props.behavior, os).toBe(behavior);
      // The whole board is inside it — the bar and the layer ride with it — and it fills the screen.
      expect(avoiding[0].findAll((one) => one.props.children === 'Шапка')).not.toHaveLength(0);
      expect(StyleSheet.flatten(avoiding[0].props.style).flex).toBe(1);
    }
  } finally {
    Platform.OS = system;
  }
});

test('the body scrolls only when it must, keeps a form’s own button pressable, and fills a short screen', async () => {
  const it = await mount(screen({ body: { paddingHorizontal: 16, gap: 12 } }));
  const scroll = it.root.findByType(ScrollView);
  // Taps land on what they hit while the keyboard is up, or the first press on «Сохранить» would
  // only close the keyboard.
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  // A body that fits neither scrolls nor bounces (spec 1, rule 5).
  expect(scroll.props.alwaysBounceVertical).toBe(false);
  expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({ flex: 1 });
  // Grown and not fixed: a short body still fills the room, and a long one is what scrolls.
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({ flexGrow: 1 });
  const column = scroll.findAll(
    (one) => one.type === View && StyleSheet.flatten(one.props.style)?.gap === 12,
  )[0];
  expect(StyleSheet.flatten(column.props.style)).toMatchObject({
    flexGrow: 1,
    paddingHorizontal: 16,
  });
  // Never `flex: 1`: a block shrunk to nothing comes out of the scroll instead of scrolling in it.
  expect(StyleSheet.flatten(column.props.style).flex).toBeUndefined();
});

test('the keyboard takes room from the body and from nothing the board listens to', async () => {
  const it = await measured();
  await it.windowOf(fits() + 200);
  expect(it.standing()).toBe(true);
  const started = life.started;
  // Everything the phone can lay out again when the keyboard comes up: the room, the scroll, the
  // board, the body. The bar and the layer keep their own heights, and none of it is the board's
  // business — the field in the layer is the same field afterwards, with the keyboard up for it.
  const bar = it.block(it.words('Шапка'));
  const layer = it.block(it.root.findByType(Field));
  const others = it.root.findAll(
    (one) => typeof one.props.onLayout === 'function' && one !== bar && one !== layer,
  );
  for (const node of others) await laidOut(node, 3);
  await it.windowOf(fits() + 200);
  expect(it.standing()).toBe(true);
  expect(life.started).toBe(started);
  expect(life.alive).toBe(1);
});

test('a field in the layer is drawn once while the window has room, and only once more, alone, when the board scrolls it', async () => {
  const it = await measured();
  const before = life.started;
  // Growing and shrinking the window inside the standing range moves nothing.
  for (const tall of [fits(), fits() + 100, fits() + 50]) await it.windowOf(tall);
  expect(life.started).toBe(before);
  await it.windowOf(fits() - 1);
  expect(life.alive).toBe(1);
});

test('entering a screen again starts it as drawn, with nothing measured before carried over', async () => {
  const first = await measured();
  await first.windowOf(fits() - 1);
  expect(first.standing()).toBe(false);
  first.tree.unmount();
  // The same window, a fresh mount: nothing measured yet, so bar and layer stand until it is taken.
  const again = await mount(screen());
  await again.windowOf(fits() - 1);
  const scroll = again.root.findByType(ScrollView);
  expect(scroll.findAll((one) => one.props.children === 'Шапка')).toHaveLength(0);
  expect(scroll.findAllByType(Field)).toHaveLength(0);
});

test('a list body has the bar above it and the layer below it while they stand, and takes them in at its head and foot when they do not', async () => {
  const edges: { head: ReactNode; foot: ReactNode }[] = [];
  const it = await mount(
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
  const pieces = ['Шапка', 'Список', 'Низ', 'Поверх'];
  await laidOut(it.block(it.words('Шапка')), 200);
  await laidOut(it.block(it.words('Низ')), 200);
  // Standing: the bar above the list, the layer under it, the floating part over all of them.
  await it.windowOf(400 + LINE);
  expect(edges.at(-1)).toEqual({ head: null, foot: null });
  expect(order(it.tree, pieces)).toEqual(pieces);
  // Scrolled: both are the list's own, one of each, the head before the rows and the foot after.
  await it.windowOf(400 + LINE - 1);
  expect(order(it.tree, pieces)).toEqual(pieces);
  for (const piece of ['Шапка', 'Низ'])
    expect(
      it.root.findAll((one) => one.type === Text && one.props.children === piece),
    ).toHaveLength(1);
  // Bigger type is less room for the same list.
  await it.windowOf(400 + LINE + 1, { fontScale: 2 });
  expect(edges.at(-1)?.head).not.toBeNull();
  expect(edges.at(-1)?.foot).not.toBeNull();
  expect(it.root.findAllByType(ScrollView)).toHaveLength(0);
});

test.each(['dark', 'light'] as const)(
  'the board is the %s theme’s own ink, and a screen’s style over it is the last word',
  async (name) => {
    await setTheme(name);
    try {
      const it = await mount(screen({ style: { paddingTop: 0 } }));
      const board = () => StyleSheet.flatten(it.root.findByType(KeyboardAvoidingView).props.style);
      expect(board()).toMatchObject({ flex: 1, backgroundColor: themes[name].color.ink });
      // `Upload`'s feed runs under the status line: its style takes the padding away, and the phone's
      // own inset — 47 here — does not bring it back.
      await it.windowOf(667, { top: 47 });
      expect(board().paddingTop).toBe(0);
    } finally {
      await setTheme('dark');
    }
  },
);

test('a sheet is the other place the keyboard is given way to: iOS is told, Android does it itself, and a press lands with it up', async () => {
  const system = Platform.OS;
  try {
    for (const [os, behavior] of [
      ['ios', 'padding'],
      ['android', undefined],
    ] as const) {
      Platform.OS = os;
      const it = await mount(
        <Sheet visible onCancel={() => {}} title="Ник">
          <Text>Поле</Text>
        </Sheet>,
      );
      const avoiding = it.root.findAllByType(KeyboardAvoidingView);
      expect(avoiding, os).toHaveLength(1);
      expect(avoiding[0].props.behavior, os).toBe(behavior);
      // What is typed in the body is beside its own button: taps land on what they hit.
      expect(it.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    }
  } finally {
    Platform.OS = system;
  }
});
