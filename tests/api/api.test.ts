import { expect, test, vi } from 'vitest';

// `@/api` words its own errors now (TASK-86), so it asks `@/lib/language` which language to say them
// in — and that one stands on two native expo modules vitest has nothing to run. The same two
// lines `dates.test.ts` carries, for the same reason.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

import {
  ApiError,
  addLabelMedia,
  createLabel,
  deleteLabel,
  errorMessage,
  hasShared,
  listLabels,
  listMontageTemplates,
  type Member,
  mayContribute,
  memberHandle,
  memberName,
  orderMontage,
  previewMontage,
  removeLabelMedia,
  startEmailSignIn,
} from '@/api';
import { setLanguage } from '@/lib/language';
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

/**
 * The three calls an order is made of (doc-03, TASK-216): the six templates it can start from, the
 * summary it is read back as, and the order itself. All three are the organizer's, and the first
 * two exist so that nothing about a film is worked out on this side — the length it may run to and
 * the frames that will be in it are the api's answer and never this app's arithmetic.
 */
test('templates are read, the summary is asked for with the very body the order sends', async () => {
  const asked: { url: string; method?: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: { method?: string; body?: string }) => {
    asked.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    return new Response('[]');
  });

  await listMontageTemplates('session', 'memory-1');
  // A body is a body: the same wishes go to the summary and to the order, and the only difference
  // between the two calls is that one of them writes something down.
  const wishes = { target_seconds: 90, music_tracks: ['calm'], exclude_media_ids: ['3ab0'] };
  await previewMontage('session', 'memory-1', wishes);
  await orderMontage('session', 'memory-1', wishes);

  expect(asked.map((one) => one.url.replace(/^.*\/memories/, '/memories'))).toEqual([
    '/memories/memory-1/montage-templates',
    '/memories/memory-1/montages/preview',
    '/memories/memory-1/montages',
  ]);
  // The templates are read and the other two are asked, which is what keeps a summary from
  // counting as an order against the montage counter.
  expect(asked.map((one) => one.method)).toEqual(['GET', 'POST', 'POST']);
  expect(asked[1]?.body).toEqual(wishes);
  expect(asked[2]?.body).toEqual(asked[1]?.body);

  vi.unstubAllGlobals();
});

/**
 * The labels client (doc-13): every marked frame goes in — or comes out — as one request, and a
 * refusal or a dead network reaches the sheet as what it is, so it can be said in words.
 */
test('a whole selection is filed, unfiled and made into a label with one request each', async () => {
  const asked: { url: string; method?: string; body: unknown; auth?: string }[] = [];
  vi.stubGlobal(
    'fetch',
    async (
      url: string,
      init: { method?: string; body?: string; headers: Record<string, string> },
    ) => {
      asked.push({
        url: url.replace(/^.*\/memories/, '/memories'),
        method: init.method,
        body: init.body ? JSON.parse(init.body) : null,
        auth: init.headers.Authorization,
      });
      return new Response('[]');
    },
  );

  const frames = ['a', 'b', 'c'];
  await listLabels('session', 'm1');
  await addLabelMedia('session', 'm1', 'best', frames);
  await removeLabelMedia('session', 'm1', 'best', frames);
  await createLabel('session', 'm1', {
    title: 'Лучшее',
    color: 2,
    shared: false,
    media_ids: frames,
  });
  await deleteLabel('session', 'm1', 'best');

  expect(asked.map(({ method, url, body }) => [method, url, body])).toEqual([
    ['GET', '/memories/m1/labels', null],
    ['POST', '/memories/m1/labels/best/media', { media_ids: frames }],
    ['DELETE', '/memories/m1/labels/best/media', { media_ids: frames }],
    [
      'POST',
      '/memories/m1/labels',
      { title: 'Лучшее', color: 2, shared: false, media_ids: frames },
    ],
    ['DELETE', '/memories/m1/labels/best', null],
  ]);
  // Every one of them is signed as the person asking — the server alone decides who may see what.
  expect(asked.every((one) => one.auth === 'Bearer session')).toBe(true);

  vi.unstubAllGlobals();
});

test('a label gone or forbidden reaches the caller with its status, and a dead network as «offline»', async () => {
  vi.stubGlobal('fetch', async () => new Response('{"error":"not found"}', { status: 404 }));
  const gone = await addLabelMedia('session', 'm1', 'best', ['a']).catch((e: unknown) => e);
  expect(gone).toBeInstanceOf(ApiError);
  expect((gone as ApiError).status).toBe(404);

  vi.stubGlobal('fetch', async () => new Response('{"error":"forbidden"}', { status: 403 }));
  const denied = await createLabel('session', 'm1', { title: 'Х', color: 1, shared: true }).catch(
    (e: unknown) => e,
  );
  expect((denied as ApiError).status).toBe(403);

  vi.stubGlobal('fetch', async () => {
    throw new TypeError('Network request failed');
  });
  await setLanguage('ru');
  const offline = await listLabels('session', 'm1').catch((e: unknown) => e);
  expect(errorMessage(offline)).toBe(ru.error.offline);

  vi.unstubAllGlobals();
});
