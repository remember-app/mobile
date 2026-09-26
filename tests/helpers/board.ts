import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';

import { Board } from '@/kit/bars';

/**
 * What a phone does once it has laid a screen's board out, which node cannot: it says how tall the
 * bar and the bottom layer came out, and the board decides by that whether they stand still or
 * scroll with the body (`Board`, spec 7.1). Imported by `*.test.*` only.
 */

/** Whether the node stands somewhere inside a scroll. */
export const scrolled = (node: ReactTestInstance) => {
  for (let up = node.parent; up; up = up.parent) if (up.type === ScrollView) return true;
  return false;
};

/**
 * The blocks the board listens to — around the bar, the heading under it and the bottom layer — as
 * they stand before anything is measured, that is outside the scroll: the outermost views with a
 * layout handler that are not in the body. Only those of them the screen has.
 */
export function blocks(root: ReactTestInstance): ReactTestInstance[] {
  // The screen on top where several are stacked, the way the wizard's steps stand.
  const all = root
    .findAllByType(Board)
    .at(-1)!
    .findAll(() => true);
  const heard = all.filter(
    (one) =>
      one.type === View &&
      typeof one.props.onLayout === 'function' &&
      // The board's own views: the one the keyboard-avoiding view keeps its frame on, and the room
      // over the bottom layer, which holds the body's scroll (a list's too).
      one.parent?.type !== KeyboardAvoidingView &&
      one.findAllByType(ScrollView).length === 0 &&
      !scrolled(one),
  );
  return heard
    .filter(
      (one) => !heard.some((other) => other !== one && other.findAll((x) => x === one).length),
    )
    .sort((a, b) => all.indexOf(a) - all.indexOf(b));
}

/** The phone laying out the bar, the heading and the bottom layer this tall — those it is told of. */
export async function measure(
  root: ReactTestInstance,
  sizes: { bar?: number; heading?: number; footer?: number },
) {
  const board = root.findAllByType(Board).at(-1)!;
  const pieces = (['bar', 'heading', 'footer'] as const).filter((piece) => board.props[piece]);
  const found = blocks(root);
  for (const [i, piece] of pieces.entries()) {
    const height = sizes[piece];
    if (height === undefined) continue;
    await act(async () =>
      found[i]?.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } }),
    );
  }
}
