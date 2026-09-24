/**
 * A screen read as text, with its wrapping taken out — every run of whitespace becomes one space.
 *
 * The tests that read a source file (`?raw`, the idiom `tests/routes/memory-screens.test.ts`
 * explains) are about what the code says, never about where the formatter chose to break the line.
 * Since the app is formatted by `biome`, that choice is not the author's to keep, and an assertion
 * written as one line would fail the day a name in it grows two characters.
 */
export const flat = (source: string): string => source.replace(/\s+/g, ' ');
