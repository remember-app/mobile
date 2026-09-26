import { expect, test, vi } from 'vitest';

// The largest type of iOS, where the caption on a developing frame's tile tore on the first frame of
// a cold start — «Проявля / ем…» for one frame on the iPhone SE — before its lines came back and it
// was set smaller (TASK-407).
const { phone, layouts } = vi.hoisted(() => ({
  phone: { fontScale: 3.571 },
  layouts: { count: 0, box: 110, tall: 0 },
}));

/**
 * The platform's text, laid out by a model: every letter 0.6 of the size wide, a text as wide as its
 * widest line up to the box it stands in — `layouts.box` for the words on screen, and all the room there is
 * for the copy the kit lays out unseen (the one that does not listen for its lines). Asked where it
 * is, it answers there and then, as the new architecture does in a layout effect. A platform view
 * answers `layouts.tall` for its height.
 */
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  const { createElement, forwardRef, useImperativeHandle, useRef } = await import('react');
  const wide = (props: { style?: unknown; children?: unknown; onTextLayout?: unknown }) => {
    const { fontSize = 14 } = rn.StyleSheet.flatten(props.style as never) as { fontSize?: number };
    const lines = String(props.children).split('\n');
    const widest = Math.max(...lines.map((line) => [...line].length * fontSize * 0.6));
    return props.onTextLayout ? Math.min(widest, layouts.box) : widest;
  };
  return {
    ...rn,
    useWindowDimensions: () => ({ width: 375, height: 667, scale: 2, fontScale: phone.fontScale }),
    Text: forwardRef((props: Record<string, unknown>, ref) => {
      const latest = useRef(props);
      latest.current = props;
      useImperativeHandle(ref, () => ({
        measure: (answer: (...at: number[]) => void) => {
          layouts.count += 1;
          answer(0, 0, wide(latest.current), 0, 0, 0);
        },
      }));
      return createElement('platform-text', props);
    }),
    View: forwardRef((props: Record<string, unknown>, ref) => {
      useImperativeHandle(ref, () => ({
        measure: (answer: (...at: number[]) => void) =>
          answer(0, 0, layouts.box, layouts.tall, 0, 0),
      }));
      return createElement('platform-view', props);
    }),
  };
});

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { ReactElement } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';

import { piecesOf, Text } from '@/kit/text';
import { type } from '@/theme';

mountsTrees();

const BOX = 110;

async function draw(element: ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(element));
  });
  return tree;
}

/** The platform texts drawn: the words on screen first, then any copy laid out unseen. */
const platform = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll((one) => (one.type as unknown) === 'platform-text');
const shown = (tree: TestRenderer.ReactTestRenderer) =>
  platform(tree).find((one) => typeof one.props.onTextLayout === 'function') as ReactTestInstance;
const sizeOf = (one: ReactTestInstance) =>
  (StyleSheet.flatten(one.props.style) as TextStyle).fontSize ?? 0;

test('a word too wide for its box on the largest type is set smaller before the first frame, not after its lines come back', async () => {
  const tree = await draw(
    <Text role="meta" fit>
      Проявляем…
    </Text>,
  );
  // Not a single line has come back from the phone, and the caption is already whole: set as far as
  // its box holds the word, 2% under that for the rounding of the phone's measures — and grown still.
  const size = sizeOf(shown(tree));
  const full = Number(type.meta.fontSize) * 2;
  expect(size).toBeCloseTo(full * (BOX / ([...'Проявляем…'].length * full * 0.6)) * 0.98, 5);
  expect([...'Проявляем…'].length * size * 0.6).toBeLessThanOrEqual(BOX);
  expect(size).toBeGreaterThan(Number(type.meta.fontSize));
  // The lines of the layout already put right arrive late and say nothing any more.
  await act(async () => {
    shown(tree).props.onTextLayout({
      nativeEvent: {
        lines: [
          { text: 'Проявля', width: BOX },
          { text: 'ем…', width: 40 },
        ],
      },
    });
  });
  expect(sizeOf(shown(tree))).toBe(size);
});

