import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { contrast, luminance } from '@tests/helpers/contrast';
import { expect, test } from 'vitest';

import {
  board,
  font,
  height,
  night,
  photo,
  radius,
  space,
  themes,
  type,
  viewerFoot,
} from '@/theme';

/**
 * The tokens themselves, held against the two things about them that can be wrong without anybody
 * noticing on a screen: a pair that does not carry enough contrast to be read, and a typeface that
 * cannot draw the alphabet the product is written in.
 *
 * Spec 10.7 asks for the first one by name — «контраст `muted` на светлом — 4.6 : 1, впритык: при
 * сборке проверить каждую пару, а не одну» — and the second is the whole reason the faces changed:
 * Bricolage Grotesque had no Cyrillic at all.
 */

/** Every pair the product actually reads text on, in both themes. Name, words, ground. */
const PAIRS = [
  ['the text on the screen', 'paper', 'ink'],
  ['the text on a card', 'paper', 'surface'],
  ['the text on a chip', 'paper', 'raise'],
  ['a secondary line on the screen', 'muted', 'ink'],
  ['a secondary line on a card', 'muted', 'surface'],
  ['a secondary line on a chip', 'muted', 'raise'],
  ['the accent read as text', 'accentText', 'ink'],
  ['the accent read as text on a card', 'accentText', 'surface'],
  ['a dangerous line', 'dangerText', 'ink'],
  ['a dangerous line on a card', 'dangerText', 'surface'],
  ['what is read on the accent', 'onFill', 'accent'],
  ['what is read on a dangerous fill', 'onFill', 'dangerFill'],
  ['what is read on the spark', 'sparkInk', 'spark'],
  ['the ink of a chosen pill', 'ink', 'paper'],
  // A chosen choice card is `accentSoft` with both its floors of words on it — spec 7.3, detail 21.
  ['the name on a chosen card', 'paper', 'accentSoft'],
  ['the line under it', 'muted', 'accentSoft'],
] as const;

