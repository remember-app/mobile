import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

/** The keychain: the session token this phone holds, and how many times it was told to let go. */
const keychain = vi.hoisted(() => ({ token: null as string | null, deleted: 0 }));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  getItemAsync: async (key: string) => (key === 'session-token' ? keychain.token : null),
  setItemAsync: async () => {},
  deleteItemAsync: async (key: string) => {
    if (key !== 'session-token') return;
    keychain.token = null;
    keychain.deleted += 1;
  },
}));

import { mountsTrees } from '@tests/helpers/renderer';
import TestRenderer, { act } from 'react-test-renderer';
import { ApiError, listMemories, signInWithApple, signInWithGoogle, verifyEmailCode } from '@/api';
import { AuthProvider, useAuth } from '@/lib/auth';

/**
 * The session against an api that stops honouring it. The api's words are the ones its README gives:
 * a route behind `app.authenticate` answers `401 {"error":"unauthorized"}` to a token that is gone —
 * signed out elsewhere, revoked, past its thirty days — and the way in answers 401 to a code or an
 * identity token it will not take, with no session anywhere near the request.
 *
 * What the gate in `_layout.tsx` does with the status is its own table (README, «Как добавить экран
 * за входом»): `signed-out` is the way in and nothing else.
 */

mountsTrees();

const ME = { id: 'me', username: 'anya', name: 'Аня', email: 'anya@test.test', language: 'ru' };
const SESSION = 'session-anya';

/** The api as far as this test needs it. `honoured` is every token it still takes. */
const api = { honoured: new Set<string>(), calls: [] as string[] };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

async function answer(url: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? 'GET';
  const path = new URL(url).pathname;
  api.calls.push(`${method} ${path}`);
  if (path === '/auth/email/verify') return json(401, { error: 'invalid or expired code' });
  if (path === '/auth/apple' || path === '/auth/google')
    return json(401, { error: 'invalid token' });
  const bearer = (init.headers as Record<string, string>).Authorization?.replace(/^Bearer /, '');
  if (!bearer || !api.honoured.has(bearer)) return json(401, { error: 'unauthorized' });
  if (path === '/auth/logout') return json(200, { ok: true });
  if (path === '/memories') return json(200, []);
  return json(200, ME);
}

let auth!: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return null;
}

let tree: TestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  keychain.token = null;
  keychain.deleted = 0;
  api.honoured = new Set();
  api.calls = [];
  vi.stubGlobal('fetch', vi.fn(answer));
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  // Unmounted, or its listener outlives the test and answers for the next one's session.
  act(() => tree?.unmount());
  tree = undefined;
  vi.unstubAllGlobals();
  vi.mocked(console.info).mockRestore();
});

/** Lets every request in the air come back and the state it moved be drawn. */
async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((done) => setImmediate(done));
    });
  }
}

/** The app coming up with `stored` in the keychain. */
async function launch(stored: string | null) {
  keychain.token = stored;
  await act(async () => {
    tree = TestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  await settle();
}

async function signedIn() {
  api.honoured.add(SESSION);
  await launch(SESSION);
  expect(auth.status).toBe('ready');
  api.calls = [];
}

test('a 401 on a request that carried the session ends it once, however many were in the air', async () => {
  await signedIn();
  api.honoured.delete(SESSION);

  let answers: PromiseSettledResult<unknown>[] = [];
  await act(async () => {
    answers = await Promise.allSettled([1, 2, 3].map(() => listMemories(SESSION)));
  });
  await settle();

  // Every caller still gets its own refusal — the session is gone before any of them words it.
  for (const one of answers) {
    expect(one.status).toBe('rejected');
    expect((one as PromiseRejectedResult).reason).toBeInstanceOf(ApiError);
    expect((one as PromiseRejectedResult).reason).toMatchObject({ status: 401 });
  }
  expect(auth).toMatchObject({ status: 'signed-out', token: null, user: null });
  expect(keychain).toEqual({ token: null, deleted: 1 });
  expect(console.info).toHaveBeenCalledTimes(1);
  // And nothing more is asked: not even /auth/logout, which the api would only refuse again.
  expect(api.calls).toEqual(['GET /memories', 'GET /memories', 'GET /memories']);
});

test.each([
  ['with nobody signed in', null],
  ['beside a session that is alive', SESSION],
])('a 401 on the way in is the screen’s answer, and asked once — %s', async (_, stored) => {
  if (stored) await signedIn();
  else await launch(null);
  const status = auth.status;

  for (const wayIn of [
    () => verifyEmailCode('anya@test.test', '000000'),
    () => signInWithApple('forged'),
    () => signInWithGoogle('forged'),
  ]) {
    await act(async () => {
      await expect(wayIn()).rejects.toMatchObject({ status: 401 });
    });
  }
  await settle();

  expect(api.calls).toEqual(['POST /auth/email/verify', 'POST /auth/apple', 'POST /auth/google']);
  expect(auth.status).toBe(status);
  expect(keychain.deleted).toBe(0);
  expect(console.info).not.toHaveBeenCalled();
});

test('a late 401 for a token this phone no longer holds leaves the session it does hold', async () => {
  await signedIn();

  await act(async () => {
    await expect(listMemories('session-before')).rejects.toMatchObject({ status: 401 });
  });
  await settle();

  expect(auth.status).toBe('ready');
  expect(keychain).toEqual({ token: SESSION, deleted: 0 });
});

test('a token refused at launch is forgotten the same way, and the app comes up signed out', async () => {
  await launch('session-gone');

  expect(auth.status).toBe('signed-out');
  expect(keychain).toEqual({ token: null, deleted: 1 });
  expect(api.calls).toEqual(['GET /me']);
});

// Only a refusal kills the stored token: a phone that launches with no signal must not be signed out
// for good, and the next launch with the api up restores the session.
test.each([
  ['unreachable', () => Promise.reject(new TypeError('Network request failed'))],
  ['falling over', () => Promise.resolve(json(500, { error: 'internal server error' }))],
])('a launch with the api %s keeps the stored session for the next one', async (_, failing) => {
  vi.stubGlobal('fetch', vi.fn(failing));
  await launch(SESSION);

  expect(auth.status).toBe('signed-out');
  expect(keychain).toEqual({ token: SESSION, deleted: 0 });
});

test('signing out by hand still tells the api, and leaves the phone where a refusal does', async () => {
  await signedIn();

  await act(() => auth.signOut());
  await settle();

  expect(api.calls).toEqual(['POST /auth/logout']);
  expect(auth).toMatchObject({ status: 'signed-out', token: null, user: null });
  expect(keychain).toEqual({ token: null, deleted: 1 });
});
