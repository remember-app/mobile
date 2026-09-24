import { StyleSheet } from 'react-native';
import { beforeAll, expect, test } from 'vitest';

import { Filmstrip, type Frame, Mosaic } from '@/kit/filmstrip';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.7 — the viewer's filmstrip and the three mosaics a memory's frames are laid out in. */

const FRAMES: Frame[] = [
  { uri: 'https://b/1.jpg' },
  { uri: 'https://b/2.jpg', video: true },
  { uri: 'https://b/3.jpg' },
  { uri: 'https://b/4.jpg' },
  { uri: 'https://b/5.jpg' },
];

beforeAll(async () => {
  await setTheme('dark');
});

test('the frame in hand is bigger and at full strength, and its neighbours fade out', () => {
  const strip = story(<Filmstrip frames={FRAMES} index={0} />);
  // The strip says which frame is being looked at by size and by strength, never by a mark — and
  // the fade goes by distance: 0.75, then 0.6, then 0.45 for everything past.
  expect(strip).toContain('opacity:0.75');
  expect(strip).toContain('opacity:0.6');
  expect(strip).toContain('opacity:0.45');
  // The open one is not faded at all.
  expect(story(<Filmstrip frames={[FRAMES[0]]} index={0} />)).not.toContain('opacity:');
});

test('moving along the strip moves what is at full strength', () => {
  allDifferent(
    Object.fromEntries(
      [0, 1, 2].map((index) => [String(index), <Filmstrip frames={FRAMES} index={index} />]),
    ),
  );
});

test('a video is marked on the frame in hand and nowhere else', () => {
  // The play dot only ever stands on the current frame — on every neighbour it would be a row of
  // triangles rather than a strip of photographs.
  const onVideo = story(<Filmstrip frames={FRAMES} index={1} />);
  const onPhoto = story(<Filmstrip frames={FRAMES} index={0} />);
  expect(onVideo).toContain('data-glyph');
  expect(onPhoto).not.toContain('data-glyph');
});

test('each frame of the strip says which one it is, and whether it is the open one', () => {
  const strip = story(
    <Filmstrip
      frames={FRAMES}
      index={2}
      onPick={() => {}}
      labelAt={(at) => `Кадр ${at + 1} из 5`}
    />,
  );
  expect(strip).toContain('aria-label="Кадр 1 из 5"');
  expect(strip).toContain('role="button"');
});

test('the two mosaics are two layouts', () => {
  const photos = FRAMES.map((frame) => frame.uri);
  allDifferent({
    cover: <Mosaic photos={photos} layout="cover" />,
    strip: <Mosaic photos={photos} layout="strip" />,
  });
});

test('a mosaic with too few frames leaves the empty cells plain rather than repeating one', () => {
  // Spec 7.6: a memory with fewer than three frames fills what it has, and the rest stays `surface`.
  const three = story(<Mosaic photos={['https://b/1.jpg']} layout="cover" />);
  expect(three.match(/data-testid="image"/g) ?? []).toHaveLength(1);
  // The cells are still all there — the shape of a cover does not depend on how full it is.
  expect(story(<Mosaic photos={[]} layout="cover" />)).not.toBe('');
});

test('a mosaic is a background and carries no words of its own', () => {
  expect(story(<Mosaic photos={['https://b/1.jpg']} />)).not.toContain('aria-label');
});

test('a mosaic never leaves a cell to be measured by a line that wrapped', () => {
  // TASK-176, off a real iPhone: an ordinary memory card drew its name and «4 кадра» and, where
  // the frames belonged, 96 points of bare card. The frames were signed, fetched and handed to
  // this mosaic — and laid out 88 × 0.
  //
  // Yoga defaults `alignContent` to `flex-start` where css defaults it to `stretch`, and
  // react-native-web copies yoga (its View sets `align-content: flex-start` outright), so what a
  // phone does here is what this test sees. Under `flexWrap: 'wrap'` that default means a line is
  // only as tall as what already stands in it — and a cell whose one child is an absolutely
  // positioned picture stands 0 tall. `alignItems: 'stretch'` then stretches every cell to that 0.
  //
  // So: a mosaic either does not wrap, and stretch fills the slot, or it wraps and each cell says
  // outright how big it is. Never the half of that which looks right on the web.
  const photos = FRAMES.map((frame) => frame.uri);

  // The row. Four cells across the full height of the slot, none of them sized by hand — so nothing
  // here may wrap.
  {
    const { container, cells } = mosaic(story(<Mosaic photos={photos} layout="strip" />));
    expect(container['flex-direction']).toBe('row');
    expect(container['flex-wrap']).toBeUndefined();
    expect(cells).toHaveLength(4);
  }

  // The cover is the one that wraps, and it wraps down a column: the big cell fills the first one
  // and the two small ones stack in the second. Wrapped along a row instead, the big cell makes
  // its line as tall as the whole cover and the third frame lands under the bottom edge — 2 × 2
  // and one, with a hole where the last one should be. Every cell is measured both ways, because
  // inside that wrap there is no line to be stretched to.
  const { container, cells } = mosaic(story(<Mosaic photos={photos} layout="cover" />));
  expect(container['flex-direction']).toBe('column');
  expect(container['flex-wrap']).toBe('wrap');
  for (const cell of cells) {
    expect(cell.width).toBeTruthy();
    expect(cell.height).toBeTruthy();
  }
});

/**
 * A mosaic's own box and its cells', as css — the pictures inside the cells are not cells.
 *
 * `story` reads a markup string, and a shape that came out of `StyleSheet.create` is not in it: it
 * is a class hash pointing into the sheet react-native-web compiled. So the layout is read back
 * through that sheet, which is the only place it is written down.
 */
function mosaic(markup: string) {
  const [container, ...cells] = [...markup.matchAll(/<div class="([^"]+)"([^>]*)>/g)]
    .filter(([, , attrs]) => !attrs.includes('data-testid="image"'))
    .map(([, classNames]) => declarations(classNames));
  return { container, cells };
}

/** Every declaration the sheet holds under one element's class names, flattened in order. */
function declarations(classNames: string): Record<string, string> {
  const sheet = (StyleSheet as unknown as { getSheet(): { textContent: string } }).getSheet();
  const out: Record<string, string> = {};
  for (const name of classNames.split(' ')) {
    const rule = sheet.textContent.match(new RegExp(`\\.${name}\\{([^}]*)\\}`))?.[1] ?? '';
    for (const declaration of rule.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon > 0) out[declaration.slice(0, colon)] = declaration.slice(colon + 1);
    }
  }
  return out;
}
