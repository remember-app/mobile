import { rule } from '@tests/helpers/css';
import { beforeAll, expect, test } from 'vitest';

import { DayTile } from '@/kit/day-tile';
import { allDifferent, story } from '@/kit/story';
import { setTheme, ThemePin } from '@/theme';

/** Spec 7.3, detail 74 — the day tile of the filter's «День» block, in both of its states. */

beforeAll(async () => {
  await setTheme('dark');
});

const tile = (over: Partial<React.ComponentProps<typeof DayTile>> = {}) => (
  <DayTile
    day="13"
    weekday="сб"
    count="312 кадров"
    fill={1}
    label="13 сентября, сб, 312 кадров"
    selected={false}
    onPress={() => {}}
    {...over}
  />
);

test('a tile carries the figure, the weekday, the bar and the count, and is read out whole', () => {
  const drawn = story(tile());
  for (const line of ['>13<', '>сб<', '>312 кадров<']) expect(drawn).toContain(line);
  // One thing to a screen reader, in words: the figure and the bar say nothing on their own.
  expect(drawn).toContain('aria-label="13 сентября, сб, 312 кадров"');
  // A switch rather than a plain button: it stays in (spec 7.3, `aria-pressed`).
  expect(drawn).toContain('role="togglebutton"');
});

test('the largest system type makes a tile taller, and never lets its words out of it', () => {
  const drawn = story(tile());
  // 86 is a floor: at ×3.571 the figure and the weekday take a line each and the tile grows.
  expect(drawn).toContain(rule('min-height:86px'));
  expect(drawn).toContain(rule('flex-wrap:wrap'));
});

test('the bar is as long as the day is full beside the fullest day, and never past either end', () => {
  expect(story(tile({ fill: 88 / 312 }))).toContain('width:28%');
  expect(story(tile({ fill: 1 }))).toContain('width:100%');
  expect(story(tile({ fill: 0 }))).toContain('width:0%');
  expect(story(tile({ fill: 1.4 }))).toContain('width:100%');
  expect(story(tile({ fill: -1 }))).toContain('width:0%');
});

test('chosen is paper under ink, and not chosen is ink under paper with a faint bar', () => {
  allDifferent({ off: tile(), on: tile({ selected: true }) });
  // Spec 7.3: not chosen — the figure `paper` (#F5F3EE), the lines `muted` (#A4A1B2), the fill
  // `faint` (#6E6B7D). Chosen — the figure and the fill `ink` (#0B0B12), the lines `ink` thinned.
  const off = story(tile());
  expect(off).toContain('color:rgba(245,243,238,1.00)');
  expect(off).toContain('color:rgba(164,161,178,1.00)');
  expect(off).toContain('background-color:rgba(110,107,125,1.00)');
  const on = story(tile({ selected: true }));
  expect(on).toContain('color:rgba(11,11,18,1.00)');
  expect(on).toContain('background-color:rgba(11,11,18,1.00)');
  expect(on).toContain('opacity:0.62');
  expect(on).not.toContain('color:rgba(164,161,178,1.00)');
});

test('both states swap with the theme, and the words stay', () => {
  for (const selected of [false, true]) {
    const night = story(<ThemePin value="dark">{tile({ selected })}</ThemePin>);
    const day = story(<ThemePin value="light">{tile({ selected })}</ThemePin>);
    expect(day).not.toBe(night);
    expect(day).toContain('>312 кадров<');
  }
});
