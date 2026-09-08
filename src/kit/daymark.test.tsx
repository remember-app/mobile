import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { DayMark } from '@/kit/daymark';
import { setTheme } from '@/theme';

// The theme asks the phone for the stored pick at import, and `expo-secure-store` is native — it
// cannot be imported in node at all. The mark reads two colours through the theme, so the phone has
// to answer before either can be asked for.
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

/**
 * The day over a strip of the contact sheet: the date, and the one thing that belongs to that day
 * at the right edge. Rendered through `react-native-web` (the alias lives in `vitest.config.mjs`),
 * which answers for structure and for whether a colour moved — the two things this brick has.
 */

test('the day is written with whatever belongs to it after the line', () => {
  const html = renderToStaticMarkup(
    <DayMark label="Снято 3 сентября">
      <button type="button">Выбрать все 61</button>
    </DayMark>,
  );

  expect(html.indexOf('Снято 3 сентября')).toBeLessThan(html.indexOf('Выбрать все 61'));
});

test('and it turns with the theme, like everything else in the kit', async () => {
  // The hairline is `color.line`, which is a different colour in each of the two sets — a mark that
  // came out identical is one whose colours were written into a sheet built once at import.
  await setTheme('light');
  const light = renderToStaticMarkup(<DayMark label="Снято 3 сентября" />);
  await setTheme('dark');
  const dark = renderToStaticMarkup(<DayMark label="Снято 3 сентября" />);

  expect(light).not.toBe(dark);
});
