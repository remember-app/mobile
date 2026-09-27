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

const seen = vi.hoisted(() => ({ splashHeld: false, splashHidden: 0, push: 0, uploads: 0 }));
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
  ThemeProvider: ({ children }: { children: unknown }) => children,
  DarkTheme: { dark: true, colors: {} },
  DefaultTheme: { dark: false, colors: {} },
}));

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
