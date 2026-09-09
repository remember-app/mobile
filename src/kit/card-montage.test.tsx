import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { CardMontage } from '@/kit/card-montage';

// The card draws in the app's current theme, and the theme asks the phone for the stored pick at
// import — the phone only has to answer. No native picture module here: the poster is a plain
// `react-native` `Image`, which `react-native-web` renders straight to an `<img>`.
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

// The play glyph is Lucide over `react-native-svg`, native and unimportable in node — same reason
// `tile.test.tsx` mocks it. Nothing here presses play; the mock only has to exist.
vi.mock('lucide-react-native', () => ({ Play: () => null }));

/**
 * TASK-112: a ready montage's card went out without its still because nothing was ever handed to
 * it. The api now sends `poster_url`, threaded through as `poster ?? undefined` (an older montage,
 * or one still being cut, has none). Pinned here rather than only in the text-pin of
 * `memory-screens.test.ts`: that file proves the prop is wired from the api's answer to the card,
 * this proves the card itself does something with it — draws the still when there is one, and falls
 * back to the same dark placeholder as before when there is not, rather than a broken image or a
 * blank card.
 *
 * Rendered through `react-native-web`, which answers for structure only — like `card-memory.test.tsx`,
 * what the phone's own `Image` fetches from a signed url is native and cannot be seen from node.
 */

const URL = 'https://bucket.example/still.jpg?X-Amz-Signature=aaa';

test('a montage with a poster draws it as its still', () => {
  const html = renderToStaticMarkup(
    <CardMontage state="ready" title="Movie" status="Готов" poster={URL} />,
  );
  expect(html).toContain('data-testid="card-montage-poster"');
});

test('a montage with no poster keeps the placeholder, not a broken image', () => {
  const html = renderToStaticMarkup(<CardMontage state="ready" title="Movie" status="Готов" />);
  expect(html).not.toContain('data-testid="card-montage-poster"');
});

/**
 * TASK-135: the worker sends a vertical montage a vertical still, and the card held one horizontal
 * 16/9 frame for every montage and cropped to it — a standing poster was visible as a narrow strip
 * across its middle. `react-native-web` compiles each style value to its own atomic class, so the
 * two shapes are read off the markup by comparing them: what matters is that the standing card is
 * a different frame and a different fit, and that the horizontal one is untouched.
 */
const atom = (html: string, property: string): string | undefined =>
  html.match(new RegExp(`r-${property}-[\\w-]+`))?.[0];

const card = (vertical: boolean): string =>
  renderToStaticMarkup(
    <CardMontage state="ready" title="Movie" status="Готов" poster={URL} vertical={vertical} />,
  );

test('a vertical montage stands its frame up and shows the whole poster', () => {
  const tall = card(true);
  const wide = card(false);

  // The frame — `aspectRatio` 4/5 against 16/9 — and the fit inside it, which
  // `react-native-web` renders as `background-size`: `contain` against `cover`.
  expect(atom(tall, 'aspectRatio')).not.toBe(atom(wide, 'aspectRatio'));
  expect(atom(tall, 'backgroundSize')).not.toBe(atom(wide, 'backgroundSize'));
});

test('a montage said nothing about is the horizontal card it always was', () => {
  // The prop is the whole of the new behaviour: presentational as the card's own doc says, it knows
  // nothing about orientation unless the screen hands it over.
  const untold = renderToStaticMarkup(
    <CardMontage state="ready" title="Movie" status="Готов" poster={URL} />,
  );
  expect(untold).toBe(card(false));
});
