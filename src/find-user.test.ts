import { expect, test, vi } from 'vitest';

// `@/find-user` pulls in `@/api`, which reads the phone's language at module load through these two
// native modules — neither exists under vitest, and without a stand-in the import throws before a
// single test runs (the same reason `language.test.ts` mocks them). `vi.mock` is hoisted above the
// imports below, so the real modules never load.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

import type { Contact } from '@/api';
import { matches } from '@/find-user';

/**
 * `matches` is the one piece of `@/find-user` with no hook and no timer in it — the sieve both the
 * contacts screen and the invite sheet run their needle through. Everything else in the module is
 * `useFindUser`, whose whole reason to exist is a debounce and a stale-response race that only a
 * real render loop can exercise; this project has none (see `memory-screens.test.ts`). So this file
 * holds the one thing here that can be run rather than read.
 */

const person: Contact = { id: '1', name: 'Роман Ким', username: 'roma' };

test('an empty needle matches everybody — the untouched field shows the whole list', () => {
  expect(matches(person, '')).toBe(true);
});

test('the person’s own case never keeps a lowercase needle from finding them', () => {
  // Both callers lowercase what was typed before this ever sees it (`const needle =
  // query.toLowerCase()`) — it is `person`'s side, not the needle's, that this lowercases.
  expect(matches(person, 'rom')).toBe(true); // username
  expect(matches(person, 'ким')).toBe(true); // name, Cyrillic
  expect(matches(person, 'xyz')).toBe(false);
});

test('a person with neither field set is only ever found by an empty needle', () => {
  const bare: Contact = { id: '2', name: null, username: null };
  expect(matches(bare, '')).toBe(true);
  expect(matches(bare, 'a')).toBe(false);
});
