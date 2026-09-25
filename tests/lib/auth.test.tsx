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

import { later } from '@tests/helpers/api';
import { account, datesRefusal } from '@tests/helpers/contract';
import { mountsTrees } from '@tests/helpers/renderer';
import TestRenderer, { act } from 'react-test-renderer';
import {
  ApiError,
  errorMessage,
  listMemories,
  signInWithApple,
  signInWithGoogle,
  verifyEmailCode,
} from '@/api';
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

const ME = account({ username: 'anya', name: 'Аня', email: 'anya@test.test' });
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

// «Даты между днями» (TASK-292): the account's one setting for every feed. It comes with every
// answer that carries the person and is changed by `POST /me/dates-between-days` (api docs/auth.md).

/**
 * The api holding the setting at `on`: `/me` carries it, and a change is answered by `change` when
 * the test gives one — late, refused, unreachable — or else taken and answered with the account.
 */
function holding(on: boolean, change?: (asked: boolean) => Promise<Response>) {
  let held = on;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname;
      if (path === '/me') {
        api.calls.push('GET /me');
        return json(200, { ...ME, dates_between_days: held });
      }
      if (path !== '/me/dates-between-days') return answer(url, init);
      api.calls.push(`${init.method} ${path} ${init.body}`);
      const bad = datesRefusal(JSON.parse(String(init.body)));
      if (bad) return bad;
      const asked = JSON.parse(String(init.body)).dates_between_days;
      if (change) return change(asked);
      held = asked;
      return json(200, { ...ME, dates_between_days: held });
    }),
  );
}

test('the setting is read off the profile, and is off until the profile has come', async () => {
  const answered = later<void>();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      await answered.promise;
      return json(200, { ...ME, dates_between_days: true });
    }),
  );
  keychain.token = SESSION;
  await act(async () => {
    tree = TestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  // Nothing to read it off yet, so every feed draws as it does with the setting off.
  expect(auth.status).toBe('loading');
  expect(auth.datesBetweenDays).toBe(false);

  await act(async () => answered.settle());
  await settle();
  expect(auth.status).toBe('ready');
  expect(auth.datesBetweenDays).toBe(true);
});

test('an account sent without it — by an api from before the setting — reads as off', async () => {
  // The api today never leaves it out (`NOT NULL`, in every answer); the app ships over the air and
  // may meet one that has not been deployed yet.
  const { dates_between_days: _, ...before } = ME;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const res = await answer(url, init);
      return new URL(url).pathname === '/me' && res.ok ? json(200, before) : res;
    }),
  );
  await signedIn();
  expect(auth.user).not.toHaveProperty('dates_between_days');
  expect(auth.datesBetweenDays).toBe(false);
});

test('a change turns the app at once, goes the way the api asks, and settles on its answer', async () => {
  const answered = later<void>();
  holding(false, async () => {
    await answered.promise;
    return json(200, { ...ME, dates_between_days: true });
  });
  await signedIn();
  expect(auth.datesBetweenDays).toBe(false);

  let done!: Promise<void>;
  await act(async () => {
    done = auth.setDatesBetweenDays(true);
  });
  // On before the api has said a word: the feeds turn with the switch, not a round trip later.
  expect(auth.datesBetweenDays).toBe(true);
  expect(api.calls).toEqual(['POST /me/dates-between-days {"dates_between_days":true}']);
  const [, init] = vi.mocked(fetch).mock.calls.at(-1)!;
  expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${SESSION}`);

  await act(async () => {
    answered.settle();
    await done;
  });
  expect(auth.datesBetweenDays).toBe(true);
  expect(auth.user).toMatchObject({ dates_between_days: true });
});

test.each([
  ['refuses it', () => Promise.resolve(json(500, { error: 'internal server error' }))],
  ['cannot be reached', () => Promise.reject(new TypeError('Network request failed'))],
])('a change the api %s is undone, and the caller gets the reason', async (_, fail) => {
  const answered = later<void>();
  holding(false, async () => {
    await answered.promise;
    return fail();
  });
  await signedIn();

  let done!: Promise<void>;
  await act(async () => {
    done = auth.setDatesBetweenDays(true);
  });
  expect(auth.datesBetweenDays).toBe(true);

  let reason: unknown;
  await act(async () => {
    answered.settle();
    reason = await done.then(
      () => null,
      (e: unknown) => e,
    );
  });
  expect(reason).toBeInstanceOf(Error);
  expect(errorMessage(reason)).not.toBe('');
  expect(auth.datesBetweenDays).toBe(false);
  expect(auth.status).toBe('ready');
});

test('two changes in a row: a late answer to the first leaves the second standing, and a refused second leaves what the api holds', async () => {
  const gates = [later<void>(), later<void>()];
  let n = 0;
  holding(false, async (asked) => {
    await gates[n++].promise;
    return asked
      ? json(200, { ...ME, dates_between_days: true })
      : json(500, { error: 'internal server error' });
  });
  await signedIn();

  let first!: Promise<void>;
  let second!: Promise<void>;
  await act(async () => {
    first = auth.setDatesBetweenDays(true);
    second = auth.setDatesBetweenDays(false);
  });
  expect(auth.datesBetweenDays).toBe(false);

  // The api takes the first and answers while the second is still being asked.
  await act(async () => {
    gates[0].settle();
    await first;
  });
  expect(auth.datesBetweenDays).toBe(false);

  // The second is refused: what stands is what the api holds, and the first put «on» there.
  await act(async () => {
    gates[1].settle();
    await second.catch(() => {});
  });
  expect(auth.datesBetweenDays).toBe(true);
});

test('signed out while a change is in the air, its answer signs nobody back in', async () => {
  const answered = later<void>();
  holding(false, async () => {
    await answered.promise;
    return json(200, { ...ME, dates_between_days: true });
  });
  await signedIn();

  let done!: Promise<void>;
  await act(async () => {
    done = auth.setDatesBetweenDays(true);
  });
  await act(() => auth.signOut());
  await act(async () => {
    answered.settle();
    await done;
  });
  expect(auth).toMatchObject({ status: 'signed-out', user: null, datesBetweenDays: false });
});

test('signed in as somebody else before it answers, the answer stays on the account that asked', async () => {
  const answered = later<void>();
  holding(false, async () => {
    await answered.promise;
    return json(200, { ...ME, dates_between_days: true });
  });
  await signedIn();

  let done!: Promise<void>;
  await act(async () => {
    done = auth.setDatesBetweenDays(true);
  });
  await act(() => auth.signOut());
  const OTHER = { ...ME, id: 'mark', username: 'mark', dates_between_days: false };
  api.honoured.add('session-mark');
  vi.mocked(fetch).mockImplementationOnce(async () => json(200, OTHER));
  await act(() => auth.signIn('session-mark'));
  await act(async () => {
    answered.settle();
    await done;
  });
  expect(auth.user).toEqual(OTHER);
  expect(auth.datesBetweenDays).toBe(false);
});
