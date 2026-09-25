import { StyleSheet, Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

/**
 * What a sheet standing in a mounted tree is to the eye, read off the tree rather than off markup: the
 * column `Sheet` builds (the one a screen reader is told is modal) with the gap between its blocks and
 * the floor it stands at, and everything it says in words. For the tests that raise a sheet the way a
 * person does, from the screen that owns it, and ask what came up. Imported by `*.test.*` only.
 */

/** The sheet's own column: its gap between blocks and its floor, `undefined` where it has none. */
export function sheetBox(root: ReactTestInstance): { gap?: number; minHeight?: number } {
  const [column] = root.findAll((one) => one.props.accessibilityViewIsModal === true);
  if (column === undefined) throw new Error('no sheet is up in this tree');
  const { gap, minHeight } = StyleSheet.flatten(column.props.style) as {
    gap?: number;
    minHeight?: number;
  };
  return { gap, minHeight };
}

/** Every line of words under a node, in order. */
export function wordsIn(root: ReactTestInstance): string[] {
  return root
    .findAllByType(Text)
    .map((one) => [one.props.children].flat(Number.POSITIVE_INFINITY).join(''));
}
