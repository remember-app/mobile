import { afterEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
// The keychain holds a session, so the provider signs in the way a launch does.
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  getItemAsync: async (key: string) => (key === 'session-token' ? 'session' : null),
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
const router = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  canGoBack: () => true,
}));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useRouter: () => router,
  };
});
// A text input wants a document, which node has not got; the field stands in as its props, and the
// test types by calling what the form handed it.
vi.mock('@/kit', async (original) => ({
  ...(await original<typeof import('@/kit')>()),
  Field: () => null,
}));
/**
 * What the screen is handed by the provider, bent where a test needs it: a way out that fails can
 * only be seen while the account is still there, and the real one lets the account go first.
 */
const bent = vi.hoisted(() => ({ signOut: undefined as undefined | (() => Promise<void>) }));
vi.mock('@/lib/auth', async (original) => {
  const real = await original<typeof import('@/lib/auth')>();
  return {
    ...real,
    useAuth: () => {
      const auth = real.useAuth();
      return bent.signOut ? { ...auth, signOut: bent.signOut } : auth;
    },
  };
});

import { expectReachable } from '@tests/helpers/access';
import { type Asked, contact, later, refused, serve } from '@tests/helpers/api';
import { account, datesRefusal, languageRefusal } from '@tests/helpers/contract';
import { mounted, mountsTrees, themesShown } from '@tests/helpers/renderer';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { ApiError } from '@/api';
import ProfileScreen from '@/app/profile';
import {
  Avatar,
  AvatarStack,
  Banner,
  Button,
  ConfirmSheet,
  Field,
  IconButton,
  RowSection,
  RowToggle,
  Segment,
  Sheet,
  Text,
} from '@/kit';
import { AuthProvider, useAuth } from '@/lib/auth';
import { setLanguage } from '@/lib/language';
import { ru, strings } from '@/strings';
import { setTheme, themes } from '@/theme';

/**
 * `Account` (spec 8) as a person walks it: the real provider and client, the api stood in for behind
 * `fetch`, and the gate of `_layout.tsx` as far as this screen is concerned — it stands only while
 * the account is signed in.
 */

mountsTrees();
afterEach(async () => {
  vi.unstubAllGlobals();
  router.push.mockClear();
  bent.signOut = undefined;
  await act(async () => {
    await setTheme('dark');
    await setLanguage('ru');
  });
});

const ME = account();

/** The api: the account, its contacts, and whatever a test puts in front of the rest. */
function world({
  contacts = [contact('mark', 'Марк Ковалёв'), contact('anya', 'Аня Петрова')],
  dates,
  username,
  logout,
  who,
}: {
  who?: Partial<typeof ME>;
  contacts?: unknown;
  dates?: () => unknown;
  username?: () => unknown;
  logout?: () => unknown;
} = {}): Asked[] {
  let me = { ...ME, ...who };
  return serve((asked) => {
    if (asked.path === '/me/language') {
      const bad = languageRefusal(asked.body);
      if (bad) return bad;
      me = { ...me, ...(asked.body as object) };
      return me;
    }
    if (asked.path === '/me') return me;
    if (asked.path === '/me/contacts') return contacts;
    if (asked.path === '/me/dates-between-days') {
      const bad = datesRefusal(asked.body);
      if (bad) return bad;
      if (dates) return dates();
      me = { ...me, ...(asked.body as object) };
      return me;
    }
    if (asked.path.startsWith('/me/username/available')) return { available: true };
    if (asked.path === '/me/username') {
      if (username) return username();
      me = { ...me, ...(asked.body as object) };
      return me;
    }
    if (asked.path === '/auth/logout') return logout ? logout() : {};
    return undefined;
  });
}

function Gate({ children }: { children: ReactNode }) {
  return useAuth().status === 'ready' ? children : null;
}

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((done) => setImmediate(done));
    });
  }
}

