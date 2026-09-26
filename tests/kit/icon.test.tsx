import { Play } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { DRAWN, drawnAs, ICO, ICO_S, ICO_XS, Icon, playFor, strokeFor } from '@/kit/icon';
import { story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 5 — one set, one grid, and a stroke that thickens as the glyph shrinks. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the smaller the glyph, the heavier its stroke', () => {
  // The whole reason this component exists: set the weight per call site and the one set stops
  // looking like one set. The range is the spec's own 1.5–2.1.
  expect(strokeFor(24)).toBe(1.5);
  expect(strokeFor(ICO)).toBe(1.75);
  expect(strokeFor(ICO_S)).toBe(2);
  expect(strokeFor(ICO_XS)).toBe(2.1);
  for (const size of [10, 13, 16, 18, 20, 22, 24, 38]) {
    expect(strokeFor(size)).toBeGreaterThanOrEqual(1.5);
    expect(strokeFor(size)).toBeLessThanOrEqual(2.1);
  }
});

test('a glyph is drawn at the size and weight it was asked for', () => {
  const drawn = story(<Icon icon={Play} size={22} />);
  expect(drawn).toContain('width="22"');
  expect(drawn).toContain('stroke-width="1.75"');
});

test('with no colour of its own a glyph is read in paper', () => {
  expect(story(<Icon icon={Play} />)).toContain('stroke="#F5F3EE"');
  expect(story(<Icon icon={Play} color="#E4FF4F" />)).toContain('stroke="#E4FF4F"');
});

test('nothing is filled unless it is asked for — spec 5 fills two glyphs and no others', () => {
  expect(story(<Icon icon={Play} />)).toContain('fill="none"');
  expect(story(<Icon icon={Play} fill="#FFFFFF" />)).toContain('fill="#FFFFFF"');
});

test('play is drawn at the size that lands it on the layout’s own triangle in the layout’s box', () => {
  // TASK-384 (R7). The layout's play is its own path, `M8 5.2v13.6L19 12z` — 13.6 of the 24 grid
  // tall — in a 16 box on «Послушать» (`MontageMusic.json`) and on the film's line of
  // `SheetFrameInfo.json`, a 9 box on the feed's running time (`MemoryFrames.json`). Lucide's runs 18
  // of its grid and a 2.1 stroke round it: drawn at the layout's box it read ×1.8 on the music step.
  const lucide = (size: number) => ((18 + strokeFor(size)) / 24) * size;
  const layout = (box: number) => (13.6 / 24) * box;
  for (const box of [9, 16]) expect(Math.abs(lucide(playFor(box)) - layout(box))).toBeLessThan(0.5);
  expect(playFor(16)).toBe(11);
  // The feed's running time (TASK-385) came to the same answer by hand.
  expect(playFor(9)).toBe(6);
});

/**
 * The ink a glyph leaves, across or down: the extent its path reaches in the 24 grid and the stroke
 * round it, scaled to the size it is drawn at.
 */
const ink = (reach: number, size: number, stroke: number) => ((reach + stroke) * size) / 24;

test('a glyph the layout draws tighter lands its ink where the layout’s does, in the box it was asked for', () => {
  // TASK-398 (R'6). Extents in the 24 grid off the paths themselves, across × down: the layout's own
  // drawings as `MontageTemplate.json` e12, e20, e28, e44 draw them (the signs at 16 / 1.9 in their
  // 30 of glass), `MontageSummary.json` e13 and `MontageStory.json` e13 (the house at 14 / 1.9 on the
  // plates), `MontageMusic.json` e20 (the pen of a wish, 15 / 1.9) and `MontageTemplate.json` e58 (the
  // pen of «Настроить самому», 17 / 1.8); Lucide 1.41's own for the rest. At the layout's box Lucide's
  // heart read 14.7 across the tile against 10.7, its pencil 16 × 16 against 12.3 × 11.7.
  //
  // Within a point, as the layout is compared (round 2). The house alone gets a quarter more: its
  // outline is its own — eaves over walls narrower than Lucide's — and no one scale lands it closer
  // than 0.75 across and 1.2 down on the tile (1.0 each way on the phone).
  const places = [
    { glyph: DRAWN.heart, layout: [14, 14], lucide: [20, 17], box: 16, stroke: 1.9, within: 1 },
    { glyph: DRAWN.zap, layout: [13, 18], lucide: [16, 20], box: 16, stroke: 1.9, within: 1 },
    { glyph: DRAWN.fileText, layout: [14, 18], lucide: [16, 20], box: 16, stroke: 1.9, within: 1 },
    { glyph: DRAWN.house, layout: [18, 16], lucide: [18, 19], box: 16, stroke: 1.9, within: 1.25 },
    { glyph: DRAWN.house, layout: [18, 16], lucide: [18, 19], box: 14, stroke: 1.9, within: 1 },
    { glyph: DRAWN.pen, layout: [18, 17], lucide: [20, 20], box: 15, stroke: 1.9, within: 1 },
    { glyph: DRAWN.pen, layout: [18, 17], lucide: [20, 20], box: 17, stroke: 1.8, within: 1 },
  ];
  for (const { glyph, layout, lucide, box, stroke, within } of places) {
    const drawn = story(<Icon icon={glyph} size={box} stroke={stroke} />);
    // The box stays the layout's: whatever stands beside the glyph stays where it is.
    expect(drawn).toContain(`width:${box}px`);
    const size = Number(drawn.match(/<svg[^>]* width="([\d.]+)"/)?.[1]);
    const weight = Number(drawn.match(/stroke-width="([\d.]+)"/)?.[1]);
    // A whole size, and a smaller one than the box.
    expect(Number.isInteger(size)).toBe(true);
    expect(size).toBeLessThan(box);
    // The stroke keeps the weight the place names, however much smaller the drawing comes out.
    expect((weight * size) / 24).toBeCloseTo((stroke * box) / 24, 6);
    const off = (draw: number, line: number) =>
      Math.max(
        ...[0, 1].map((side) =>
          Math.abs(ink(lucide[side], draw, line) - ink(layout[side], box, stroke)),
        ),
      );
    expect(off(size, weight)).toBeLessThan(within);
    // Lucide's own at the box lands further off: this is what the drawing is for.
    expect(off(box, stroke)).toBeGreaterThan(off(size, weight));
    expect(off(box, stroke)).toBeGreaterThan(1);
  }
});

test('a drawn glyph is still the glyph it stands for, in the box it was asked for', () => {
  expect(story(<Icon icon={DRAWN.pen} size={15} />)).toContain('data-glyph="Pencil"');
  const half = story(<Icon icon={drawnAs(Play, 0.5)} size={16} />);
  expect(half).toContain('width="8"');
  expect(half).toContain('width:16px');
});
