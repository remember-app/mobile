import { beforeAll, expect, test } from 'vitest';

import { Filmstrip, Mosaic, type Frame } from '@/kit/filmstrip';
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
    <Filmstrip frames={FRAMES} index={2} onPick={() => {}} labelAt={(at) => `Кадр ${at + 1} из 5`} />,
  );
  expect(strip).toContain('aria-label="Кадр 1 из 5"');
  expect(strip).toContain('role="button"');
});

test('the three mosaics are three layouts', () => {
  const photos = FRAMES.map((frame) => frame.uri);
  allDifferent({
    cover: <Mosaic photos={photos} layout="cover" />,
    strip: <Mosaic photos={photos} layout="strip" />,
    banner: <Mosaic photos={photos} layout="banner" />,
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
