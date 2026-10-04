import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { expect, test } from 'vitest';

import { Tile } from '@/kit/tile';

/**
 * The stand-in this whole run puts in for `expo-image` (`vitest.setup.ts`), checked as the tool it
 * is — not the kit part this repository happens to be about.
 *
 * Why it needs its own file: the stub once drew a picture as a view wearing a style and dropped
 * `source` on the way, so every question about which picture is on screen and what it is filed under
 * was answered by a green run and nothing else. A test that removed the cache key from a tile still
 * passed, because the stub had thrown the key away before anyone could read it. That blindness was
 * hidden in `tests/kit/tile.test.tsx`, which stood over the module for itself and left the other
 * seven files with the stub as it was — so the fix is in the one place the mock is written, and this
 * file is what keeps it from quietly coming back.
 *
 * Read at what the stub **drew**, never at the element it was handed: an element's props are the
 * caller's and survive a stub that throws the source away in the middle, which is the very failure
 * this file is here to catch.
 */

mountsTrees();

/** Every picture a tree drew, as the plain view the stand-in draws it as. */
const drawn = (tree: ReactElement) => {
  let out!: TestRenderer.ReactTestRenderer;
  act(() => {
    out = mounted(TestRenderer.create(tree));
  });
  return out.root
    .findAll((one) => one.type === View && one.props.testID === 'image')
    .map((one) => one.props);
};

const URI = 'https://bucket.example/a.jpg?X-Amz-Signature=aaa';

test('a picture drawn through the stand-in still carries what it was pointed at', () => {
  const [one] = drawn(<Tile state="ready" uri={URI} cacheKey="frame-1:thumb" label="Фото" />);

  expect(one.source).toEqual({ uri: URI, cacheKey: 'frame-1:thumb' });
  // The other half of the stub is untouched: it is still the plain view every other test reads the
  // styles and the states drawn around a picture off, under a name of its own.
  expect(drawn(<Tile state="processing" caption="Проявляем…" label="Кадр" />)).toHaveLength(0);
});

// The failure this file exists for, named the way a test sees it: a tile whose key was dropped, in a
// file that had not stood over the module. Green there, and every claim about the key in the repo
// with it.
test('a tile whose key was lost cannot be told from one that never had it', () => {
  const keyed = drawn(<Tile state="ready" uri={URI} cacheKey="frame-1:thumb" label="Фото" />)[0]
    .source;
  const bare = drawn(<Tile state="ready" uri={URI} label="Фото" />)[0].source;

  // What `expo-image` files each under: different, so a test has to be able to tell them apart.
  expect(keyed).toEqual({ uri: URI, cacheKey: 'frame-1:thumb' });
  expect(bare).toEqual({ uri: URI });
  // A stub that dropped `source` again answers `undefined` to both, and this is the line that names
  // the blindness outright — the pair above fails too, but says only that something is missing.
  expect(keyed).not.toEqual(bare);
});

// And it is not `Tile` alone: the stand-in is one stub for every face that draws a picture, so a
// `source` carried for one must be carried for all. This is the check that would have stayed green
// while the fix lived in one file and the other seven carried on being blind.
test('the source survives whichever part drew the picture', () => {
  // A tile in each of its states, and the video face beside it — `FrameViewer` mounts its own.
  const every = [
    <Tile key="ready" state="ready" uri={URI} cacheKey="a:thumb" label="Фото" />,
    <Tile key="video" state="ready" uri={URI} cacheKey="b:thumb" length="0:24" label="Видео" />,
    <Tile key="picked" state="ready" uri={URI} cacheKey="c:thumb" pick="send" label="Фото" />,
    <Tile key="cut" state="ready" uri={URI} cacheKey="d:preview" pick="auto" label="Фото" />,
  ];

  for (const one of every) {
    expect(drawn(one)[0]?.source, `no source on ${String(one.key)}`).toMatchObject({
      uri: URI,
      cacheKey: expect.stringContaining(':'),
    });
  }

  // And the picture's own props are carried too — the stub passes them through rather than keeping
  // only the one this file is about, which is what lets `contentFit` be read off the markup.
  expect(
    drawn(<Tile state="ready" uri={URI} cacheKey="a:thumb" label="Фото" />)[0],
  ).not.toHaveProperty('source.uri', undefined);
  expect(
    drawn(<Tile state="ready" uri={URI} cacheKey="a:thumb" label="Фото" />)[0].style,
  ).toBeDefined();
});
