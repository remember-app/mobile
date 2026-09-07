import { expect, test, vi } from 'vitest';

// `@/api` words its own errors now (TASK-86), so it asks `@/language` which language to say them
// in — and that one stands on two native expo modules vitest has nothing to run. The same two
// lines `dates.test.ts` carries, for the same reason.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

import { ApiError, errorMessage, mayContribute, memberName } from '@/api';
import { setLanguage } from '@/language';
import { en, ru } from '@/strings';

// Was three copies of the same check (memory screen ×2, gallery screen ×1) until review m-3 found
// them — the risk was exactly one drifting from the other two. One pinned truth table replaces it.
test('organizer and contributor may bring material and people in, viewer and nobody may not', () => {
  expect(mayContribute('organizer')).toBe(true);
  expect(mayContribute('contributor')).toBe(true);
  expect(mayContribute('viewer')).toBe(false);
  expect(mayContribute(null)).toBe(false);
});

/**
 * The screens read their words through `useStrings()` and redraw when the language turns. This file
 * has no component around it and neither does `@/api`, so its two readable lines are read through a
 * call instead — and this is what pins that the call actually happens at the moment of asking. Read
 * once at import, both would answer in whatever language the app started in for the rest of the run,
 * which is the mixed screen doc-8 exists to forbid.
 */
test('the api says its own two lines in the language the app is speaking right now', async () => {
  await setLanguage('ru');
  expect(errorMessage(new TypeError('fetch failed'))).toBe(ru.error.offline);
  expect(memberName(null)).toBe(ru.memory.someone);

  await setLanguage('en');
  expect(errorMessage(new TypeError('fetch failed'))).toBe(en.error.offline);
  expect(memberName(null)).toBe(en.memory.someone);
});

test('a person who gave a name or a nick is called by it, never by a translated word', () => {
  expect(memberName({ name: 'Марина', username: 'marina' })).toBe('Марина');
  expect(memberName({ name: null, username: 'marina' })).toBe('marina');
});

test('the two failures the api words itself turn with the language; the rest is the wire’s own', () => {
  const wire = new ApiError(400, { error: 'title must not be blank' });

  setLanguage('ru');
  expect(new ApiError(429, null).message).toBe(ru.error.tooMany);
  expect(new ApiError(503, null).message).toBe(ru.error.status(503));
  // The api's own sentence is passed through untouched — TASK-91 is what tells it which language
  // to write in. Translating it here would be this side inventing words for the other's answer.
  expect(wire.message).toBe('title must not be blank');
});