async function open() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <AuthProvider>
          <Gate>
            <ProfileScreen />
          </Gate>
        </AuthProvider>,
      ),
    );
  });
  await settle();
  const root = () => tree.root;
  const shown = () => root().findAllByType(ProfileScreen).length === 1;
  expect(shown()).toBe(true);
  return {
    root,
    shown,
    /** Every word drawn, in the order the eye meets it. */
    words: () =>
      root()
        .findAllByType(Text)
        .map((text) => [text.props.children].flat().join('')),
    press: async (node: ReactTestInstance) => {
      await act(async () => node.props.onPress());
      await settle();
    },
    button: (label: string) =>
      root()
        .findAllByType(Button)
        .find((one) => one.props.label === label),
    segment: (label: string) =>
      root()
        .findAllByType(Segment)
        .find((one) => one.props.label === label)!,
    option: (label: string) =>
      root()
        .findAllByType(Pressable)
        .find(
          (one) =>
            one.props.accessibilityRole === 'radio' && one.props.accessibilityLabel === label,
        )!,
    toggle: () => root().findByType(RowToggle),
    pencil: () =>
      root()
        .findAllByType(IconButton)
        .find((one) => one.props.label === ru.profile.edit)!,
    /** The sheet of the pencil — the other sheet on this screen is the question before the way out. */
    renaming: () =>
      root()
        .findAllByType(Sheet)
        .find((one) => one.props.title === ru.profile.edit)!,
    banner: () => root().findAllByType(Banner)[0]?.props.text as string | undefined,
  };
}

test('the screen is the card, «Контакты», «Тема» and «Язык», «Галерея» and the way out, in that order', async () => {
  world();
  const screen = await open();
  const words = screen.words();
  const order = [
    ru.profile.title,
    'Лиза Морозова',
    '@liza',
    'liza@example.com',
    'КОНТАКТЫ',
    '2 человека',
    ru.profile.contactsMeta,
    'ТЕМА',
    'ЯЗЫК',
    'ГАЛЕРЕЯ',
    ru.profile.datesBetweenDays,
  ].map((word) => words.indexOf(word));
  expect(order).not.toContain(-1);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  // The account's own circle, and the faces of the people it keeps.
  expect(screen.root().findAllByType(Avatar)[0].props).toMatchObject({ size: 64, display: true });
  expect(screen.root().findByType(AvatarStack).props.names).toEqual([
    'Марк Ковалёв',
    'Аня Петрова',
  ]);
  // The pencil, the three and the two pills, the switch, and the red way out last of all.
  expect(screen.pencil()).toBeDefined();
  expect(
    screen.segment(ru.theme.label).props.options.map((o: { label: string }) => o.label),
  ).toEqual(['Как в системе', 'Тёмная', 'Светлая']);
  expect(
    screen.segment(ru.language.label).props.options.map((o: { label: string }) => o.label),
  ).toEqual(['Русский', 'English']);
  expect(screen.button(ru.action.logOut)?.props.variant).toBe('danger');
  // Nothing written under the pills or under the switch, and nothing asked until the way out is
  // pressed.
  for (const segment of screen.root().findAllByType(Segment)) {
    expect(segment.props.hint).toBeUndefined();
  }
  expect(screen.root().findByType(ConfirmSheet).props.visible).toBe(false);
  expect(screen.renaming().props.visible).toBe(false);
});

const crowd = () =>
  [
    'Марк Ковалёв',
    'Аня Петрова',
    'Вера Горина',
    'Жанна Щукина',
    'Пётр Иванов',
    'Лев Орлов',
    'Ия Ким',
  ].map((name, at) => contact(`c${at}`, name));

