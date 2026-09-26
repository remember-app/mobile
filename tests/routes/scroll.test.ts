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

test('the keyboard goes down the same ways on every screen and sheet', () => {
  // TASK-377: a tap beside a field and a drag of the body take the keyboard down, and a tap on a
  // button leaves it up — said once (`KEYBOARD_SCROLL` in `kit/interaction.ts`) and handed to the
  // board's scroll and the sheet's, so no screen says it differently or forgets to.
  const said = sources
    .filter(([, source]) => /keyboardShouldPersistTaps|keyboardDismissMode/.test(source))
    .map(([path]) => path);
  expect(said).toEqual([]);
  for (const [path, source] of sources.filter(
    ([p]) => p === 'kit/bars.tsx' || p === 'kit/sheet.tsx',
  ))
    expect(flat(source), path).toMatch(/<ScrollView [^>]*\{\.\.\.KEYBOARD_SCROLL\}/);
  // And the keyboard is given way to by one thing: a scroll that moved its insets for it as well
  // would move twice on iOS.
  expect(sources.filter(([, source]) => /automaticallyAdjustKeyboardInsets/.test(source))).toEqual(
    [],
  );
  // A body that is a list scrolls by a list of the screen's own, which the board's keyboard rules do
  // not reach — so no such screen has a field on it.
  const listed = routes
    .filter(([, source]) => /\blist=\{/.test(source))
    .filter(([, source]) => /<(Field|CodeField|TextArea)\b/.test(source))
    .map(([path]) => path);
  expect(listed).toEqual([]);
});

/** Where the expressions of every `name={…}` prop stand in the source, brace to brace. */
const spansOf = (source: string, name: string): [number, number][] => {
  const spans: [number, number][] = [];
  for (const found of source.matchAll(new RegExp(`\\b${name}=\\{`, 'g'))) {
    const start = (found.index ?? 0) + found[0].length - 1;
    let depth = 0;
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') depth -= 1;
      if (depth === 0) {
        spans.push([start, i]);
        break;
      }
    }
  }
  return spans;
};

test('a bar is never in the body and a bottom layer is never in it either: they are the board’s `bar` and `footer`', () => {
  // The body is what scrolls; the bar and the layer are what stands — or, where they no longer can,
  // what the board takes into the scroll itself. Drawn in the body they would scroll away for good.
  // The one layer outside a `footer`: the phone's own photographs on `Upload` run under the status
  // line and to the bottom edge, and the layer that sends what is picked floats over them.
  const uploads = 'app/memory/[id]/upload.tsx';
  const floats = routes.find(([path]) => path === uploads)![1];
  expect(floats).toMatch(/layer: \{ position: 'absolute'/);
  // The wizard's step builds its layer as a value before it hands it to the board, so only its bar
  // is read here; the steps' layers are walked in `order-flow`.
  const screens = [
    ...routes.filter(([path]) => path !== uploads),
    ['screens/order/wizard.tsx', wizard] as const,
  ];
  let bars = 0;
  for (const [path, source] of screens)
    for (const [part, prop] of [
      [/<(AppBar|WizardBar)\b/g, 'bar'],
      // The step's heading is the board's too: it goes into the scroll before the bar does.
      [/<WizardHeading\b/g, 'heading'],
      ...(path.startsWith('screens/') ? [] : [[/<ActionBar\b/g, 'footer'] as const]),
    ] as const) {
      const inside = spansOf(source, prop);
      for (const found of source.matchAll(part)) {
        bars += 1;
        const at = found.index ?? 0;
        expect(
          inside.some(([from, to]) => from < at && at < to),
          `${path}: ${found[0]} outside ${prop}={…}`,
        ).toBe(true);
      }
    }
  expect(bars).toBeGreaterThan(15);
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

test('a block that fills a body grows into it and is never `flex: 1`', () => {
  // A body is a scroll's column: a block with `flex: 1` in it is shrunk to nothing and comes out of
  // the scroll instead of scrolling in it (README, «в теле flex: 1 у блока с содержимым не ставят»).
  // What fills the body is named for it in the styles — the room, the middle, the centre, the body.
  const flexing = sources
    .filter(([path]) => !['kit/bars.tsx', 'kit/sheet.tsx'].includes(path))
    .flatMap(([path, source]) =>
      [
        ...flat(source).matchAll(
          /\b(room|middle|centre|center|body|container|whole)\s*:\s*\{([^}]*)\}/g,
        ),
      ]
        .filter(([, , props]) => /\bflex:\s*1\b/.test(props))
        .map(([, key]) => `${path}: ${key}`),
    );
  // The one that is a full-screen view of its own: the phone's photograph on `Upload`, in a `Modal`.
  expect(flexing).toEqual(['app/memory/[id]/upload.tsx: room']);
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
