/**
 * A screen read as text, with its wrapping taken out — every run of whitespace becomes one space.
 *
 * The tests that read a source file (`?raw`, the idiom `tests/routes/memory/screen.test.ts`
 * explains) are about what the code says, never about where the formatter chose to break the line.
 * Since the app is formatted by `biome`, that choice is not the author's to keep, and an assertion
 * written as one line would fail the day a name in it grows two characters.
 */
export const flat = (source: string): string => source.replace(/\s+/g, ' ');

/**
 * The whole api folder read as one text. The tests that pin a route or a field read it this way and
 * not file by file: which area of `@/api` a call lives in is the folder's own business, and an
 * assertion naming the file would break the day a route moved between two of them.
 */
export const api = Object.values(
  import.meta.glob<string>('@/api/*.ts', { query: '?raw', import: 'default', eager: true }),
).join('\n');