test.each(['dark', 'light'] as const)(
  '«Контакты» in the %s theme carries the 36 stack — three faces and the four behind them — collared in the card’s own colour',
  async (name) => {
    await act(async () => setTheme(name));
    world({ contacts: crowd() });
    const screen = await open();
    expect(screen.words()).toContain('7 человек');
    const stack = screen.root().findByType(AvatarStack);
    // The 36 of the account's card and not the pill's 24, and never the layout's four faces plus a fifth.
    const circles = stack
      .findAllByType(View)
      .map((one) => StyleSheet.flatten(one.props.style) ?? {})
      .filter((style) => style.width === 36);
    expect(circles).toHaveLength(4);
    const said = stack.findAllByType(Text).map((one) => [one.props.children].flat().join(''));
    expect(said).toEqual(['МК', 'АП', 'ВГ', '+4']);
    // The collar is cut in what the card is filled with, or the edges of the circles show a seam.
    const card = screen.root().findByType(RowSection).findByType(Pressable);
    const ground = StyleSheet.flatten(card.props.style({ pressed: false })).backgroundColor;
    expect(ground).toBe(themes[name].color.surface);
    for (const style of circles) expect(style.boxShadow).toBe(`0 0 0 2px ${ground}`);
  },
);

test('with nobody saved there is no count and no faces, and the card still says what it is for', async () => {
  world({ contacts: [] });
  const screen = await open();
  expect(screen.root().findAllByType(AvatarStack)).toHaveLength(0);
  const section = screen.root().findByType(RowSection).props;
  expect(section.title).toBe(ru.profile.contactsMeta);
  expect(section.meta).toBeUndefined();
});

test('«Контакты» leads to the contact list', async () => {
  world();
  const screen = await open();
  await screen.press(screen.root().findByType(RowSection).findByType(Pressable));
  expect(router.push).toHaveBeenCalledWith('/contacts');
});

test('the switch shows the account’s «Даты между днями» and changes it on the api', async () => {
  const asked = world();
  const screen = await open();
  expect(screen.toggle().props.value).toBe(false);
  await screen.press(screen.toggle().findByType(Pressable));
  expect(asked.filter((one) => one.path === '/me/dates-between-days')).toEqual([
    { method: 'POST', path: '/me/dates-between-days', body: { dates_between_days: true } },
  ]);
  expect(screen.toggle().props.value).toBe(true);
  expect(screen.banner()).toBeUndefined();
});

test.each([
  [
    'refused with a reason',
    () => refused(500, 'boom'),
    new ApiError(500, { error: 'boom' }).message,
  ],
  ['refused by the schema', () => refused(400, 'body must be object'), 'body must be object'],
  ['too many asks', () => refused(429), ru.error.tooMany],
  ['not reached', () => 'offline', ru.error.offline],
])('a change %s turns the switch back and says why over the settings', async (_, answer, said) => {
  world({ dates: answer });
  const screen = await open();
  await screen.press(screen.toggle().findByType(Pressable));
  expect(screen.toggle().props.value).toBe(false);
  expect(screen.banner()).toBe(said);
  // And the next press is a fresh try, not a switch stuck where the failure left it.
  world();
  await screen.press(screen.toggle().findByType(Pressable));
  expect(screen.toggle().props.value).toBe(true);
  expect(screen.banner()).toBeUndefined();
});

test('the pills turn the theme and the language', async () => {
  const asked = world();
  const screen = await open();
  expect(screen.segment(ru.theme.label).props.value).toBe('dark');
  await screen.press(screen.option('Светлая'));
  expect(screen.segment(ru.theme.label).props.value).toBe('light');

  expect(screen.segment(ru.language.label).props.value).toBe('ru');
  await screen.press(screen.option('English'));
  // The whole screen speaks the other language at once, and the account is told which.
  expect(screen.words()).toContain('Account');
  expect(screen.segment('Language').props.value).toBe('en');
  expect(asked).toContainEqual({ method: 'POST', path: '/me/language', body: { language: 'en' } });
});

