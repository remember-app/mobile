import { expect, test, vi } from 'vitest';

// `@/api` words its own errors now (TASK-86), so it asks `@/language` which language to say them
// in — and that one stands on two native expo modules vitest has nothing to run. The same two
// lines `dates.test.ts` carries, for the same reason.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

import {
  ApiError,
  errorMessage,
  hasShared,
  mayContribute,
  memberHandle,
  memberName,
  startEmailSignIn,
  type Member,
} from '@/api';
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
 * «7 из 9 скинули» is said in two places about one memory — on the card of the main screen, counted
 * by the api's own listing, and on the people face, counted off the roster it holds. Review of m-21
 * caught the two disagreeing: only one of them let «ждать нечего» count. doc-06 settles it — a
 * terminal standing, and the person behind it is nobody anybody is waiting on — so the rule is one
 * named function on this side, and the same rule in the api's query on the other.
 */
test('the wait ends at «done» and at «nothing», never at the two standings before them', () => {
  expect(hasShared('done')).toBe(true);
  expect(hasShared('nothing')).toBe(true);
  // Both of these are material still owed: one has brought nothing yet, the other has said there is
  // more coming. Neither has answered for what is left.
  expect(hasShared('more_coming')).toBe(false);
  expect(hasShared('not_started')).toBe(false);
});

test('one roster, one number: «ждать нечего» is counted, a viewer is in neither half', () => {
  const who = (role: Member['role'], status: Member['contribution_status']): Member => ({
    id: `${role}-${status}`,
    name: null,
    username: null,
    role,
    contribution_status: status,
    media_count: 0,
  });
  // The same four the api's own test counts (TASK-166): two people who are done with in either
  // sense, one still adding, and a viewer who was never going to bring anything.
  const roster = [
    who('organizer', 'done'),
    who('contributor', 'nothing'),
    who('contributor', 'more_coming'),
    who('viewer', 'done'),
  ];

  // The arithmetic the people face draws its line with — a viewer counts on neither side of the
  // «из», so this memory reads «2 из 3» there and must read the same on the main screen's card.
  const bringers = roster.filter((member) => mayContribute(member.role));
  const shared = bringers.filter((member) => hasShared(member.contribution_status)).length;
  expect([shared, bringers.length]).toEqual([2, 3]);
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

// `memberHandle` is the other half of the same pair (found in review, TASK-110/114): the roster row
// and the profile head both print a `@ник` under the name, and both have to agree on when there is
// nothing worth printing there. Pulled into one place so the rule can only be wrong once.
test('the handle under the name is left off when the name above it is already the username', () => {
  // Signed in by email: `memberName` falls back to the username, so printing it again below spends
  // a line saying the same word twice.
  expect(memberHandle({ name: null, username: 'marina' })).toBeUndefined();
  // A name was given: the username is a second, different fact and earns its own line.
  expect(memberHandle({ name: 'Марина', username: 'marina' })).toBe('@marina');
  // Apple hides the address and this app never asks for a username without one, but the helper
  // still has to survive a member with neither.
  expect(memberHandle({ name: 'Марина', username: null })).toBeUndefined();
  expect(memberHandle(null)).toBeUndefined();
});

test('the two failures the api words itself turn with the language; the rest is the wire’s own', () => {
  const wire = new ApiError(400, { error: 'title must not be blank' });

  setLanguage('ru');
  expect(new ApiError(429, null).message).toBe(ru.error.tooMany);
  expect(new ApiError(503, null).message).toBe(ru.error.status(503));
  // The api's own sentence is passed through untouched. It knows the caller's language (TASK-91)
  // and writes its mails in it, but an answer to a request it words itself; translating that here
  // would be this side inventing words for the other's answer.
  expect(wire.message).toBe('title must not be blank');
});

/**
 * The letter with the sign-in link is written before there is any account to ask, so the only thing
 * that can say which language to write it in is this request (doc-8, TASK-85). It is also the one
 * place where the language is not a detail of a screen but the whole of what arrives in an inbox —
 * dropped, and everyone gets Russian.
 */
test('the request for a sign-in link carries the language the app is speaking', async () => {
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    return new Response('{"ok":true}');
  });

  await setLanguage('ru');
  await startEmailSignIn('pilot@example.com');
  await setLanguage('en');
  await startEmailSignIn('pilot@example.com');

  expect(sent).toEqual([
    { email: 'pilot@example.com', language: 'ru' },
    { email: 'pilot@example.com', language: 'en' },
  ]);

  vi.unstubAllGlobals();
});
