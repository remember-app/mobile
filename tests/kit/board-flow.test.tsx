import { expect, test, vi } from 'vitest';

// The phone, turned by the test: its window, the type size the person set and the status line. The
// board decides by them whether the bar and the bottom layer stand still.
const { phone, focus } = vi.hoisted(() => ({
  phone: { height: 667, fontScale: 1, top: 0 },
  focus: { field: null as { y: number; h: number; outside?: boolean } | null },
}));

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
// The field the keyboard is up for, where the phone laid it out in the body — or outside the body,
// where it cannot be measured against it — or none.
vi.mock('@/kit/field', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/kit/field')>()),
  focusedField: () =>
    focus.field && {
      measureLayout: (
        _body: unknown,
        done: (x: number, y: number, w: number, h: number) => void,
        fail: () => void,
      ) => (focus.field?.outside ? fail() : done(0, focus.field?.y ?? 0, 375, focus.field?.h ?? 0)),
    },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: phone.top, right: 0, bottom: 0, left: 0 }),
}));

import { readFileSync } from 'node:fs';

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { cloneElement, type ReactElement, type ReactNode, useContext, useEffect } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import TestRenderer, {
  act,
  type ReactTestInstance,
  type TestRendererOptions,
} from 'react-test-renderer';

import { ActionBar, Board } from '@/kit/bars';
import { Button } from '@/kit/button';
import { AreaRoom, areaSight } from '@/kit/field';
import { useFieldInBar } from '@/kit/interaction';
import { Sheet } from '@/kit/sheet';
import { Text, TYPE_MOST } from '@/kit/text';
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

