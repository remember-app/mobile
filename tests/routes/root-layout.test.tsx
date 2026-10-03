import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

/**
 * The two things the app waits on as it comes up, each answered by the test when it chooses: the
 * product's faces (`useFonts`) and the stored session (the keychain read that `AuthProvider` starts
 * with — `null` settles it as signed out).
 */
const wait = vi.hoisted(() => ({
  fonts: (_: [boolean, Error | null]) => {},
  keychain: (_: string | null) => {},
}));
vi.mock('@expo-google-fonts/unbounded', async () => {
  const { useState } = await import('react');
  return {
    Unbounded_600SemiBold: 'Unbounded_600SemiBold.ttf',
    Unbounded_700Bold: 'Unbounded_700Bold.ttf',
    useFonts: () => {
      const [state, set] = useState<[boolean, Error | null]>([false, null]);
      wait.fonts = set;
      return state;
    },
  };
});
vi.mock('@expo-google-fonts/onest', () => ({
  Onest_400Regular: 'Onest_400Regular.ttf',
  Onest_500Medium: 'Onest_500Medium.ttf',
  Onest_600SemiBold: 'Onest_600SemiBold.ttf',
  Onest_700Bold: 'Onest_700Bold.ttf',
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) =>
    key === 'session-token'
      ? new Promise((answer) => {
          wait.keychain = answer;
        })
      : Promise.resolve(null),
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

const seen = vi.hoisted(() => ({
  splashHeld: false,
  splashHidden: 0,
  push: 0,
  uploads: 0,
  backs: 0,
  mayGoBack: true,
}));
vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => {
    seen.splashHeld = true;
  },
  hideAsync: async () => {
    seen.splashHidden += 1;
  },
}));
vi.mock('@/lib/push', () => ({
  usePush: () => {
    seen.push += 1;
  },
}));
vi.mock('@/lib/upload/send', () => ({
  useUploads: () => {
    seen.uploads += 1;
    return [];
  },
}));
vi.mock('@/lib/orientation', () => ({ lockPortrait: () => {} }));
vi.mock('expo-router', () => ({
  Stack: Object.assign(() => null, { Screen: () => null, Protected: () => null }),
  // Where the navigator stands — off the way in, so its progress is not drawn.
  usePathname: () => '/',
  // The way back, read off the store the navigator writes to (TASK-477).
  router: {
    back: () => {
      seen.backs += 1;
    },
    canGoBack: () => seen.mayGoBack,
  },
  ThemeProvider: ({ children }: { children: unknown }) => children,
  DarkTheme: { dark: true, colors: {} },
  DefaultTheme: { dark: false, colors: {} },
}));

import { touch } from '@tests/helpers/gesture';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Stack } from 'expo-router';
import TestRenderer, { act } from 'react-test-renderer';
import RootLayout from '@/app/_layout';

/**
 * The app coming up cold (TASK-380). A screen drawn before the product's faces are registered keeps
 * the system's letters for good — its text is never laid out again — so the navigator, and every
 * screen under it, waits for the faces; the splash covers the wait, and a font that fails to load
 * still lets the app open, in the system face.
 */

mountsTrees();

beforeEach(() => {
  seen.splashHidden = 0;
  seen.push = 0;
  seen.uploads = 0;
  seen.backs = 0;
  seen.mayGoBack = true;
});

async function launch() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<RootLayout />));
  });
  return () => tree.root.findAllByType(Stack).length > 0;
}

async function fontsSettle(state: [boolean, Error | null]) {
  await act(async () => wait.fonts(state));
}

async function sessionSettles() {
  await act(async () => {
    wait.keychain(null);
    await new Promise((done) => setImmediate(done));
  });
}

test('no screen exists before the faces are in, whatever the session says, and the splash stays', async () => {
  const drawn = await launch();
  expect(seen.splashHeld).toBe(true);
  expect(drawn()).toBe(false);

  await sessionSettles();
  expect(drawn()).toBe(false);
  expect(seen.splashHidden).toBe(0);
  // Whatever navigates waits with the navigator: a navigation issued before one is mounted throws.
  expect(seen.push).toBe(0);
  // The upload queue needs no screen, so it does not wait for the faces.
  expect(seen.uploads).toBeGreaterThan(0);
});

test('the faces in, the navigator is drawn; the splash goes once the session is settled too', async () => {
  const drawn = await launch();

  await fontsSettle([true, null]);
  expect(drawn()).toBe(true);
  expect(seen.push).toBeGreaterThan(0);
  expect(seen.splashHidden).toBe(0);

  await sessionSettles();
  expect(seen.splashHidden).toBe(1);
});

test('faces that fail to load still open the app, in the system face, and say so in the log', async () => {
  const drawn = await launch();
  await sessionSettles();
  const failure = new Error('Onest_400Regular.ttf: no such file');
  vi.mocked(console.warn).mockImplementationOnce(() => {});

  await fontsSettle([false, failure]);
  expect(drawn()).toBe(true);
  expect(seen.splashHidden).toBe(1);
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('system font'), failure);
});

/**
 * The way back (TASK-477): a finger in from the left edge, on every screen, hung once on the view
 * the navigator stands in. What a test cannot see here is the strip being narrow enough — that is
 * `tests/lib/gesture.test.ts`, and this file says only that the answer reaches the router and that
 * the edge belongs to the whole app rather than to one screen.
 */

/** The view the whole app stands in: the one the responder is hung on. */
async function theEdge() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<RootLayout />));
  });
  await fontsSettle([true, null]);
  const app = () =>
    tree.root.find((one) => typeof one.props.onMoveShouldSetResponderCapture === 'function');
  /** A finger that went down at one place and has come to another, as the responder system has it. */
  const swipe = async (x0: number, x: number, y = 400) => {
    const edge = app();
    await act(async () => edge.props.onStartShouldSetResponderCapture(touch({ x: x0, y })));
    const taken = await act(async () =>
      edge.props.onMoveShouldSetResponderCapture(touch({ x, y, fromX: x0, fromY: y })),
    );
    if (taken) await act(async () => edge.props.onResponderRelease(touch({ x, y })));
    return taken;
  };
  return { swipe };
}

test('a swipe in from the left edge goes back, and one from the middle of the screen is left alone', async () => {
  const edge = await theEdge();
  expect(await edge.swipe(4, 200)).toBe(true);
  expect(seen.backs).toBe(1);
  // Not the edge: whatever is under the finger keeps it, which is every horizontal gesture in the app.
  expect(await edge.swipe(200, 380)).toBe(false);
  expect(seen.backs).toBe(1);
});

test('a swipe off the edge that did not come far enough changes nothing, and one with nowhere to go back to does not either', async () => {
  const edge = await theEdge();
  // Taken off whatever was under it, but too short to mean anything — a finger that changed its mind.
  expect(await edge.swipe(0, 20)).toBe(true);
  expect(seen.backs).toBe(0);

  // The first screen has nowhere to go back to, and the edge is still there: a swipe is nothing,
  // not a route change off the app.
  seen.mayGoBack = false;
  expect(await edge.swipe(0, 200)).toBe(true);
  expect(seen.backs).toBe(0);
});
