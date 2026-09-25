import { flat } from '@tests/helpers/source';
import { expect, test } from 'vitest';

import wizard from '@/screens/order/wizard.tsx?raw';

/**
 * Every screen scrolls once what is on it outgrows the phone — the smallest one at the largest
 * system type included — and it does so in one place: the board every screen stands on (`Board`,
 * `src/kit/bars.tsx`), and through it the wizard's step (TASK-372). Read off the sources and not a
 * render, so a screen nobody has drawn in a test is held to it too, and a new route that stands on
 * a `View` of its own fails here before it strands a button under the edge of somebody's phone.
 */

const read = (files: Record<string, string>) =>
  Object.entries(files).map(([path, source]) => [path.replace(/^.*\/src\//, ''), source] as const);

const routes = read(
  import.meta.glob<string>('@/app/**/*.tsx', { query: '?raw', import: 'default', eager: true }),
).filter(([path]) => !path.endsWith('_layout.tsx'));
const sources = read(
  import.meta.glob<string>('@/{app,screens,kit}/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

/**
 * The routes that do not stand on the board, and why — each of them is still reachable whole:
 *
 * - `+not-found` draws nothing at all: it is a redirect to whatever the gate owes the session.
 * - `memory/[id]` is the feed, and the feed is a list the height of the phone: it scrolls by itself,
 *   under a glass bar and a bottom layer that float over it rather than take room from it. It pads
 *   itself by what floats as it came out (`screens/memory/frames.tsx`), not by the drawing.
 */
const OFF_BOARD = ['app/+not-found.tsx', 'app/memory/[id].tsx'];

test('every screen stands on the board, directly or through the wizard’s step', () => {
  expect(routes.length).toBeGreaterThan(20);
  const off = routes
    .filter(([, source]) => !/<Board\b/.test(source) && !/<WizardStep\b/.test(source))
    .map(([path]) => path);
  expect(off.sort()).toEqual(OFF_BOARD);
  // And the step is the board.
  expect(wizard).toContain('<Board');
});

test('no screen scrolls up and down by a scroll of its own', () => {
  // The board's body and the sheet's are the two vertical scrolls; a strip that runs sideways is a
  // strip (spec 1, rule 5 — the films over the feed, the filmstrip of the viewer).
  const own = sources
    .filter(([path]) => path !== 'kit/bars.tsx' && path !== 'kit/sheet.tsx')
    .filter(([, source]) =>
      [...flat(source).matchAll(/<(Animated\.)?ScrollView\b[^>]*>/g)].some(
        ([tag]) => !/\bhorizontal\b/.test(tag),
      ),
    )
    .map(([path]) => path);
  expect(own).toEqual([]);
});

test('a list is handed the bar and the bottom layer by the board, or is the feed', () => {
  // A list scrolls by itself, so it is the board's body through `list` — which hands it the bar
  // and the layer to carry at its head and foot once those no longer fit standing still.
  const lists = sources
    .filter(([, source]) => /<(Animated\.)?FlatList\b/.test(source))
    .map(([path, source]) => [path, source] as const);
  expect(lists.length).toBeGreaterThan(3);
  for (const [path, source] of lists) {
    if (path === 'kit/filmstrip.tsx') expect(flat(source)).toContain('horizontal');
    else if (path === 'screens/memory/frames.tsx')
      expect(source).toContain('paddingBottom: bottom');
    else expect(source, path).toContain('list={');
  }
});

test('the keyboard is given way to by the board alone', () => {
  const avoiding = sources
    .filter(([, source]) => /<KeyboardAvoidingView\b/.test(source))
    .map(([path]) => path);
  // The board, and the sheet — which is a window of its own over the board.
  expect(avoiding.sort()).toEqual(['kit/bars.tsx', 'kit/sheet.tsx']);
  // So every screen with a field in it is a screen on the board: the field and the button that
  // sends it are never left under the keyboard.
  const typed = routes
    .filter(([, source]) => /<(Field|CodeField|TextArea)\b/.test(source))
    .map(([path]) => path);
  expect(typed.length).toBeGreaterThan(3);
  for (const [path, source] of routes.filter(([p]) => typed.includes(p)))
    expect(/<Board\b|<WizardStep\b/.test(source), path).toBe(true);
});

/** What a `list={…}` prop of the board holds: the expression between its braces. */
const listOf = (source: string): string => {
  const at = source.indexOf('list={');
  if (at < 0) return '';
  let depth = 0;
  for (let i = at + 5; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(at + 6, i);
  }
  return '';
};

test('a vertical list stands only in the board’s `list`, never inside the scroll of its body', () => {
  // A list in the body's own column is a list inside a scroll: it would draw every row and never
  // recycle one. Every list of a screen is the one the board is handed.
  const lists = routes.filter(([, source]) => /<(Animated\.)?FlatList\b/.test(source));
  expect(lists.map(([path]) => path).sort()).toEqual([
    'app/index.tsx',
    'app/memory/[id]/montage/[montageId]/stage/[stage].tsx',
    'app/memory/[id]/order/frames.tsx',
    'app/memory/[id]/upload.tsx',
  ]);
  for (const [path, source] of lists)
    expect(listOf(source).match(/<FlatList\b/g), path).toHaveLength(
      source.match(/<FlatList\b/g)?.length ?? 0,
    );
});

/**
 * The windows that cover a screen or a part of it, and why none is a scroll of the board's: a sheet
 * and a menu are windows of their own over it; the frame viewer, the film player and the phone's
 * photograph on `Upload` are full-screen views to look at — and each answers the system's own «back»,
 * so nothing in them is out of reach.
 */
const WINDOWS = [
  'app/memory/[id]/upload.tsx',
  'kit/menu.tsx',
  'kit/sheet.tsx',
  'screens/memory/film-player.tsx',
  'screens/memory/frame-viewer.tsx',
];

test('the windows over a screen are the named ones, and each closes on the system’s back', () => {
  const windows = sources.filter(([, source]) => /<Modal\b/.test(source));
  expect(windows.map(([path]) => path).sort()).toEqual(WINDOWS);
  for (const [path, source] of windows)
    expect(flat(source), path).toMatch(/<Modal [^>]*onRequestClose=/);
});