test.each(['dark', 'light'] as const)('every pair of %s reads at the floor or above', (name) => {
  const { color } = themes[name];
  for (const [what, words, ground] of PAIRS) {
    const ratio = contrast(color[words], color[ground]);
    expect(
      ratio,
      `${what} — ${words} on ${ground} is ${ratio.toFixed(2)} : 1`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test.each(['dark', 'light'] as const)(
  '%s keeps faint for what is unavailable, and only that',
  (name) => {
    // Spec 10.1: `faint` is under the floor on purpose, so it may never carry a line meant to be
    // read — the readable secondary is `muted`, which is why that one is in the table above and this
    // one is here saying out loud that it is not.
    const { color } = themes[name];
    expect(contrast(color.faint, color.ink)).toBeLessThan(4.5);
    expect(contrast(color.muted, color.ink)).toBeGreaterThanOrEqual(4.5);
  },
);

test('the two themes are the same tokens with other values in them', () => {
  // Any theme is built by substitution (spec 2), so a token missing on one side is a component that
  // draws in one theme and crashes in the other.
  expect(Object.keys(themes.dark.color).sort()).toEqual(Object.keys(themes.light.color).sort());
  // Three of them are deliberately the same value in both, and each for a stated reason: white is
  // read on a fill in either theme, the fill of an irreversible action is that one red wherever it
  // stands, and spec 10.5 settles a single dangerous border for the whole product.
  const shared = new Set(['onFill', 'dangerFill', 'dangerEdge']);
  for (const key of Object.keys(themes.dark.color) as (keyof typeof themes.dark.color)[]) {
    if (shared.has(key)) {
      expect(themes.dark.color[key], key).toBe(themes.light.color[key]);
    } else {
      expect(themes.dark.color[key], key).not.toBe(themes.light.color[key]);
    }
  }
});

test('the values the spec writes out for the day are the day’s, digit for digit', () => {
  // Spec 2, «День»: the twelve tokens it names. Two of them were once a digit off in the code
  // (`sparkInk` #15151C for #16180A, `dashed` #D2CBBB for #D3CCBB), and a contrast test does not
  // notice a digit.
  const { color } = themes.light;
  expect({
    ink: color.ink,
    surface: color.surface,
    raise: color.raise,
    line: color.line,
    paper: color.paper,
    muted: color.muted,
    accent: color.accent,
    spark: color.spark,
    sparkInk: color.sparkInk,
    danger: color.danger,
    dangerText: color.dangerText,
    dashed: color.dashed,
  }).toEqual({
    ink: '#F2EFE7',
    surface: '#FFFFFF',
    raise: '#F7F4EC',
    line: '#E4DFD3',
    paper: '#15151C',
    muted: '#6C6979',
    accent: '#3B3FE0',
    spark: '#DCF531',
    sparkInk: '#16180A',
    danger: '#D93A3A',
    dangerText: '#A82C2C',
    dashed: '#D3CCBB',
  });
  // And the night's «Не собрался» plate is the spec's rgba(206,48,40,.16) — the same red as the
  // day's, and not a brighter one.
  expect(themes.dark.color.failedSoft).toBe('rgba(206,48,40,0.16)');
});

test('`night` is the dark set, and the action menu’s shadow is one value in both themes', () => {
  // What is drawn on glass or on a photograph reads in the night's colours in either theme (spec 2).
  expect(night).toBe(themes.dark.color);
  expect(photo.menuShadow).toBe('0 18px 50px rgba(0,0,0,0.55)');
});

test('the day lifts a card with a shadow where the night lifts it with a border', () => {
  // The first of the day's three departures from plain substitution (spec 2).
  expect(themes.dark.shadow.card).toBe('none');
  expect(themes.light.shadow.card).toContain('rgba(28,24,14,0.05)');
  expect(themes.light.shadow.cardLarge).toContain('rgba(28,24,14,0.10)');
  // And the main button's own shadow is softer in daylight than at night.
  expect(themes.dark.shadow.primary).toContain('rgba(75,91,255,0.38)');
  expect(themes.light.shadow.primary).toContain('rgba(59,63,224,0.28)');
});

test('what lies on a photograph is the same in both themes, and is dark in both', () => {
  // The second departure: the darkening over a cover stays dark in daylight and the words on it
  // stay white, because they lie on the picture and not on the interface.
  expect(photo.on).toBe('#FFFFFF');
  expect(photo.cover).toContain('rgba(7,7,13,.95)');
  expect(photo.mark).toBe('rgba(9,9,14,0.72)');
  // And the third: the spark is bright in both, so what is read on it is dark in both.
  expect(luminance(themes.dark.color.sparkInk)).toBeLessThan(0.1);
  expect(luminance(themes.light.color.sparkInk)).toBeLessThan(0.1);
});

test('a plate over a photograph is one of two values, each held by its place', () => {
  // Spec 2 and 10.10: not a range from .55 to .60 but two exact values — `.60` under the author and
  // «СЕЙЧАС» on the card «Сейчас» and under the template on the summary's poster; `.55` under the
  // length on a template's tile and under a date on the spine.
  expect(photo.plate).toBe('rgba(11,11,18,0.60)');
  expect(photo.plateQuiet).toBe('rgba(11,11,18,0.55)');
});

test('the spine brightens from its line out to the date', () => {
  // Spec 7.8, detail 66: the line .22 and nothing else at it, the tick .35, the dot .6, the date .72.
  expect([photo.spine, photo.spineTick, photo.spineDot, photo.spineMark]).toEqual([
    'rgba(245,243,238,0.22)',
    'rgba(245,243,238,0.35)',
    'rgba(245,243,238,0.6)',
    'rgba(245,243,238,0.72)',
  ]);
});

test('the viewer’s pause stands on dark and not on glass, and its second voice is paper at 66%', () => {
  // Spec 7.2, «над видео»; 7.1 detail 5 and 7.10 for the pill's second line and a video's length.
  expect(photo.video).toBe('rgba(6,6,10,0.5)');
  expect(photo.viewerMeta).toBe('rgba(245,243,238,0.66)');
});

test('a video’s timecodes are the meta’s size a weight up', () => {
  // Spec 7.10: 12 / 600 and tabular, not `meta` 500.
  expect(type.timecode.fontFamily).toBe(font.semi);
  expect(type.timecode.fontSize).toBe(type.meta.fontSize);
  expect(type.timecode.fontVariant).toEqual(['tabular-nums']);
});

test('the foot of the frame window puts a photograph 96 above the bottom and a video 140', () => {
  // Spec 8, `Viewer` and `ViewerVideo`: the strip 48 stands `board.bottom` off the edge; a video's
  // scrubber is a 36 row 14 over it. 704 of 844 is where the video ends, 716–752 the scrubber.
  const strip = 48;
  const track = 36;
  expect(viewerFoot.photo + strip + board.bottom).toBe(96);
  expect(viewerFoot.video + track + viewerFoot.track + strip + board.bottom).toBe(140);
  expect(viewerFoot.track).toBe(14);
});

test('one dangerous border everywhere, which is what spec 10.5 settles', () => {
  for (const name of ['dark', 'light'] as const) {
    expect(themes[name].color.dangerEdge).toBe('rgba(206,48,40,0.45)');
  }
});

test('the rhythm, the radii and the heights are the spec’s own numbers', () => {
  expect(Object.values(space)).toEqual([4, 8, 12, 16, 20, 24, 32, 48]);
  // Radii by role, every one of them a number the layout actually draws (spec 4).
  expect(Object.values(radius)).toEqual([4, 10, 12, 14, 16, 18, 20, 22, 26, 28, 999]);
  expect(height.primary).toBe(56);
  expect(height.tile).toBe(117);
  expect(height.row).toBe(64);
});

/**
 * The faces, read off the files that ship. Both have to draw Cyrillic — that is what the change of
 * typeface was *for*, and a package whose metadata claims a subset it does not carry would look
 * exactly like a package that does.
 */
const FACES = {
  Unbounded_700Bold: '@expo-google-fonts/unbounded/700Bold/Unbounded_700Bold.ttf',
  Unbounded_600SemiBold: '@expo-google-fonts/unbounded/600SemiBold/Unbounded_600SemiBold.ttf',
  Onest_400Regular: '@expo-google-fonts/onest/400Regular/Onest_400Regular.ttf',
  Onest_500Medium: '@expo-google-fonts/onest/500Medium/Onest_500Medium.ttf',
  Onest_600SemiBold: '@expo-google-fonts/onest/600SemiBold/Onest_600SemiBold.ttf',
  Onest_700Bold: '@expo-google-fonts/onest/700Bold/Onest_700Bold.ttf',
};

/**
 * Where a face actually lies, asked of the module resolver rather than spelled out from the working
 * directory: `node_modules/…` is only the answer when the test is run from the root of the checkout,
 * and a git worktree — which is where an agent builds — has its own root and the packages in the
 * other one.
 */
const resolve = createRequire(import.meta.url).resolve;

/** Whether a TrueType file's character map covers a code point. Formats 4 and 12, which is all
 *  Google's own builds ever use. */
function covers(file: Buffer, code: number): boolean {
  const tables = file.readUInt16BE(4);
  let cmap = 0;
  for (let i = 0; i < tables; i += 1) {
    const at = 12 + 16 * i;
    if (file.toString('latin1', at, at + 4) === 'cmap') cmap = file.readUInt32BE(at + 8);
  }
  if (!cmap) return false;

  for (let i = 0; i < file.readUInt16BE(cmap + 2); i += 1) {
    const sub = cmap + file.readUInt32BE(cmap + 4 + 8 * i + 4);
    const format = file.readUInt16BE(sub);
    if (format === 4) {
      const segments = file.readUInt16BE(sub + 6) / 2;
      for (let s = 0; s < segments; s += 1) {
        const end = file.readUInt16BE(sub + 14 + 2 * s);
        const start = file.readUInt16BE(sub + 16 + segments * 2 + 2 * s);
        if (start <= code && code <= end) return true;
      }
    } else if (format === 12) {
      const groups = file.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g += 1) {
        const at = sub + 16 + 12 * g;
        if (file.readUInt32BE(at) <= code && code <= file.readUInt32BE(at + 4)) return true;
      }
    }
  }
  return false;
}

test.each(Object.entries(FACES))('%s draws Cyrillic', (_name, path) => {
  const file = readFileSync(resolve(path));
  // «А», «я», «ё» — the ends of the alphabet and the letter a partial subset drops first.
  for (const letter of ['А', 'я', 'ё', 'Ё']) {
    expect(covers(file, letter.codePointAt(0)!), letter).toBe(true);
  }
});

test('every role in the scale is drawn in a face the app actually loads', () => {
  const loaded = new Set(Object.keys(FACES));
  for (const face of Object.values(font)) expect(loaded).toContain(face);
  for (const [role, style] of Object.entries(type)) {
    expect(loaded, role).toContain((style as { fontFamily?: string }).fontFamily);
  }
});
