import { afterEach, expect, test, vi } from 'vitest';

// `@/lib/failure` asks `@/api` for the words, and `@/api` asks `@/lib/language` which language to
// say them in — on a native expo module vitest has nothing to run. The same line `dates.test.ts`
// carries, for the same reason.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { Lock, TriangleAlert, Unlink, WifiOff } from 'lucide-react-native';
import { ApiError } from '@/api';
import { read } from '@/kit';
import { failure, notMember, saying } from '@/lib/failure';
import { setLanguage } from '@/lib/language';
import { en, ru } from '@/strings';

/**
 * The one place a refusal turns into a glyph (TASK-275). The banner's own «no signal» is earned by
 * a request that never got an answer and by nothing else: an api that answered is talking about
 * something else — rights, a thing that is not there, a conflict — and a crossed-out wifi over that
 * is a sign that says the opposite of what happened.
 *
 * The words are `errorMessage`'s, and they are not what is tested here: that they are the api's own
 * is TASK-273's business. What is tested is that the glyph follows the status, never the language.
 */

afterEach(async () => {
  await setLanguage('ru');
});

/** What a banner would draw: the glyph it was handed, or the one it falls back to on its own. */
const drawn = (e: unknown, refused?: Parameters<typeof failure>[1]) =>
  failure(e, refused).icon ?? WifiOff;

test('only a request that never got an answer wears «no signal»', () => {
  expect(drawn(new TypeError('Network request failed'))).toBe(WifiOff);
  expect(read(failure(new TypeError('Network request failed')).text)).toBe(ru.error.offline);
});

test('a 403 is about rights and wears the lock', () => {
  expect(drawn(new ApiError(403, null))).toBe(Lock);
});

test.each([400, 409, 429, 500, 501, 503])(
  'a %i the api refused wears the plain warning',
  (status) => {
    expect(drawn(new ApiError(status, { error: 'refused' }))).toBe(TriangleAlert);
  },
);

test('a 404 names what that route has lost, so it is the route that says it', () => {
  expect(drawn(new ApiError(404, null))).toBe(TriangleAlert);
  // The memory route has its own answer — the person, not the request — and keeps its own sign.
  expect(drawn(new ApiError(404, null), notMember(ru))).toBe(Unlink);
});

/**
 * A route that words a status keeps the glyph that status stands for: naming the words is not a
 * licence to hand the banner its default again, which is the mistake that put «no signal» on every
 * refusal in the first place.
 */
test('a route that words a status does not take the sign with it', () => {
  const said = failure(new ApiError(403, { error: 'forbidden' }), {
    403: { text: saying('only you') },
  });
  expect([read(said.text), said.icon]).toEqual(['only you', Lock]);
  // And one that names a sign too keeps that sign — the tie that is cut is not about the status.
  const named = failure(new ApiError(404, null), { 404: { text: saying('gone'), icon: Unlink } });
  expect([read(named.text), named.icon]).toEqual(['gone', Unlink]);
});

test('a route that words one status says it for that status only', () => {
  const refused = { 403: { text: saying('only you') } };
  expect(read(failure(new ApiError(403, { error: 'forbidden' }), refused).text)).toBe('only you');
  // Another refusal keeps the api's own words: the route spoke for itself, not for the api.
  expect(read(failure(new ApiError(500, { error: 'boom' }), refused).text)).toBe('boom');
});

test('the glyph follows the status and not the words: in another language the same refusals keep theirs', async () => {
  await setLanguage('en');
  expect(drawn(new TypeError('Network request failed'))).toBe(WifiOff);
  expect(read(failure(new TypeError('Network request failed')).text)).toBe(en.error.offline);
  expect(drawn(new ApiError(403, null))).toBe(Lock);
  expect(drawn(new ApiError(409, { error: 'taken' }))).toBe(TriangleAlert);
  expect(read(failure(new ApiError(409, { error: 'taken' })).text)).toBe('taken');
  expect(drawn(new ApiError(404, null), notMember(en))).toBe(Unlink);
  expect(read(failure(new ApiError(404, null), notMember(en)).text)).toBe(en.memory.gone);
});

/**
 * The api's own wording stays where it was — a 429 the api names reads its own line, and one it
 * does not falls back to the status. This task moves the sign, not the words.
 */
test('the words are still the api’s own, and a 429 the api has no line for is the app’s', () => {
  expect(read(failure(new ApiError(409, { error: 'no such media' })).text)).toBe('no such media');
  expect(read(failure(new ApiError(409, null)).text)).toBe(ru.error.status(409));
  expect(read(failure(new ApiError(429, null)).text)).toBe(ru.error.tooMany);
  expect(drawn(new ApiError(429, null))).toBe(TriangleAlert);
});