async function mount(board: ReactElement, options?: TestRendererOptions) {
  Object.assign(phone, { height: 667, fontScale: 1, top: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(board, options));
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

/** The same count for a field in the body or in the bar — the one the bar hears about, in the bar. */
const typed = { started: 0, alive: 0 };
function Typed() {
  useEffect(() => {
    typed.started += 1;
    typed.alive += 1;
    return () => {
      typed.alive -= 1;
    };
  }, []);
  return <Text>Ввод</Text>;
}
function BarField() {
  useFieldInBar();
  return <Typed />;
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
async function measured(board: ReactElement = screen(), options?: TestRendererOptions) {
  const it = await mount(board, options);
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
    // The line of the body grows with the type — up to ×2, `TYPE_MOST`, past which the body's words
    // stop growing (TASK-401: counted at ×3.571, the bar and the layer went into the scroll 36 early
    // for a line that is never drawn that tall) — and the status line is no room of the body's at all.
    const line = LINE * Math.min(fontScale, TYPE_MOST);
    const it = await measured();
    await it.windowOf(fits(line) + top, { fontScale, top });
    expect(it.standing()).toBe(true);
    await it.windowOf(fits(line) + top - 0.5, { fontScale, top });
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

/**
 * TASK-381 changed what the keyboard may move. It was nothing (TASK-374: a field in the bottom layer
 * moved into the scroll is drawn anew, and the keyboard goes down with it). On the smallest phone at
 * the largest type that left the wizard's heading, its row and «Дальше» taller than the room over the
 * keyboard: the field in the body was squeezed to nothing and «Назад» stood under the status line.
 * Now the bottom layer is still never moved by the keyboard, and the bar is — into the scroll, over a
 * body that is never drawn anew.
 */
/**
 * What the phone lays out again when the keyboard comes up: everything but the bar, the heading
 * under it and the layer, which are as tall as they were.
 */
async function keyboard(
  it: Pick<Awaited<ReturnType<typeof mount>>, 'root' | 'block' | 'words'>,
  room: number,
) {
  const kept = [
    it.block(it.words('Шапка')),
    it.block(it.root.findByType(Field)),
    ...it.root
      .findAll((one) => one.type === Text && one.props.children === 'Заголовок')
      .map(it.block),
  ];
  const others = it.root.findAll(
    (one) => typeof one.props.onLayout === 'function' && !kept.includes(one),
  );
  for (const node of others) await laidOut(node, room);
}

test('the keyboard never moves the bottom layer: its field is the same one, standing over the keyboard', async () => {
  const it = await measured();
  await it.windowOf(fits() + 200);
  const started = life.started;
  // The keyboard took all but 3 of the room over the layer: the layer does not go anywhere.
  await keyboard(it, 3);
  expect(it.scroll().findAllByType(Field)).toHaveLength(0);
  expect(life.started).toBe(started);
  expect(life.alive).toBe(1);
});

test('short of the bar and a line of the body over the keyboard, the bar goes to the head of the scroll, and comes back', async () => {
  const it = await measured();
  await it.windowOf(fits() + 200);
  // The room over the layer holds the bar and a line: nothing moves.
  await keyboard(it, 100 + LINE);
  expect(it.inScroll('Шапка')).toHaveLength(0);
  // A point less: the bar scrolls, first in the scroll, and the layer stays under it and out of it.
  await keyboard(it, 100 + LINE - 1);
  expect(it.inScroll('Шапка')).not.toHaveLength(0);
  expect(it.scroll().findAllByType(Field)).toHaveLength(0);
  expect(order(it.tree)).toEqual(['Шапка', 'Тело', 'Поле']);
  expect(
    it.root.findAll((one) => one.type === Text && one.props.children === 'Шапка'),
  ).toHaveLength(1);
  // At large type the line is taller, and so is what the room has to hold — as tall as the body's
  // words grow, ×2, and no taller at the largest type.
  await it.windowOf(fits(LINE * 3.571) + 200, { fontScale: 3.571 });
  await keyboard(it, 100 + LINE * TYPE_MOST);
  expect(it.inScroll('Шапка')).toHaveLength(0);
  await keyboard(it, 100 + LINE * TYPE_MOST - 1);
  expect(it.inScroll('Шапка')).not.toHaveLength(0);
  // The keyboard goes down: the bar stands again.
  await keyboard(it, 700);
  expect(it.inScroll('Шапка')).toHaveLength(0);
});

test('a field in the body is never drawn anew when the bar goes into the scroll over it or comes back', async () => {
  const it = await measured(
    <Board bar={<Text>Шапка</Text>} footer={<Field />}>
      <Text>Тело</Text>
      <Typed />
    </Board>,
  );
  await it.windowOf(fits() + 200);
  const started = typed.started;
  expect(typed.alive).toBe(1);
  for (const room of [3, 700, 50, 100 + LINE, 100 + LINE - 1, 700]) {
    await keyboard(it, room);
    expect(typed.started, `room ${room}`).toBe(started);
    expect(typed.alive).toBe(1);
  }
});

test('a bar holding a field of its own stays put for the keyboard, and the top gives instead', async () => {
  const it = await measured(
    <Board
      bar={
        <>
          <Text>Шапка</Text>
          <BarField />
        </>
      }
      footer={<Field />}
    >
      <Text>Тело</Text>
    </Board>,
  );
  await it.windowOf(fits() + 200);
  const started = typed.started;
  await keyboard(it, 3);
  expect(it.inScroll('Шапка')).toHaveLength(0);
  expect(typed.started).toBe(started);
  expect(typed.alive).toBe(1);
  // What does not fit goes past the top, never the bottom: the layer is the one over the keyboard.
  const room = it.root.findAll(
    (one) =>
      one.type === View &&
      typeof one.props.onLayout === 'function' &&
      one.parent?.type !== KeyboardAvoidingView &&
      one.findAllByType(ScrollView).length > 0,
  )[0];
  expect(StyleSheet.flatten(room.props.style).justifyContent).toBe('flex-end');
  // Gone from the bar, the field no longer holds it.
  await act(async () =>
    it.tree.update(
      <Board bar={<Text>Шапка</Text>} footer={<Field />}>
        <Text>Тело</Text>
      </Board>,
    ),
  );
  await keyboard(it, 3);
  expect(it.inScroll('Шапка')).not.toHaveLength(0);
});

test('the body keeps its place on the screen while the bar goes into the scroll above it and back', async () => {
  const to = vi.fn();
  // The phone's scroll, which node has none of: where it is told to go is what the test reads.
  const it = await measured(screen(), { createNodeMock: () => ({ scroll: to }) });
  await it.windowOf(fits() + 200);
  // Scrolled 40 down the body when the keyboard came up.
  await act(async () => it.scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 40 } } }));
  await keyboard(it, 50);
  // The bar (100) is now over the body in the scroll: scrolled past it, the body stands where it did.
  expect(to).toHaveBeenLastCalledWith(expect.objectContaining({ top: 140 }));
  await act(async () => it.scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 150 } } }));
  await keyboard(it, 700);
  expect(to).toHaveBeenLastCalledWith(expect.objectContaining({ top: 50 }));
  // The window moving both the bar and the layer into the scroll is the board starting from its top.
  to.mockClear();
  await it.windowOf(fits() - 1);
  expect(to).not.toHaveBeenCalled();
});

