import { beforeAll, expect, test } from 'vitest';

import { Chip } from '@/kit/chip';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.3 — the chip, in its four kinds. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the four chips are four chips', () => {
  allDifferent({
    plain: <Chip label="Все дни" onPress={() => {}} />,
    withFace: <Chip label="Марк Ковалёв" avatar="Марк Ковалёв" onPress={() => {}} />,
    selected: <Chip label="Все" selected onPress={() => {}} />,
    off: <Chip label="12 сентября" disabled onPress={() => {}} />,
  });
});

test('a chosen chip fills with paper and is read in ink, the way a segment is', () => {
  // Read in #0B0B12 — the same pair the chosen segment wears, because it is the same idea.
  const chosen = story(<Chip label="Все" selected onPress={() => {}} />);
  expect(chosen).toContain('rgba(11,11,18,1.00)');
  expect(story(<Chip label="Все" onPress={() => {}} />)).not.toContain('rgba(11,11,18,1.00)');
});

test('a chip nobody can press is a label, and says nothing about being one', () => {
  const still = story(<Chip label="Начни с…" />);
  expect(still).not.toContain('role="button"');
  expect(story(<Chip label="Начни с…" onPress={() => {}} />)).toContain('role="button"');
});

test('an unavailable chip goes faint and stops answering', () => {
  const off = story(<Chip label="12 сентября" disabled onPress={() => {}} />);
  // #6E6B7D — spec 10.1 leaves `faint` exactly this job.
  expect(off).toContain('rgba(110,107,125,1.00)');
  expect(off).toContain('aria-disabled="true"');
});

test('a chip with a face in it carries the face and the name, and only the name is read out', () => {
  const who = story(<Chip label="Аня Петрова" avatar="Аня Петрова" onPress={() => {}} />);
  expect(who).toContain('АП');
  expect(who).toContain('aria-label="Аня Петрова"');
});