test('the pencil opens the one username form on a sheet, and a new name closes it', async () => {
  const asked = world();
  const screen = await open();
  await screen.press(screen.pencil());
  const sheet = screen.renaming;
  expect(sheet().props.visible).toBe(true);
  // Not a route: /set-username is the last step of the way in, and the gate keeps it there.
  expect(router.push).not.toHaveBeenCalled();

  const field = sheet().findByType(Field);
  expect(field.props.value).toBe('liza');
  await act(async () => field.props.onChangeText('liza.m'));
  await screen.press(screen.button(ru.action.save)!);
  expect(asked).toContainEqual({
    method: 'POST',
    path: '/me/username',
    body: { username: 'liza.m' },
  });
  expect(sheet().props.visible).toBe(false);
  expect(screen.words()).toContain('@liza.m');
});

test('a name somebody holds keeps the sheet up and says so; closed and opened again, the form starts over', async () => {
  world({ username: () => refused(409, 'username taken') });
  const screen = await open();
  await screen.press(screen.pencil());
  const field = () => screen.renaming().findByType(Field);
  await act(async () => field().props.onChangeText('mark'));
  await screen.press(screen.button(ru.action.save)!);
  expect(screen.renaming().props.visible).toBe(true);
  expect(field().props.hint).toBe(ru.error.usernameTaken);
  expect(screen.words()).toContain('@liza');

  await act(async () => screen.renaming().props.onCancel());
  await screen.press(screen.pencil());
  expect(field().props).toMatchObject({ value: 'liza', hint: ru.username.lead });
});

test('the way out asks first, and «Остаться» keeps the person here', async () => {
  const asked = world();
  const screen = await open();
  await screen.press(screen.button(ru.action.logOut)!);
  const ask = () => screen.root().findByType(ConfirmSheet).props;
  expect(ask()).toMatchObject({
    visible: true,
    variant: 'gentle',
    title: ru.profile.logOutAsk,
    text: ru.profile.logOutText,
  });
  await screen.press(screen.button(ru.profile.stay)!);
  expect(ask().visible).toBe(false);
  expect(asked.some((one) => one.path === '/auth/logout')).toBe(false);
  expect(screen.shown()).toBe(true);
});

test('«Выйти» waits on the api with the red button busy, and the gate takes the screen away', async () => {
  const answer = later<unknown>();
  const asked = world({ logout: () => answer.promise });
  const screen = await open();
  await screen.press(screen.button(ru.action.logOut)!);
  await screen.press(screen.button(ru.profile.logOutDo)!);
  expect(screen.root().findByType(ConfirmSheet).props.visible).toBe(false);
  expect(screen.button(ru.action.logOut)?.props.busy).toBe(true);
  expect(asked).toContainEqual({ method: 'POST', path: '/auth/logout', body: null });

  await act(async () => answer.settle({}));
  await settle();
  expect(screen.shown()).toBe(false);
});

test('a way out that fails lets the button go and says why', async () => {
  world();
  bent.signOut = async () => {
    throw new ApiError(503, { error: 'keychain says no' });
  };
  const screen = await open();
  await screen.press(screen.button(ru.action.logOut)!);
  await screen.press(screen.button(ru.profile.logOutDo)!);
  expect(screen.shown()).toBe(true);
  expect(screen.button(ru.action.logOut)?.props.busy).toBe(false);
  expect(screen.banner()).toBe(new ApiError(503, { error: 'keychain says no' }).message);
});

test('a very long name and address are each cut to one line, so the circle and the pencil never move', async () => {
  world({
    who: {
      name: 'Александра-Виктория '.repeat(6).trim(),
      email: `${'очень.длинный.адрес'.repeat(5)}@example.com`,
    },
  });
  const screen = await open();
  const card = screen
    .root()
    .findAllByType(Text)
    .filter((one) => one.props.numberOfLines === 1);
  const said = card.map((one) => [one.props.children].flat().join(''));
  expect(said).toEqual(
    expect.arrayContaining([
      'Александра-Виктория '.repeat(6).trim(),
      '@liza',
      `${'очень.длинный.адрес'.repeat(5)}@example.com`,
    ]),
  );
});