test('the field being typed into is brought into what the keyboard leaves of the body', async () => {
  const to = vi.fn();
  const it = await measured(screen(), { createNodeMock: () => ({ scroll: to }) });
  const scrolled = (y: number) =>
    act(async () => it.scroll().props.onScroll({ nativeEvent: { contentOffset: { y } } }));
  /** The keyboard down and up again, over a field this far down the body and this tall. */
  const typing = async (field: typeof focus.field, room = 300) => {
    focus.field = null;
    await keyboard(it, 600);
    focus.field = field;
    to.mockClear();
    await keyboard(it, room);
  };
  try {
    await it.windowOf(fits() + 600);
    // 300 over the layer, 100 of it the bar: the field 450 down and 50 tall comes up to the edge,
    // with the box round the input (12 each side) in sight too.
    await typing({ y: 450, h: 50 });
    expect(to).toHaveBeenLastCalledWith(expect.objectContaining({ top: 450 + 50 + 12 - 200 }));
    // Scrolled past it, it comes back down to its top.
    await scrolled(480);
    await typing({ y: 450, h: 50 });
    expect(to).toHaveBeenLastCalledWith(expect.objectContaining({ top: 450 - 12 }));
    // Taller than what is left, it is shown from its top.
    await scrolled(0);
    await typing({ y: 350, h: 250 });
    expect(to).toHaveBeenLastCalledWith(expect.objectContaining({ top: 350 - 12 }));
    // In sight already: nothing moves.
    await scrolled(0);
    await typing({ y: 20, h: 50 });
    expect(to).not.toHaveBeenCalled();
    // Not in the body — in the bar or the bottom layer, which stand — and nothing focused: the same.
    await typing({ y: 450, h: 50, outside: true });
    expect(to).not.toHaveBeenCalled();
    await typing(null);
    expect(to).not.toHaveBeenCalled();
    // The bar gone into the scroll over it: counted from the body's new place under the bar.
    await typing({ y: 200, h: 50 }, 100 + LINE - 1);
    expect(to).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: 100 + 200 + 50 + 12 - (100 + LINE - 1) }),
    );
  } finally {
    focus.field = null;
  }
});

/**
 * TASK-401 (R3). The wizard's heading and the story under it on the smallest phone with the
 * keyboard up: the room over «Дальше» held the heading and one or two lines of the story, and past
 * that the whole bar went into the scroll over a box that filled what was left — «Назад» and
 * «Отмена» a scroll up that no finger could make, since every drag landed in the box. Now the
 * heading goes first, and the bar's row stays.
 */
/** What the board tells a long-text box in its body (`TextArea` draws its height from it). */
let told: number | null = null;
function Story() {
  told = useContext(AreaRoom);
  return null;
}

