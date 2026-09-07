import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { Segment } from '@/kit/segment';
import { setTheme } from '@/theme';

/**
 * The kit's switch of two or three (section 15). What it has to get right is the thing a `Switch`
 * gets wrong: every value on the screen at once, and exactly one of them raised out of the row.
 *
 * Rendered through `react-native-web` (the alias lives in `vitest.config.mjs`), which writes the
 * colours out as `rgba` — the same idiom `button.test.tsx` explains.
 */

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

const theme = (
  <Segment
    label="Тема"
    value="dark"
    onChange={() => {}}
    options={[
      { value: 'system', label: 'Как в телефоне' },
      { value: 'dark', label: 'Тёмная' },
      { value: 'light', label: 'Светлая' },
    ]}
  />
);

test('all three values stand there at once, and one of them is picked', async () => {
  await setTheme('dark');
  const html = renderToStaticMarkup(theme);

  // Nobody opens a list to find out what a product offers — that is the whole reason this is not a
  // picker, and each pill is a radio in its own right rather than a button that happens to look
  // like one.
  expect(html.match(/role="radio"/g)).toHaveLength(3);
  for (const label of ['Как в телефоне', 'Тёмная', 'Светлая']) expect(html).toContain(label);

  // `.segment input:checked + label`: raise under it and paper to read it in, once — a row with two
  // of them raised is not a radiogroup. The other two stay muted.
  expect(html.match(/rgba\(38,32,25/g)).toHaveLength(1); // raise
  expect(html.match(/rgba\(242,236,227/g)).toHaveLength(1); // paper
  expect(html.match(/rgba\(148,138,127/g)).toHaveLength(2); // muted
});

test('and the row turns with the theme like everything else in the kit', async () => {
  await setTheme('light');
  const html = renderToStaticMarkup(theme);

  // #E5DACA on the contact sheet where the dark room has #262019, and nothing of the dark left.
  expect(html.match(/rgba\(229,218,202/g)).toHaveLength(1);
  expect(html).not.toContain('rgba(38,32,25');
});
