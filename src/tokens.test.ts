import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

import { font, height, photo, radius, space, themes, type } from '@/theme';

/**
 * The tokens themselves, held against the two things about them that can be wrong without anybody
 * noticing on a screen: a pair that does not carry enough contrast to be read, and a typeface that
 * cannot draw the alphabet the product is written in.
 *
 * Spec 10.7 asks for the first one by name — «контраст `muted` на светлом — 4.6 : 1, впритык: при
 * сборке проверить каждую пару, а не одну» — and the second is the whole reason the faces changed:
 * Bricolage Grotesque had no Cyrillic at all.
 */

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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
] as const;

test.each(['dark', 'light'] as const)('every pair of %s reads at the floor or above', (name) => {
  const { color } = themes[name];
  for (const [what, words, ground] of PAIRS) {
    const ratio = contrast(color[words], color[ground]);
    expect(ratio, `${what} — ${words} on ${ground} is ${ratio.toFixed(2)} : 1`).toBeGreaterThanOrEqual(4.5);
  }
});

test.each(['dark', 'light'] as const)('%s keeps faint for what is unavailable, and only that', (name) => {
  // Spec 10.1: `faint` is under the floor on purpose, so it may never carry a line meant to be
  // read — the readable secondary is `muted`, which is why that one is in the table above and this
  // one is here saying out loud that it is not.
  const { color } = themes[name];
  expect(contrast(color.faint, color.ink)).toBeLessThan(4.5);
  expect(contrast(color.muted, color.ink)).toBeGreaterThanOrEqual(4.5);
});

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
  Unbounded_700Bold: 'node_modules/@expo-google-fonts/unbounded/700Bold/Unbounded_700Bold.ttf',
  Unbounded_600SemiBold:
    'node_modules/@expo-google-fonts/unbounded/600SemiBold/Unbounded_600SemiBold.ttf',
  Onest_400Regular: 'node_modules/@expo-google-fonts/onest/400Regular/Onest_400Regular.ttf',
  Onest_500Medium: 'node_modules/@expo-google-fonts/onest/500Medium/Onest_500Medium.ttf',
  Onest_600SemiBold: 'node_modules/@expo-google-fonts/onest/600SemiBold/Onest_600SemiBold.ttf',
  Onest_700Bold: 'node_modules/@expo-google-fonts/onest/700Bold/Onest_700Bold.ttf',
};

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
  const file = readFileSync(path);
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
