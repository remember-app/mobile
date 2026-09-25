import { afterEach, expect, test, vi } from 'vitest';

const phone = vi.hoisted(() => ({ apple: true }));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('expo-apple-authentication', () => ({
  isAvailableAsync: async () => phone.apple,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
vi.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: () => [{}, null, async () => {}],
}));
vi.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: () => {} }));
vi.mock('expo-router', () => ({ useFocusEffect: () => {}, useRouter: () => ({ push: () => {} }) }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ signIn: async () => {} }) }));

import { later, refused, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import TestRenderer, { act } from 'react-test-renderer';
import { API_URL } from '@/api';
import { ru } from '@/strings';

/**
 * `Login` draws a way in only when both halves can walk it (TASK-354): the api has switched the
 * provider on (`GET /auth/methods`) and this phone and build can start it. Mail is the one door
 * that needs nobody's word, so it stands from the first paint and is all there is until — and
 * unless — the api answers.
 */

mountsTrees();
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const [APPLE, GOOGLE, MAIL] = [ru.login.withApple, ru.login.withGoogle, ru.login.withEmail];
const CLIENT_ID = 'remember.apps.googleusercontent.com';

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((done) => setImmediate(done));
    });
  }
}

/**
 * A cold start of the screen. The Google client id is read once, when the module loads, the way Expo
 * inlines it into a build — so each start loads the screen afresh, in a build that carries `clientId`
 * or none (`null`), on a phone that can or cannot sign in with Apple.
 */
async function open({ apple = true, clientId = CLIENT_ID as string | null } = {}) {
  phone.apple = apple;
  vi.stubEnv('EXPO_PUBLIC_GOOGLE_CLIENT_ID', clientId ?? undefined);
  vi.resetModules();
  const { default: LoginScreen } = await import('@/app/login');
  const { Banner, Button } = await import('@/kit');
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<LoginScreen />));
  });
  await settle();
  return {
    doors: () => tree.root.findAllByType(Button).map((one) => one.props.label),
    banners: () => tree.root.findAllByType(Banner).length,
  };
}

const methods = (on: { apple?: boolean; google?: boolean }) => ({
  email: true,
  apple: false,
  google: false,
  ...on,
});

test.each([
  ['only mail switched on', methods({}), {}, [MAIL]],
  ['Apple on, and the phone can', methods({ apple: true }), {}, [APPLE, MAIL]],
  ['Apple on, and the phone cannot', methods({ apple: true }), { apple: false }, [MAIL]],
  ['Google on, and the build has a client id', methods({ google: true }), {}, [GOOGLE, MAIL]],
  [
    'Google on, and the build has no client id',
    methods({ google: true }),
    { clientId: null },
    [MAIL],
  ],
  [
    'both on, on a phone and build that can walk both',
    methods({ apple: true, google: true }),
    {},
    [APPLE, GOOGLE, MAIL],
  ],
])('%s', async (_, answer, build, drawn) => {
  const asked = serve((one) => (one.path === '/auth/methods' ? answer : undefined));
  const screen = await open(build);
  expect(screen.doors()).toEqual(drawn);
  expect(asked).toEqual([{ method: 'GET', path: '/auth/methods', body: null }]);
});

test('until the api answers there is the mail door alone, and the other two only join it', async () => {
  const answer = later<unknown>();
  serve(() => answer.promise);
  const screen = await open();
  // The phone has said yes and the build has an id: only the api is still out.
  expect(screen.doors()).toEqual([MAIL]);
  await act(async () => answer.settle(methods({ apple: true, google: true })));
  await settle();
  expect(screen.doors()).toEqual([APPLE, GOOGLE, MAIL]);
});

test.each([
  ['no connection', 'offline'],
  ['a refusal', refused(500)],
  ['an api that has no such route yet', undefined],
  ['a body that is not JSON', new Response('<html>Bad gateway</html>', { status: 200 })],
  ['yes written as a word', { email: true, apple: 'true', google: 'true' }],
  ['an empty body', new Response('', { status: 200 })],
])('%s leaves the mail door alone, and says nothing about it', async (_, answer) => {
  serve(() => answer);
  const screen = await open();
  expect(screen.doors()).toEqual([MAIL]);
  expect(screen.banners()).toBe(0);
});

test('an api that never answers is given up on in seconds, asked without a session, and leaves mail', async () => {
  const asked: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    (url: string, init: RequestInit) =>
      new Promise((_, fail) => {
        asked.push({ url, init });
        init.signal?.addEventListener('abort', () =>
          fail(new DOMException('aborted', 'AbortError')),
        );
      }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const screen = await open();
  expect(asked).toHaveLength(1);
  expect(asked[0]?.url).toBe(`${API_URL}/auth/methods`);
  expect(asked[0]?.init.headers).not.toHaveProperty('Authorization');

  await act(async () => {
    vi.advanceTimersByTime(5000);
  });
  await settle();
  expect(asked[0]?.init.signal?.aborted).toBe(true);
  expect(screen.doors()).toEqual([MAIL]);
  expect(screen.banners()).toBe(0);
});
