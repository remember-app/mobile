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

import { type Asked, contact, later, refused, serve } from '@tests/helpers/api';
import { account, datesRefusal } from '@tests/helpers/contract';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
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
import { ru } from '@/strings';
import { setTheme } from '@/theme';

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
}: {
  contacts?: unknown[];
  dates?: () => unknown;
  username?: () => unknown;
  logout?: () => unknown;
} = {}): Asked[] {
  let me = { ...ME };
  return serve((asked) => {
    if (asked.path === '/me' || asked.path === '/me/language') return me;
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

test('a refused change turns the switch back and says why over the settings', async () => {
  world({ dates: () => refused(500, 'boom') });
  const screen = await open();
  await screen.press(screen.toggle().findByType(Pressable));
  expect(screen.toggle().props.value).toBe(false);
  expect(screen.banner()).toBe(new ApiError(500, { error: 'boom' }).message);
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
