import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { Button } from '@/kit/button';
import { setTheme } from '@/theme';

/**
 * A kit component draws in whatever theme the app is in, and the button is the one that carries the
 * most of it: the ember it sits on, the ink read on that ember, and the glow. Pinned here because
 * the way it breaks is silent — a component that keeps a fixed set of its own goes on rendering,
 * just dark in the daylight.
 *
 * Rendered through `react-native-web` (the alias lives in `vitest.config.mjs`), which writes the
 * colours out as `rgba`. What the phone does with them is the pilot's to check.
 */

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

test('the button is drawn in the theme the app is in, not in a fixed one', async () => {
  await setTheme('dark');
  const dark = renderToStaticMarkup(<Button variant="primary" label="Смонтировать" />);
  await setTheme('light');
  const light = renderToStaticMarkup(<Button variant="primary" label="Смонтировать" />);

  // #E4552B on #1A0B05 in the dark room, #B83C19 on #FBF7F1 on the contact sheet.
  expect(dark).toContain('rgba(228,85,43');
  expect(dark).toContain('rgba(26,11,5');
  expect(light).toContain('rgba(184,60,25');
  expect(light).toContain('rgba(251,247,241');
});
