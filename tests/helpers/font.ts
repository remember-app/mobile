import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/**
 * A TrueType file read the way the spec measures words (spec 7.1 and 7.3, «Замер … по файлу шрифта,
 * без кернинга»): which glyph a character is, and how far it advances. Imported by `*.test.*` only.
 */

/**
 * Where a face actually lies, asked of the module resolver rather than spelled out from the working
 * directory: `node_modules/…` is only the answer when the test is run from the root of the checkout,
 * and a git worktree — which is where an agent builds — has its own root and the packages in the
 * other one.
 */
export const fontFile = (path: string): Buffer =>
  readFileSync(createRequire(import.meta.url).resolve(path));

/** Where a table starts, by its tag; 0 when the file has none. */
function table(file: Buffer, tag: string): number {
  for (let i = 0; i < file.readUInt16BE(4); i += 1) {
    const at = 12 + 16 * i;
    if (file.toString('latin1', at, at + 4) === tag) return file.readUInt32BE(at + 8);
  }
  return 0;
}

/**
 * The glyph a code point is drawn with, 0 where the character map has none. Formats 4 and 12, which
 * is all Google's own builds ever use.
 */
export function glyph(file: Buffer, code: number): number {
  const cmap = table(file, 'cmap');
  if (!cmap) return 0;
  for (let i = 0; i < file.readUInt16BE(cmap + 2); i += 1) {
    const sub = cmap + file.readUInt32BE(cmap + 4 + 8 * i + 4);
    const format = file.readUInt16BE(sub);
    if (format === 4) {
      const span = file.readUInt16BE(sub + 6);
      for (let s = 0; s < span / 2; s += 1) {
        const end = file.readUInt16BE(sub + 14 + 2 * s);
        const start = file.readUInt16BE(sub + 16 + span + 2 * s);
        if (code < start || code > end) continue;
        const delta = file.readUInt16BE(sub + 16 + 2 * span + 2 * s);
        const offsetAt = sub + 16 + 3 * span + 2 * s;
        const offset = file.readUInt16BE(offsetAt);
        const found = offset ? file.readUInt16BE(offsetAt + offset + 2 * (code - start)) : code;
        if (found) return (found + delta) & 0xffff;
      }
    } else if (format === 12) {
      for (let g = 0; g < file.readUInt32BE(sub + 12); g += 1) {
        const at = sub + 16 + 12 * g;
        const start = file.readUInt32BE(at);
        if (start <= code && code <= file.readUInt32BE(at + 4))
          return file.readUInt32BE(at + 8) + code - start;
      }
    }
  }
  return 0;
}

/**
 * How tall the face's own line is at `size` — its ascender to its descender, which is what a browser
 * gives `line-height: normal` and what iOS keeps whole only when a line is at least that tall.
 */
export function naturalLine(file: Buffer, size: number): number {
  const unitsPerEm = file.readUInt16BE(table(file, 'head') + 18);
  const hhea = table(file, 'hhea');
  return ((file.readInt16BE(hhea + 4) - file.readInt16BE(hhea + 6)) * size) / unitsPerEm;
}

/** How wide a line of words is set at `size`, advance by advance — no kerning, as the spec measures. */
export function wordWidth(file: Buffer, words: string, size: number): number {
  const unitsPerEm = file.readUInt16BE(table(file, 'head') + 18);
  const metrics = file.readUInt16BE(table(file, 'hhea') + 34);
  const hmtx = table(file, 'hmtx');
  let units = 0;
  for (const letter of words) {
    const id = glyph(file, letter.codePointAt(0) as number);
    units += file.readUInt16BE(hmtx + 4 * Math.min(id, metrics - 1));
  }
  return (units * size) / unitsPerEm;
}