/** The wizard as the board sees it: a bar 100 tall, a heading 150 under it, the story in the body. */
async function headed() {
  const it = await mount(
    <Board bar={<Text>Шапка</Text>} heading={<Text>Заголовок</Text>} footer={<Field />}>
      <Text>Тело</Text>
      <Story />
    </Board>,
  );
  await laidOut(it.block(it.words('Шапка')), 100);
  await laidOut(it.block(it.words('Заголовок')), 150);
  await laidOut(it.block(it.root.findByType(Field)), 120);
  await it.windowOf(100 + 150 + 120 + 600);
  const scroll = () => it.root.findByType(ScrollView);
  const inScroll = (text: string) => scroll().findAll((one) => one.props.children === text);
  return { ...it, scroll, inScroll, keyboard: (room: number) => keyboard(it, room) };
}

/** The room the heading needs over the keyboard: the bar, itself, and three lines of the story. */
const holding = (scale: number) => 100 + 150 + 12 + areaSight(scale);

test('short of three lines of the story under the heading, the heading goes into the scroll first, and the bar’s row stays', async () => {
  const it = await headed();
  // Three lines of the story are its top edge (1 + 16) and three of its 24 lines, in sight 12 under
  // the heading.
  expect(areaSight(1)).toBe(1 + 16 + 3 * 24);
  await it.keyboard(holding(1));
  expect(it.inScroll('Заголовок')).toHaveLength(0);
  expect(it.inScroll('Шапка')).toHaveLength(0);
  // With the top standing the box has its own 280.
  expect(told).toBeNull();

  // A point less: the heading is the scroll's head, over the body; the bar stands, and so does the
  // layer under the keyboard.
  await it.keyboard(holding(1) - 1);
  expect(it.inScroll('Заголовок')).not.toHaveLength(0);
  expect(it.inScroll('Шапка')).toHaveLength(0);
  expect(it.scroll().findAllByType(Field)).toHaveLength(0);
  expect(order(it.tree, ['Шапка', 'Заголовок', 'Тело', 'Поле'])).toEqual([
    'Шапка',
    'Заголовок',
    'Тело',
    'Поле',
  ]);
  // The story's box, which scrolls inside itself and keeps its caret in its own frame, is told what
  // the body has on the screen under the bar, less its 12 of air on each side.
  expect(told).toBe(holding(1) - 1 - 100 - 24);

  // Short of the bar and a line of the body too: the bar follows, over the heading.
  await it.keyboard(100 + LINE - 1);
  expect(it.inScroll('Шапка')).not.toHaveLength(0);
  expect(order(it.tree, ['Шапка', 'Заголовок', 'Тело'])).toEqual(['Шапка', 'Заголовок', 'Тело']);
  expect(told).toBe(100 + LINE - 1 - 24);

  // The keyboard goes down: both stand again, and the box is its own 280.
  await it.keyboard(700);
  expect(it.inScroll('Шапка')).toHaveLength(0);
  expect(it.inScroll('Заголовок')).toHaveLength(0);
  expect(told).toBeNull();
});

test('three lines of the story are counted at the size its words grow to, and no larger', async () => {
  const it = await headed();
  for (const scale of [1.353, 2, 3.571]) {
    await it.windowOf(100 + 150 + 120 + 600, { fontScale: scale });
    await it.keyboard(holding(scale));
    expect(it.inScroll('Заголовок'), `×${scale}`).toHaveLength(0);
    await it.keyboard(holding(scale) - 1);
    expect(it.inScroll('Заголовок'), `×${scale}`).not.toHaveLength(0);
    expect(it.inScroll('Шапка'), `×${scale}`).toHaveLength(0);
  }
  // The box's words stop at ×2, and so do its lines.
  expect(areaSight(3.571)).toBe(areaSight(TYPE_MOST));
});