test('a contact list that cannot be read is no count and no faces, and the switch still works', async () => {
  const asked = world({ contacts: refused(500, 'boom') });
  const screen = await open();
  expect(screen.root().findAllByType(AvatarStack)).toHaveLength(0);
  expect(screen.root().findByType(RowSection).props.meta).toBeUndefined();
  expect(screen.banner()).toBeUndefined();
  await screen.press(screen.toggle().findByType(Pressable));
  expect(asked.filter((one) => one.path === '/me/dates-between-days')).toHaveLength(1);
  expect(screen.toggle().props.value).toBe(true);
});

test('the switch pressed twice in a row ends on the last press, and what the api holds is the same', async () => {
  const asked = world();
  const screen = await open();
  const press = () =>
    act(async () => screen.toggle().props.onValueChange(!screen.toggle().props.value));
  await press();
  await press();
  await settle();
  const sent = asked
    .filter((one) => one.path === '/me/dates-between-days')
    .map((one) => (one.body as { dates_between_days: boolean }).dates_between_days);
  expect(sent).toEqual([true, false]);
  expect(screen.toggle().props.value).toBe(false);
  expect(screen.banner()).toBeUndefined();
});

test.each([
  ['en', 'dark'],
  ['ru', 'light'],
  ['en', 'light'],
] as const)(
  'in %s and in the %s theme the screen says the same things in the same order and wears only its own theme',
  async (lang, theme) => {
    world();
    await act(async () => {
      await setLanguage(lang);
      await setTheme(theme);
    });
    const screen = await open();
    const said = strings[lang];
    const words = screen.words();
    const order = [
      said.profile.title,
      '@liza',
      said.contacts.title.toUpperCase(),
      said.profile.contactsMeta,
      said.theme.label.toUpperCase(),
      said.language.label.toUpperCase(),
      said.profile.gallery.toUpperCase(),
      said.profile.datesBetweenDays,
      said.action.logOut,
    ].map((word) => words.indexOf(word));
    expect(order).not.toContain(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // The pencil is read out in the app's language, the pills name themselves in their own.
    expect(
      screen
        .root()
        .findAllByType(IconButton)
        .some((one) => one.props.label === said.profile.edit),
    ).toBe(true);
    expect(
      screen.segment(said.language.label).props.options.map((o: { label: string }) => o.label),
    ).toEqual(['Русский', 'English']);
    const shown = themesShown(screen.root());
    expect(theme === 'light' ? shown.night : shown.day).toEqual([]);
    expect(theme === 'light' ? shown.day : shown.night).not.toEqual([]);
  },
);

test('every control on the screen has a role and a name, a finger can hit it, and the order of reading is the order of the layout', async () => {
  world();
  const screen = await open();
  const found = expectReachable(screen.root());
  // Top to bottom, as the layout stacks them: the way back, the pencil, the contacts, the pills of
  // the theme and of the language, the switch, the way out — read out as they are drawn.
  expect(found.map((one) => one.name)).toEqual([
    ru.action.back,
    ru.profile.edit,
    `2 человека ${ru.profile.contactsMeta}`,
    'Как в системе',
    'Тёмная',
    'Светлая',
    'Русский',
    'English',
    ru.profile.datesBetweenDays,
    ru.action.logOut,
  ]);
  expect(found.map((one) => one.role)).toEqual([
    'button',
    'button',
    'button',
    ...Array(5).fill('radio'),
    'switch',
    'button',
  ]);
  // The pills carry no line of their own, so the group is what says what they choose between.
  expect(
    screen
      .root()
      .findAllByType(View)
      .filter((one) => one.props.accessibilityRole === 'radiogroup')
      .map((one) => one.props.accessibilityLabel),
  ).toEqual([ru.theme.label, ru.language.label]);
  // And the switch says which way it stands, not only that it is one.
  expect(screen.toggle().findByType(Pressable).props.accessibilityState).toMatchObject({
    checked: false,
  });
});
