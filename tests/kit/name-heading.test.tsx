import { beforeAll, expect, test } from 'vitest';

import { NAME_SIZES, nameSize } from '@/kit/name-heading';
import { setTheme } from '@/theme';

/** Spec 7.2, detail 79 — the film's name heading the order's total. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the name takes the largest size it fits the column at, and the smallest past that', () => {
  expect(NAME_SIZES).toEqual([33, 30, 27, 24, 21]);
  // Spec's own measures (Unbounded 700, −0.04em): «Ролик на 2:30» is 281 at 33 — 33 on 390 and 320.
  expect(nameSize(281, 358)).toBe(33);
  expect(nameSize(281, 288)).toBe(33);
  // «Ролик для родителей» is 358.5 at 27, so 438.2 at 33: 24 on 390 (358), 21 on 320 (288).
  const parents = (358.5 * 33) / 27;
  expect(nameSize(parents, 358)).toBe(24);
  expect(nameSize(parents, 288)).toBe(21);
  // Past 21 it stays 21, and the line is cut there.
  expect(nameSize(2000, 288)).toBe(21);
  // Not measured yet: the first size, rather than a jump down and back.
  expect(nameSize(0, 358)).toBe(33);
  expect(nameSize(281, 0)).toBe(33);
});