test('the body keeps its place while the heading goes into the scroll above it, and the story is brought into what is left', async () => {
  const to = vi.fn();
  const it = await mount(
    <Board bar={<Text>Шапка</Text>} heading={<Text>Заголовок</Text>} footer={<Field />}>
      <Text>Тело</Text>
    </Board>,
    { createNodeMock: () => ({ scroll: to }) },
  );
  await laidOut(it.block(it.words('Шапка')), 100);
  await laidOut(it.block(it.words('Заголовок')), 150);
  await laidOut(it.block(it.root.findByType(Field)), 120);
  await it.windowOf(100 + 150 + 120 + 600);
  const scroll = () => it.root.findByType(ScrollView);
  const room = (height: number) => keyboard(it, height);
  await room(700);
  await act(async () => scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 40 } } }));
  // The heading (150) is now over the body in the scroll: scrolled past it, the body stands where
  // it did.
  await room(300);
  expect(to).toHaveBeenLastCalledWith(expect.objectContaining({ top: 40 + 150 }));
  await act(async () => scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 200 } } }));
  await room(700);
  expect(to).toHaveBeenLastCalledWith(expect.objectContaining({ top: 50 }));

  // The story 60 down the body and 150 tall, the keyboard up for it: counted from the body's place
  // under the heading in the scroll, and whole in the 200 the body has under the bar.
  try {
    focus.field = { y: 60, h: 150 };
    await act(async () => scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }));
    await room(300);
    expect(to).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: 150 + 60 + 150 + 12 - 200 }),
    );
  } finally {
    focus.field = null;
  }
});

test('a body that is a list takes the heading in at its head when the room under it is short, the bar standing', async () => {
  const edges: { head: ReactNode; foot: ReactNode }[] = [];
  const it = await mount(
    <Board
      bar={<Text>Шапка</Text>}
      heading={<Text>Заголовок</Text>}
      footer={<Text>Низ</Text>}
      list={(given) => {
        edges.push(given);
        return (
          <View>
            {given.head}
            <Text>Список</Text>
          </View>
        );
      }}
    />,
  );
  await laidOut(it.block(it.words('Шапка')), 100);
  await laidOut(it.block(it.words('Заголовок')), 150);
  await laidOut(it.block(it.words('Низ')), 120);
  await it.windowOf(100 + 150 + 120 + 600);
  // The room over the layer: the block that holds the list, and not the keyboard's own wrapper.
  const roomView = it.root.findAll(
    (one) =>
      typeof one.props.onLayout === 'function' &&
      one.parent?.type !== KeyboardAvoidingView &&
      one.findAll((inner) => inner.props.children === 'Список').length > 0,
  )[0];
  await laidOut(roomView, holding(1));
  expect(edges.at(-1)?.head).toBeNull();
  await laidOut(roomView, holding(1) - 1);
  expect(order(it.tree, ['Шапка', 'Заголовок', 'Список'])).toEqual([
    'Шапка',
    'Заголовок',
    'Список',
  ]);
  expect(
    it.root.findAll((one) => one.type === Text && one.props.children === 'Заголовок'),
  ).toHaveLength(1);
  // Only the heading went into the list: the bar stands over it.
  const listed = it.root.find(
    (one) =>
      one.type === View &&
      [one.props.children].flat().some((child) => child?.props?.children === 'Список'),
  );
  expect(listed.findAll((one) => one.props.children === 'Заголовок')).not.toHaveLength(0);
  expect(listed.findAll((one) => one.props.children === 'Шапка')).toHaveLength(0);
});

