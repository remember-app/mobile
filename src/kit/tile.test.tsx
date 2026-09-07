import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { Tile } from '@/kit/tile';

// The tile draws in the app's current theme, and the theme asks the phone for the stored pick at
// import. Nothing below reads a colour — the phone only has to answer.
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

// The picture itself is `expo-image` because a `ph://` reference needs the Photos framework, and
// the glyphs are Lucide over `react-native-svg` — both are native and neither will import in node.
// What a frame is *marked* with does not depend on either, and this file is only about the mark.
vi.mock('expo-image', () => ({ Image: () => null }));
vi.mock('lucide-react-native', () => ({ Check: () => null, TriangleAlert: () => null }));

/**
 * The one mark the product has for a frame that is picked or open: an ember ring, drawn as a layer
 * over the picture (`.tile--selected::after, .tile--current::after`).
 *
 * Worth pinning because the obvious spelling is the wrong one, and it was the one in the filmstrip:
 * a border on the tile itself. React Native takes a border out of the box the tile already has, so
 * the open frame — the single frame in the strip that must stand out — came out 4px smaller than
 * the frames beside it and gave up that much of its picture to the ring. That reads as a bug in the
 * strip's layout, not as a mark, and it is what the designer measured (TASK-79).
 */

const A = 'https://bucket.example/a.jpg?X-Amz-Signature=aaa';

/** The opening tag of the element carrying `testID`, whatever else the tile drew around it. */
function tag(html: string, testID: string): string {
  return html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testID}"[^>]*>`))?.[0] ?? '';
}

const picked = renderToStaticMarkup(<Tile state="ready" uri={A} selected onPress={() => {}} />);
const open = renderToStaticMarkup(<Tile state="ready" uri={A} current onPress={() => {}} />);

test('the ring is a layer over the frame, not a border cut out of it', () => {
  // `react-native-web` names its generated classes after the property they came from, so a layer
  // pinned to all four edges is readable straight off the markup.
  const ring = tag(open, 'tile-ring');
  for (const property of ['position', 'top', 'bottom', 'left', 'right']) {
    expect(ring).toMatch(new RegExp(`\\br-${property}-`));
  }
});

test('a picked frame and an open one wear the same ring', () => {
  // «Метка выделения в продукте одна» — the same class list on both, or the kit has two marks.
  expect(tag(picked, 'tile-ring')).toBe(tag(open, 'tile-ring'));
});

test('the tick belongs to picking, and the open frame does not wear one', () => {
  expect(tag(picked, 'tile-check')).not.toBe('');
  expect(tag(open, 'tile-check')).toBe('');
});

test('a frame with neither mark is drawn without a ring at all', () => {
  const plain = renderToStaticMarkup(<Tile state="ready" uri={A} onPress={() => {}} />);
  expect(tag(plain, 'tile-ring')).toBe('');
});
