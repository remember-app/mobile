import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { CardMemory } from '@/kit/card-memory';

/**
 * The card is the main screen's one repeated thing, and what it is for is the frames: the listing
 * signs a couple of thumbnail urls per memory and the card has to draw them. That wiring is one
 * prop deep and silent when it breaks — the card keeps rendering, just with nothing in it — so it
 * is pinned here.
 *
 * Rendered through `react-native-web` (the alias lives in `vitest.config.mjs`), which answers for
 * structure only: how many frames the card draws and what it does with none. What the phone's own
 * `Image` fetches from a signed url is native and cannot be seen from node — that part is the
 * pilot's to check.
 */

const A = 'https://bucket.example/a.jpg?X-Amz-Signature=aaa';
const B = 'https://bucket.example/b.jpg?X-Amz-Signature=bbb';

/** Every frame the card drew, by the `testID` each one carries. */
function frames(html: string): number {
  return html.split('data-testid="card-memory-frame"').length - 1;
}

test('draws one frame for every url the listing signed', () => {
  const html = renderToStaticMarkup(
    <CardMemory title="Лёшина свадьба" meta={['3 сентября', '128 кадров']} thumbs={[A, B]} />,
  );

  expect(frames(html)).toBe(2);
  expect(html).toContain('Лёшина свадьба');
  expect(html).toContain('128 кадров');
});

test('a memory nobody has added to yet says so instead of drawing empty frames', () => {
  const html = renderToStaticMarkup(
    <CardMemory
      title="Поездка в Карелию"
      meta={['12–16 августа']}
      thumbs={[]}
      blank="Пока ни одного кадра."
    />,
  );

  expect(frames(html)).toBe(0);
  expect(html).toContain('Поездка в Карелию');
  expect(html).toContain('Пока ни одного кадра.');
});

test('the field missing altogether is the empty memory, not a crash', () => {
  // An older api sends no `recent_thumbnail_urls` at all, and the screen turns that into no
  // thumbs; the prop is optional so the card must stand without it either way.
  const html = renderToStaticMarkup(<CardMemory title="Сплав" meta={['1 мая']} />);

  expect(frames(html)).toBe(0);
  expect(html).toContain('Сплав');
});
