import { expect, test, vi } from 'vitest';

// The phone: what it says its theme is, what the last run of the app left on it, and — once the
// module has started — the listener it would call if the person changed that setting. `expo-secure-
// store` is native and does not exist under vitest; `Appearance` here is the real one only as far as
// the rest of `react-native` is concerned. `vi.hoisted` is what lets the factories below — which
// vitest hoists above the imports — reach the same object the tests write to.
const { phone } = vi.hoisted(() => ({
  phone: {
    scheme: 'dark' as 'dark' | 'light' | 'unspecified' | null,
    stored: null as string | null,
    tell: null as ((event: { colorScheme: 'dark' | 'light' | 'unspecified' | null }) => void) | null,
  },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => phone.stored,
  setItemAsync: async (_key: string, value: string) => {
    phone.stored = value;
  },
}));

vi.mock('react-native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-native')>()),
  Appearance: {
    getColorScheme: () => phone.scheme,
    addChangeListener: (listener: NonNullable<typeof phone.tell>) => {
      phone.tell = listener;
      return { remove: () => {} };
    },
  },
}));

/** A cold start of the app on a phone set to `scheme`, carrying whatever the last start stored. */
async function start(scheme: typeof phone.scheme) {
  phone.scheme = scheme;
  vi.resetModules();
  const theme = await import('@/theme');
  await theme.themeReady;
  return theme;
}

test('the phone decides, when nobody has decided otherwise', async () => {
  phone.stored = null;
  expect((await start('light')).currentTheme()).toBe('light');
  expect((await start('dark')).currentTheme()).toBe('dark');
});

test('a phone that says nothing gets the dark room', async () => {
  // `unspecified` is Android with no setting, `null` is a phone that never answered. Neither is a
  // reason to guess daylight.
  phone.stored = null;
  expect((await start('unspecified')).currentTheme()).toBe('dark');
  expect((await start(null)).currentTheme()).toBe('dark');
});

test('a picked theme beats the phone, and outlives the app', async () => {
  phone.stored = null;
  const first = await start('dark');
  await first.setTheme('light');
  expect(first.currentTheme()).toBe('light');
  // Same phone, still dark, next launch: the pick is read back off the disk.
  expect((await start('dark')).currentTheme()).toBe('light');
});

test('a stored value the app does not draw in is not a pick', async () => {
  // Anything but the two themes — an older build, a rolled-back one — leaves the phone deciding.
  phone.stored = 'sepia';
  expect((await start('light')).currentTheme()).toBe('light');
});

test('the phone turning light while the app is open turns the app light', async () => {
  phone.stored = null;
  const theme = await start('dark');
  phone.tell?.({ colorScheme: 'light' });
  expect(theme.currentTheme()).toBe('light');
});

test('and it stops following the phone once someone has picked', async () => {
  phone.stored = null;
  const theme = await start('dark');
  await theme.setTheme('dark');
  phone.tell?.({ colorScheme: 'light' });
  expect(theme.currentTheme()).toBe('dark');
});
