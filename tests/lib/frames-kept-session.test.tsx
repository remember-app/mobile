import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

/**
 * The phone's disk, watched rather than asked about — the same stand-in `tests/lib/frames-kept.test.ts`
 * uses and for the same reason: what the app wrote is the whole of the claim, and a test that could
 * only ask the app whether it thinks it wrote something would be green over a write that went
 * nowhere.
 */
const disk = vi.hoisted(() => ({
  files: new Map<string, string>(),
  folders: new Set<string>(),
}));
vi.mock('expo-file-system', () => {
  const at = (parts: unknown[]) =>
    parts
      .map((one) => {
        if (typeof one !== 'object' || one === null) return String(one);
        const uri = (one as { uri?: unknown }).uri;
        return typeof uri === 'string' ? uri : String(one);
      })
      .join('/');
  class Directory {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = at(parts);
    }
    get exists() {
      return disk.folders.has(this.uri);
    }
    create() {
      disk.folders.add(this.uri);
    }
    delete() {
      for (const key of [...disk.files.keys()]) {
        if (key.startsWith(`${this.uri}/`)) disk.files.delete(key);
      }
      disk.folders.delete(this.uri);
    }
  }
  class File {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = at(parts);
    }
    get exists() {
      return disk.files.has(this.uri);
    }
    create() {
      disk.files.set(this.uri, '');
    }
    textSync() {
      const held = disk.files.get(this.uri);
      if (held === undefined) throw new Error('no such file');
      return held;
    }
    write(content: string) {
      disk.files.set(this.uri, content);
    }
  }
  return { Directory, File, Paths: { document: 'documents' } };
});

/**
 * The keychain, so the gate comes up holding a session: this file is about what happens to the
 * feeds when a session ends, which is a question about a session that was there.
 */
const keychain = vi.hoisted(() => ({
  token: null as string | null,
  account: null as string | null,
}));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  getItemAsync: async (key: string) =>
    key === 'session-token' ? keychain.token : key === 'session-account' ? keychain.account : null,
  setItemAsync: async (key: string, value: string) => {
    if (key === 'session-account') keychain.account = value;
  },
  deleteItemAsync: async (key: string) => {
    if (key === 'session-token') keychain.token = null;
    if (key === 'session-account') keychain.account = null;
  },
}));

import { member, photo } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import TestRenderer, { act } from 'react-test-renderer';
import type { User } from '@/api';
import { listMemories } from '@/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { keepKept, readKept } from '@/lib/frames-kept';

/**
 * TASK-512, part 2, decision-23: **the list dies with the session** — in `forget()`, beside the token
 * and the account copy, and nowhere else.
 *
 * This is the most important break in the card and it is checked against the disk rather than
 * against the app: `forgetKept` removed from `forget()`, or `forgetKept` left out of the folder
 * it takes, and every other test in the card still passes while a memory's photographs sit on the
 * phone waiting for whoever signs in next. Two ways a session ends are checked, and the second is
 * the one nobody presses a button for.
 */

mountsTrees();

const ID = '11111111-2222-3333-4444-555555555555';
const at = new Date(2026, 8, 13, 10).toISOString();
const ME = {
  id: 'me',
  username: 'anya',
  name: 'Аня',
  email: 'anya@test.test',
  dates_between_days: false,
} as User;
const SESSION = 'session-anya';

/** Every path the phone holds under the feeds folder, or nothing where none is left. */
const onDisk = () => [...disk.files.keys()].filter((one) => one.startsWith('documents/feeds/'));

let auth!: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return null;
}

/**
 * What the api answers a route with. Set per test to make it refuse or fall over; the default is a
 * working api, so a test only states the one thing it is about. Every route goes through here —
 * `/memories` included — because a shortcut of the test's own for the route it wants to break is
 * exactly how a check ends up watching nothing.
 */
const world = {
  answer: (_path: string) => new Response(JSON.stringify(ME), { status: 200 }),
};
const working = (path: string) =>
  path === '/memories'
    ? new Response('[]', { status: 200 })
    : new Response(JSON.stringify(ME), { status: 200 });

/**
 * The gate mounted, with the api behind it. Asked through the real client and not through a raw
 * `fetch`, because it is the client that turns a 401 into the refusal the provider listens for — and
 * the whole subject of the second test below is that this refusal ends the session.
 */
async function signedIn(token: string | null = SESSION) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => world.answer(new URL(url).pathname)),
  );
  if (token) keychain.token = token;
  await act(async () => {
    mounted(
      TestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      ),
    );
  });
  await settle();
}

async function settle() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((done) => setImmediate(done));
    });
  }
}

beforeEach(() => {
  disk.files.clear();
  disk.folders.clear();
  keychain.token = SESSION;
  keychain.account = JSON.stringify(ME);
  world.answer = working;
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(console.info).mockRestore();
});

/** A memory this phone kept, as a session that has been running a while leaves it. */
function kept() {
  keepKept(
    ID,
    [photo('a', 'me', at), photo('b', 'liza', at)],
    [member('me', 'organizer'), member('liza', 'contributor')],
  );
  expect(onDisk()).not.toEqual([]);
}

test('signing out by hand takes the list with the token', async () => {
  await signedIn();
  kept();

  await act(() => auth.signOut());

  expect(auth).toMatchObject({ status: 'signed-out', token: null });
  expect(onDisk()).toEqual([]);
  expect(readKept(ID)).toBeNull();
});

// The path nobody presses a button for. A 401 on a request the app made while it was running ends
// the session through the very same `forget()`, and a list that outlived it would be read by the
// next launch — signed in as somebody else, or as nobody, over a screen of another person's
// photographs.
test('a token the api stops honouring takes the list with it, not only the token', async () => {
  await signedIn();
  kept();

  // The api stops taking the token. Asked through the real client: it is the client that turns the
  // 401 into the refusal `AuthProvider` listens for, and that listener is what ends the session.
  world.answer = () => new Response('{"error":"unauthorized"}', { status: 401 });
  await act(async () => {
    await listMemories(SESSION).catch(() => {});
  });
  await settle();

  expect(auth.status).toBe('signed-out');
  expect(keychain.token).toBeNull();
  expect(onDisk()).toEqual([]);
});

// And the other side of the same coin, which is the reason this is checked here and not only in
// `tests/lib/auth.test.tsx`: a read that fails is not a session ending. The api being unreachable
// says nothing about whether this person is still who they were, so neither the token nor the list
// may go.
test('a session a blip does not end keeps its list, the same way it keeps its token', async () => {
  await signedIn();
  kept();
  const before = onDisk();

  world.answer = () => {
    throw new TypeError('Network request failed');
  };
  await act(async () => {
    await listMemories(SESSION).catch(() => {});
  });
  await settle();

  expect(auth).toMatchObject({ status: 'ready', token: SESSION });
  expect(keychain.token).toBe(SESSION);
  expect(onDisk()).toEqual(before);
});
