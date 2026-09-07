import { expect, test } from 'vitest';

/**
 * Every screen draws in the theme the app is currently in, and none of them keeps a set of its own.
 *
 * Read off the source and over the whole of `src/app` rather than screen by screen: what breaks this
 * is not one of today's routes going wrong, it is the fourteenth one being written by copying the
 * pattern that stood here before TASK-89 — a module-scope `StyleSheet.create` reading a fixed set.
 * That screen would look right to whoever wrote it, in the theme they wrote it in, and only turn up
 * as a dark screen under light chrome on somebody else's phone. A test naming the routes by hand
 * would not see it; the glob sweeps whatever is there, so a new screen is covered by existing.
 *
 * As text and not rendered, the same reason `memory-screens.test.ts` gives: these are `expo-router`
 * routes wired to auth and the api, and there is no renderer here for one. `?raw` through the
 * bundler and not `node:fs`, for the reason `raw.d.ts` gives: nothing under `src/` may reach the
 * filesystem, because everything under `src/` runs on a phone.
 */
const screens = Object.entries(
  import.meta.glob<string>('./app/**/*.tsx', { query: '?raw', import: 'default', eager: true }),
);

test('there are screens to check at all', () => {
  // Guards the sweep itself: a move of `src/app` would otherwise leave every case below passing
  // over an empty list.
  expect(screens.length).toBeGreaterThanOrEqual(13);
});

test.each(screens)('%s takes its colour from the live theme', (_path, source) => {
  // The two fixed sets the kit holds. A screen naming either is drawing in a theme the app may not
  // be in — the sets are `theme.ts`'s own business, and it hands out `useTheme()` and `themed()`.
  expect(source).not.toMatch(/\bthemes\.(dark|light)\b/);
  expect(source).not.toMatch(/\bshades\.(dark|light)\b/);
  // A sheet built once at module scope cannot answer a switch. Either it is wrapped in `themed(…)`
  // — which makes it a hook, and it redraws — or the screen has no colour in it to redraw.
  for (const sheet of source.matchAll(/StyleSheet\.create\(\{[\s\S]*?\n\}\)/g)) {
    expect(sheet[0]).not.toMatch(/color\.|shade\./);
  }
});