test('a heading is measured by the widest piece its lines may not break inside', async () => {
  layouts.box = 200;
  const words = 'Приглашение не действует';
  const tree = await draw(<Text role="emptyTitle">{words}</Text>);
  const copy = platform(tree).find((one) => one.props.onTextLayout === undefined);
  expect(copy?.props.children).toBe('Приглашение\nне\nдействует');
  // «Приглашение» holds its box whole, and no smaller than it needs.
  const size = sizeOf(shown(tree));
  expect([...'Приглашение'].length * size * 0.6).toBeLessThanOrEqual(200);
  expect([...'Приглашение'].length * (size / 0.97) * 0.6).toBeGreaterThan(200);
  layouts.box = BOX;
});

test('words that fit are left as they are, and at the system’s own size nothing is laid out twice', async () => {
  const fits = await draw(
    <Text role="meta" fit>
      Готово
    </Text>,
  );
  expect(sizeOf(shown(fits))).toBe(Number(type.meta.fontSize) * 2);

  phone.fontScale = 1;
  layouts.count = 0;
  const plain = await draw(
    <Text role="meta" fit>
      Проявляем…
    </Text>,
  );
  expect(platform(plain)).toHaveLength(1);
  expect(layouts.count).toBe(0);
  phone.fontScale = 3.571;
});

test('a span inside other words has no box of its own and lays out no copy', async () => {
  const tree = await draw(
    <Text role="meta">
      Ролик{' '}
      <Text role="meta" fit>
        Проявляем…
      </Text>
    </Text>,
  );
  // The two texts, and no third: a copy would stand inside the words as a span and be read.
  expect(platform(tree)).toHaveLength(2);
});

test('a word cut after a hyphen or a dash is two pieces, and spaces part the rest', () => {
  expect(piecesOf('чёрно-белый ролик')).toBe('чёрно-\nбелый\nролик');
  expect(piecesOf('12–14 сентября')).toBe('12–\n14\nсентября');
  expect(piecesOf('@alexandra.moroz')).toBe('@alexandra.moroz');
  expect(piecesOf('  Добавить   ещё ')).toBe('Добавить\nещё');
});

test('a balanced name set in more lines than counted goes back to the full width in the same commit', async () => {
  // TASK-406. The phone's lines come a commit later, and a layout of the same lines at another width
  // is not reported again: turned from L to AX5 with the app open, the name on the iPhone 17e stayed
  // «Свадьба / Лизы и / Марка» at a width counted from the words at L. The height of its box, read
  // in the layout effect, says how many lines it took.
  phone.fontScale = 1;
  const tree = await draw(
    <Text role="displayCover" balance>
      Свадьба Лизы и Марка
    </Text>,
  );
  const maxWidth = () =>
    (StyleSheet.flatten(shown(tree).props.style) as TextStyle | undefined)?.maxWidth;
  const measures = platform(tree).filter((one) => typeof one.props.onLayout === 'function');
  const box = tree.root.findAll(
    (one) => (one.type as unknown) === 'platform-view' && typeof one.props.onLayout === 'function',
  )[0];
  // Two lines of 34 on the phone: balanced, and it stays so.
  layouts.tall = 68;
  await act(async () => {
    box.props.onLayout({ nativeEvent: { layout: { width: 322, height: 68 } } });
    [143.5, 89, 21, 111, 237.5].forEach((width, at) => {
      measures[at].props.onLayout({ nativeEvent: { layout: { width, height: 34 } } });
    });
  });
  expect(maxWidth()).toBe(233);
  // The same words set in three: the full width, with no line from the phone asked for.
  layouts.tall = 102;
  await act(async () => {
    measures[4].props.onLayout({ nativeEvent: { layout: { width: 237, height: 34 } } });
  });
  expect(maxWidth()).toBeUndefined();
  layouts.tall = 0;
  phone.fontScale = 3.571;
});
