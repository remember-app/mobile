import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

/**
 * Every screen draws in the theme the app is currently in, and none of them keeps a set of its own.
 *
 * Read off the source and over the whole of `src/app` rather than screen by screen: what breaks this
 * is not one of the routes below going wrong, it is the fourteenth one being written by copying the
 * pattern that stood here before TASK-89 — a module-scope `StyleSheet.create` reading a fixed set.
 * That screen would look right to whoever wrote it, in the theme they wrote it in, and only turn up
 * as a dark screen under light chrome on somebody else's phone. A test that names today's routes
 * would not see it; this one sweeps whatever is there.
 *
 * As text and not rendered, the same reason `memory-screens.test.ts` gives: these are `expo-router`
 * routes wired to auth and the api, and there is no renderer here for one.
 */

const APP = fileURLToPath(new URL('./app/', import.meta.url));

/** Every route under `src/app`, at any depth. */
function routes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) return routes(`${path}/`);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

const screens = routes(APP).map((path) => [path.slice(APP.length), readFileSync(path, 'utf8')]);

test('there are screens to check at all', () => {
  // Guards the sweep itself: a rename of `src/app` would otherwise leave every test below passing
  // over an empty list.
  expect(screens.length).toBeGreaterThanOrEqual(13);
});

test.each(screens)('%s takes its colour from the live theme', (_name, source) => {
  // The two fixed sets the kit holds. A screen naming either one is drawing in a theme the app may
  // not be in — the sets are `theme.ts`'s own business and it hands out `useTheme()`/`themed()`.
  expect(source).not.toMatch(/\bthemes\.(dark|light)\b/);
  expect(source).not.toMatch(/\bshades\.(dark|light)\b/);
  // A style sheet built once at module scope cannot answer a switch. Either it is wrapped in
  // `themed(...)` — which is a hook and redraws — or the screen has no colour in it to redraw.
  for (const sheet of source.matchAll(/StyleSheet\.create\(\{[\s\S]*?\n\}\)/g)) {
    expect(sheet[0]).not.toMatch(/color\.|shade\./);
  }
});
