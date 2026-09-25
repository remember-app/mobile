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
 * The two blocks the board listens to — around the bar and around the bottom layer — as they stand
 * before anything is measured, that is outside the scroll: the outermost views with a layout handler
 * that are not in the body. Only one of them where the screen has only a bar or only a bottom layer.
 */
export function blocks(root: ReactTestInstance): ReactTestInstance[] {
  const all = root.findByType(Board).findAll(() => true);
  const heard = all.filter(
    (one) =>
      one.type === View &&
      typeof one.props.onLayout === 'function' &&
      // The board's own view, which the keyboard-avoiding view keeps its frame on.
      one.parent?.type !== KeyboardAvoidingView &&
      !scrolled(one),
  );
  return heard
    .filter(
      (one) => !heard.some((other) => other !== one && other.findAll((x) => x === one).length),
    )
    .sort((a, b) => all.indexOf(a) - all.indexOf(b));
}

/** The phone laying the bar out `bar` tall and the bottom layer `footer` tall. */
export async function measure(
  root: ReactTestInstance,
  { bar, footer }: { bar?: number; footer?: number },
) {
  const [first, second] = blocks(root);
  const to: [ReactTestInstance | undefined, number | undefined][] =
    bar !== undefined && footer !== undefined
      ? [
          [first, bar],
          [second, footer],
        ]
      : [[first, bar ?? footer]];
  for (const [node, height] of to)
    await act(async () =>
      node?.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } }),
    );
}
