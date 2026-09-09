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
