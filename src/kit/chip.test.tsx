import { CalendarDays, Lock } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { Chip } from '@/kit/chip';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.3 — the chip: three heights, and everything that can stand inside one. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the chips are as many as the things that can stand in one', () => {
  allDifferent({
    plain: <Chip label="Все дни" onPress={() => {}} />,
    withFace: <Chip label="Марк Ковалёв" avatar="Марк Ковалёв" onPress={() => {}} />,
    withSwatch: <Chip label="Лучшее" swatch="#FFB547" onPress={() => {}} />,
    withCount: <Chip label="13 сент" count="312" onPress={() => {}} />,
    withGlyph: <Chip label="Другая дата" icon={CalendarDays} onPress={() => {}} />,
    selected: <Chip label="Все" selected onPress={() => {}} />,
    off: <Chip label="12 сентября" disabled onPress={() => {}} />,
  });
});

test('the three heights are three heights, and the quick one stands on a fill of its own', () => {
  allDifferent({
    filter: <Chip label="Все" onPress={() => {}} />,
    quick: <Chip label="Сегодня" size={36} onPress={() => {}} />,
    journal: <Chip label="Мысли" size={34} onPress={() => {}} />,
  });
  // Spec 7.3: the quick days carry a fill under them — they stand on a screen, not over a list —
  // and the filter chip carries none. A shape, so it is told apart by the class and not by a colour.
  expect(story(<Chip label="Сегодня" size={36} onPress={() => {}} />)).toContain(
    'r-backgroundColor-',
  );
  expect(story(<Chip label="Все" onPress={() => {}} />)).not.toContain('r-backgroundColor-');
  // And all three are felt at 44 however they are drawn (spec 10.2).
  expect(story(<Chip label="Мысли" size={34} onPress={() => {}} />)).toContain('min-height:34px');
});

test('a count is the same words a shade quieter, and it is read out with the name', () => {
  const counted = story(<Chip label="13 сент" count="312" onPress={() => {}} />);
  expect(counted).toContain('312');
  // One thing to a screen reader: «13 сент 312», not a name and then a stray number.
  expect(counted).toContain('aria-label="13 сент 312"');
});

test('a label’s chip carries its colour, and the colour says nothing out loud', () => {
  // Spec 10.8.2 — the labels section of the filter sheet.
  const label = story(<Chip label="Лучшее" swatch="#FFB547" count="23" onPress={() => {}} />);
  expect(label).toContain('rgba(255,181,71,1.00)');
  expect(label).toContain('aria-label="Лучшее 23"');
  // A private one carries the lock in front of the name and is still one chip.
  expect(story(<Chip label="Для себя" swatch="#FFB547" icon={Lock} onPress={() => {}} />)).toContain(
    'data-glyph',
  );
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
