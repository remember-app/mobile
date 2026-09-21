import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import memory from './app/memory/[id].tsx?raw';
import films from './memory/films.tsx?raw';
import frames from './memory/frames.tsx?raw';
import viewer from './memory/frame-viewer.tsx?raw';
// The one component, not the barrel: `@/kit` reaches native modules node cannot parse, and this
// needs the smallest thing in the kit that reads a colour.
import { Text } from '@/kit/text';
import { setTheme, ThemePin, themes } from '@/theme';

// `@/theme` reads the stored pick on import, and `expo-secure-store` is native — it does not exist
// under vitest. `theme.test.ts` mocks it the same way; here nothing asks it anything, so the store
// only has to be there. What the theme currently is does not matter below: both sets are read by
// name, which is the point — the pinned values must not depend on which one is live.
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

/**
 * Every screen draws in the theme the app is currently in — with the one exception the kit itself
 * writes down, pinned below so it cannot be lost either.
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
// `src/memory/` is swept with the routes: the three faces of a memory are screen-sized pieces that
// live outside `src/app` only because everything inside it is a route, and the rule they have to
// keep is the routes' own (TASK-101). The order's wizard shell is here for the same reason — it
// draws the chrome every step of the order stands in (TASK-216).
const screens = Object.entries(
  import.meta.glob<string>('./{app/**/*,memory/**/*,order-wizard}.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

test('there are screens to check at all', () => {
  // Guards the sweep itself: a move of `src/app` would otherwise leave every case below passing
  // over an empty list.
  expect(screens.length).toBeGreaterThanOrEqual(13);
});

test.each(screens)('%s builds no fixed sheet of its own', (_path, source) => {
  // A sheet built once at module scope cannot answer a switch. Either it is wrapped in `themed(…)`
  // — which makes it a hook, and it redraws — or every colour in it is one the kit pins on purpose,
  // which is `themes.dark` spelled out and checked by name below, never a live `color`/`shade`.
  for (const sheet of source.matchAll(/StyleSheet\.create\(\{[\s\S]*?\n\}\)/g)) {
    expect(sheet[0]).not.toMatch(/\bcolor\.|\bshade\./);
  }
});

test.each(screens)('%s writes no colour of its own', (_path, source) => {
  // The other half of the same rule, and the one that decides whether the light theme exists at all:
  // both themes are the same drawing with the tokens swapped (spec 2), so a hex or an `rgba(…)`
  // spelled out on a screen is a spot that stays night-coloured in daylight. Everything a screen
  // draws in comes from `@/theme` through the kit — the photograph's own layer (`photo`) included,
  // which is pinned there on purpose and not here by hand.
  //
  // Comments are stripped first: the layout's own numbers are quoted in a few of them, and a note
  // saying which token replaced a hex is the opposite of the mistake this is looking for.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  expect(code).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
  expect(code).not.toMatch(/\brgba?\(/);
});

/**
 * The kit's one deliberate exception, block 0.2: `.viewer` sits in the dark-pinned selector list
 * beside `:root` and `[data-theme="dark"]` — «открытый на весь экран кадр остаётся тёмной комнатой
 * в любой теме. Вокруг фотографии не должно быть ничего светлее её самой». The kit demonstrates it
 * with a `data-theme="light"` figure whose viewer is still dark, and `.filmstrip` inherits the pin
 * by sitting inside `.viewer` in that same markup.
 *
 * Worth its own test because it reads as a bug: the obvious «fix» is to make these follow the theme
 * like everything else on the screen, which is exactly what this milestone did before the kit was
 * re-read. Pinned to the values and not just to the spelling, so swapping `room` back to the live
 * `color` fails here rather than in somebody's eyes.
 */
test('the open frame stays a dark room in both themes', () => {
  // Light is the theme the mistake shows up in: `ink` there is a pale mat board.
  expect(themes.light.color.ink).not.toBe(themes.dark.color.ink);

  expect(viewer).toContain('const room = themes.dark.color;');
  expect(viewer).toContain('viewer: { flex: 1, backgroundColor: room.ink }');
  // The gallery behind the window is interface and does turn with the theme: nothing of the room is
  // left on that face since the window became a file of its own (TASK-147).
  expect(frames).not.toContain('themes.dark');

  expect(films).toContain('const room = themes.dark.color;');
  expect(films).toContain('viewer: { flex: 1, backgroundColor: room.ink, justifyContent:');

  // And the room is pinned for what is drawn *in* it, not only for the sheet under it: the
  // filmstrip, a `Banner`, an `Empty`, the floating bar's own glass — every one of them asks
  // `useTheme()` for itself, and the strip is the whole width of the window.
  expect(viewer).toContain('<ThemePin value="dark">');
  expect(films).toContain('<ThemePin value="dark">');
  expect(viewer.indexOf('<ThemePin value="dark">')).toBeLessThan(viewer.indexOf('<Filmstrip'));
});

/**
 * The pin itself, rendered rather than read: a kit component under it has to answer with the dark
 * set while the app is in daylight. This is the half the two `room` sheets cannot cover — they are
 * the container, and everything the container holds carries its own colours.
 */
test('a kit component inside the pin draws dark while the app is light', async () => {
  await setTheme('light');

  const pinned = renderToStaticMarkup(
    <ThemePin value="dark">
      <Text>Костя</Text>
    </ThemePin>,
  );
  const loose = renderToStaticMarkup(<Text>Костя</Text>);

  await setTheme('dark');
  const room = renderToStaticMarkup(<Text>Костя</Text>);

  // Compared against the app's own two renders rather than against a colour spelled out here:
  // `react-native-web` hashes a style into a class name, and the hash is the value — same class,
  // same `paper`. The pin has to move the line off the light one and land it exactly on the dark.
  expect(pinned).not.toBe(loose);
  expect(pinned).toBe(room);
});

test('and the screens around it still turn with the theme', () => {
  // The grid behind the viewer is interface, not the room a photograph is looked at in. Naming it
  // here keeps the pin above from being widened into «this whole file is dark» by the next reader.
  // The ink under all three faces is the screen's own now, so this is where it is spelled out.
  expect(memory).toContain('screen: { flex: 1, backgroundColor: color.ink }');
});
