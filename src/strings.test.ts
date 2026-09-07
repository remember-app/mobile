import { expect, test } from 'vitest';

import { en, ru } from '@/strings';

// The typecheck already refuses a key with only one set. What it cannot see is a Russian value left
// as its English placeholder, and how Russian counts.

test('every key says something different in each language', () => {
  const flat = (set: object, prefix = ''): [string, unknown][] =>
    Object.entries(set).flatMap(([key, value]) =>
      typeof value === 'object' && value !== null
        ? flat(value, `${prefix}${key}.`)
        : [[`${prefix}${key}`, value]],
    );
  const english = new Map(flat(en));
  const same = flat(ru).filter(([key, value]) => english.get(key) === value);
  // The two language names are the one pair meant to match: each names itself in its own language.
  expect(same.map(([key]) => key)).toEqual(['language.ru', 'language.en']);
});

test('Russian counts in three forms, English in two', () => {
  expect([1, 2, 5, 11, 21, 104].map(ru.memory.frames)).toEqual([
    '1 кадр',
    '2 кадра',
    '5 кадров',
    '11 кадров',
    '21 кадр',
    '104 кадра',
  ]);
  expect([1, 2, 5].map(ru.memory.people)).toEqual(['1 человек', '2 человека', '5 человек']);
  expect([1, 2].map(en.memory.frames)).toEqual(['1 frame', '2 frames']);
  expect([1, 2].map(en.memory.people)).toEqual(['1 person', '2 people']);
});
