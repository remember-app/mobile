import { Play } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { ICO, ICO_S, ICO_XS, Icon, strokeFor } from '@/kit/icon';
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
