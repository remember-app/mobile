import { expect, test, vi } from 'vitest';

// Both expo modules are native and do not exist under vitest, so these two stand in for the phone:
// `locales` is the language list it reports, `stored` is what the last run of the app left on it.
// `vi.hoisted` is what lets the factories below — which vitest hoists above the imports — reach the
// same object the tests write to.
const { phone } = vi.hoisted(() => ({
  phone: { locales: ['en-US'] as string[], stored: null as string | null },
}));

vi.mock('expo-localization', () => ({
  getLocales: () => phone.locales.map((languageTag) => ({ languageTag })),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => phone.stored,
  setItemAsync: async (_key: string, value: string) => {
    phone.stored = value;
  },
}));

/** A cold start of the app on a phone set to `locales`, carrying whatever the last start stored. */
async function start(locales: string[]) {
  phone.locales = locales;
  vi.resetModules();
  const language = await import('@/language');
  await language.languageReady;
  return language;
}

test('the phone decides, when nobody has decided otherwise', async () => {
  phone.stored = null;
  expect((await start(['ru-RU'])).currentLanguage()).toBe('ru');
  expect((await start(['en-GB'])).currentLanguage()).toBe('en');
});

test('a phone in neither language gets English rather than a guess', async () => {
  phone.stored = null;
  expect((await start(['de-DE', 'fr-FR'])).currentLanguage()).toBe('en');
  expect((await start([])).currentLanguage()).toBe('en');
});

test('a language further down the phone’s list still counts', async () => {
  // The order is the phone's own preference, so German first and Russian second is a person who
  // reads Russian — English is the fallback, not the second choice.
  phone.stored = null;
  expect((await start(['de-DE', 'ru-RU'])).currentLanguage()).toBe('ru');
});

test('a picked language beats the phone, and outlives the app', async () => {
  phone.stored = null;
  const first = await start(['en-US']);
  await first.setLanguage('ru');
  expect(first.currentLanguage()).toBe('ru');
  // Same phone, still English, next launch: the pick is read back off the disk.
  expect((await start(['en-US'])).currentLanguage()).toBe('ru');
});

test('a stored value the app does not speak is not a pick', async () => {
  // Anything but the two languages — an older build, a rolled-back one — leaves the phone deciding.
  phone.stored = 'de';
  expect((await start(['ru-RU'])).currentLanguage()).toBe('ru');
});

test('the words follow the language', async () => {
  phone.stored = null;
  const language = await start(['ru-RU']);
  const { strings } = await import('@/strings');
  expect(strings[language.currentLanguage()].action.back).toBe('Назад');
  await language.setLanguage('en');
  expect(strings[language.currentLanguage()].action.back).toBe('Back');
});