test('every field of the kit tells a bar it stands in that it is there', () => {
  // A field in the bar moved into the scroll is drawn anew, and the keyboard goes down with it: the
  // bar learns it holds one from the field itself, so no field of the kit may forget to say so.
  const source = readFileSync(new URL('../../src/kit/field.tsx', import.meta.url), 'utf8');
  const inputs = source.match(/<TextInput\b/g) ?? [];
  expect(inputs.length).toBeGreaterThan(2);
  expect(source.match(/\buseFieldInBar\(\);/g) ?? []).toHaveLength(inputs.length);
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

test('at the largest type a sheet keeps its heading and buttons still while a line of the body as tall as its words grow fits', async () => {
  // TASK-401: the body's words stop at ×2 (`TYPE_MOST`), so its line does too — counted at ×3.571
  // the sheet let go of its heading and buttons 36 too early. The sheet at its ceiling of 600: 1 + 12
  // of its own, the handle 4, the heading 300, four gaps of 18 and the 30 under the buttons leave a
  // ×2 line (46) exactly with buttons 135 tall.
  const it = await mount(
    <Sheet
      visible
      onCancel={() => {}}
      title="Ник"
      footer={<Button variant="primary" label="Сохранить" />}
    >
      <Text>Поле</Text>
    </Sheet>,
  );
  const sheet = it.root.findAll(
    (one) =>
      one.props.accessibilityViewIsModal === true && typeof one.props.onLayout === 'function',
  )[0];
  const pinnedWith = async (buttons: number) => {
    await laidOut(it.block(it.words('Ник')), 300);
    await laidOut(it.block(it.root.findByType(Button)), buttons);
    await laidOut(sheet, 600);
    return (
      it.root.findByType(ScrollView).findAll((one) => one.props.children === 'Ник').length === 0
    );
  };
  await it.windowOf(667, { fontScale: 3.571 });
  expect(1 + 12 + 4 + 300 + LINE * TYPE_MOST + 135 + 4 * 18 + 30).toBe(600);
  expect(await pinnedWith(135)).toBe(true);
  expect(await pinnedWith(136)).toBe(false);
});

test('the keyboard goes down by a tap or a drag on anything but a field or a button, and by a drag of the body', async () => {
  // TASK-377: once for every screen. A tap on a button or a field is theirs — a form keeps its own
  // button — and a drag of the body takes the keyboard down.
  const { root } = await mount(screen());
  const scroll = root.findByType(ScrollView);
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  expect(scroll.props.keyboardDismissMode).toBe('on-drag');

  // A tap or a drag on anything else — the background, a line of words, the bottom layer around its
  // field, a body with nothing to scroll — is heard by the board, and only while there is a keyboard
  // to take down.
  const board = root.findByType(KeyboardAvoidingView);
  const dismiss = vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  const isVisible = vi.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  try {
    expect(board.props.onStartShouldSetResponder()).toBe(false);
    isVisible.mockReturnValue(true);
    expect(board.props.onStartShouldSetResponder()).toBe(true);
    board.props.onResponderRelease();
    expect(dismiss).toHaveBeenCalledOnce();
  } finally {
    dismiss.mockRestore();
    isVisible.mockRestore();
  }

  // When the keyboard leaves less room than the bar and the bottom layer need, the top gives: the
  // board stands on its bottom edge, and the action there stays over the keyboard.
  expect(StyleSheet.flatten(board.props.style).justifyContent).toBe('flex-end');
});

test('a finger that trembles on a button over the keyboard keeps its press, on a board and on a sheet', async () => {
  // Every move of a finger offers the touch again to the parents of what holds it: one that says yes
  // takes the press from under the finger, and the tap on «Сохранить» — or on the next field — only
  // puts the keyboard away.
  const save = <Button variant="primary" label="Сохранить" />;
  const isVisible = vi.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
  try {
    for (const drawn of [
      screen({ footer: save }),
      <Sheet key="sheet" visible onCancel={() => {}} title="Новый лейбл" footer={save}>
        <Text>Поле</Text>
      </Sheet>,
    ]) {
      const it = await mount(drawn);
      const takers: string[] = [];
      for (let up = it.root.findByType(Button).parent; up; up = up.parent)
        for (const asked of ['onMoveShouldSetResponderCapture', 'onMoveShouldSetResponder'])
          if (typeof up.props[asked] === 'function' && up.props[asked]({ nativeEvent: {} })) {
            const { displayName, name } = up.type as { displayName?: string; name?: string };
            takers.push(`${displayName ?? name} › ${asked}`);
          }
      expect(takers).toEqual([]);
    }
  } finally {
    isVisible.mockRestore();
  }
});

test('a body that is a list keeps the top of the screen where it is', async () => {
  // A list has no field on it (`tests/routes/scroll.test.ts`), and what floats over it is laid out
  // from the top — so its board does not stand on its bottom edge.
  const { root } = await mount(<Board list={() => <Text>Список</Text>} />);
  const board = root.findByType(KeyboardAvoidingView);
  expect(StyleSheet.flatten(board.props.style).justifyContent).toBeUndefined();
});
