import { expect, test, vi } from 'vitest';

// The phone under the screens: its window, the type size the person set and the status line.
const { phone, life } = vi.hoisted(() => ({
  phone: { width: 360, height: 640, fontScale: 1, top: 24 },
  life: { started: 0, alive: 0 },
}));

vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({
      width: phone.width,
      height: phone.height,
      scale: 3,
      fontScale: phone.fontScale,
    }),
    // The plain container `vitest.setup.ts` makes of it: this mock replaces that one, it does not add.
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: phone.top, right: 0, bottom: 0, left: 0 }),
}));
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('expo-router', () => ({
  useFocusEffect: () => {},
  useRouter: () => ({ back: () => {}, push: () => {}, replace: () => {} }),
  useLocalSearchParams: () => ({ email: 'liza@example.com' }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    token: 'session',
    user: { id: 'me', username: null },
    signIn: async () => {},
    setUsername: async () => {},
  }),
}));
// A text input listens on the browser's `document`, which a test renderer has none of: the two fields
// stand in as a bare element, counting how many times they are drawn from nothing — a field drawn
// anew is the keyboard going down with it.
vi.mock('@/kit', async (original) => {
  const { createElement, useEffect } = await import('react');
  const input = (props: object) => {
    useEffect(() => {
      life.started += 1;
      life.alive += 1;
      return () => {
        life.alive -= 1;
      };
    }, []);
    return createElement('input-stub', props);
  };
  return { ...(await original<typeof import('@/kit')>()), Field: input, CodeField: input };
});

import { blocks, measure, scrolled } from '@tests/helpers/board';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { ReactElement } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import ConsentScreen from '@/app/consent';
import LoginCodeScreen from '@/app/login/code';
import LoginEmailScreen from '@/app/login/email';
import SetUsernameScreen from '@/app/set-username';
import { ActionBar, Button, IconButton } from '@/kit';
import { ru } from '@/strings';

/**
 * TASK-372 — the four onboarding screens with a field or a button that has to stay reachable
 * (address, code, agreement, name), on the two phones the check names: an ordinary 360 × 640 at the
 * system's own type, and the smallest one, 320 × 568, at the largest type. What is read is where the
 * board puts the bottom layer — standing at the bottom, or scrolled with the body once the two of
 * them cannot stand together — and that the field and the button are there once and are pressable
 * either way. What a phone would lay out (how tall the layer really comes out) is told to the board
 * by hand: node has no layout, so the heights are the ones a phone would report, and the ones the
 * real screens come out at are the pilot's.
 */

mountsTrees();

/** Each screen, the label of its main button, and whether a field stands over it. */
const SCREENS: [string, () => ReactElement, string, boolean][] = [
  ['«Sign in by email»', () => <LoginEmailScreen />, ru.login.sendCode, true],
  ['«Code from the letter»', () => <LoginCodeScreen />, ru.login.confirm, true],
  ['«Agreement»', () => <ConsentScreen />, ru.consent.accept, false],
  ['«Pick a username»', () => <SetUsernameScreen />, ru.username.continue, true],
];
const WITH_BACK = [ru.login.sendCode, ru.login.confirm];

async function open(screen: () => ReactElement, over: Partial<typeof phone>) {
  Object.assign(phone, { width: 360, height: 640, fontScale: 1, top: 24 }, over);
  life.started = 0;
  life.alive = 0;
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(screen()));
  });
  const root = tree.root;
  return {
    root,
    tree,
    main: (label: string) => root.findAllByType(Button).filter((one) => one.props.label === label),
    scroll: () => root.findByType(ScrollView),
  };
}

test.each(SCREENS)(
  '%s on 360 × 640 keeps its field and its button at the bottom, out of the scroll, and the keyboard changes nothing',
  async (_, screen, label, field) => {
    const it = await open(screen, {});
    const [layer] = it.main(label);
    // As drawn, before the phone has said anything.
    expect(scrolled(layer)).toBe(false);
    // The layer is the ActionBar's: the bottom layer of the spec, not a button left in the body.
    expect(it.root.findAllByType(ActionBar)).toHaveLength(1);
    expect(it.root.findByType(ActionBar).findAllByType(Button).includes(layer)).toBe(true);

    // A layer of 300 on a 640 screen leaves the body more than a line: it stands.
    await measure(it.root, { footer: 300 });
    expect(scrolled(it.main(label)[0])).toBe(false);
    expect(it.main(label)).toHaveLength(1);
    const started = life.started;

    // The keyboard comes up: the room the body has shrinks and everything laid out again says so — the
    // bottom layer keeps its height, and the field in it is the one it was.
    const heard = blocks(it.root);
    for (const node of it.root.findAll((one) => typeof one.props.onLayout === 'function'))
      if (!heard.includes(node))
        await act(async () =>
          node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 40 } } }),
        );
    expect(life.started).toBe(started);
    expect(life.alive).toBe(field ? 1 : 0);
    expect(scrolled(it.main(label)[0])).toBe(false);
  },
);

test.each(SCREENS)(
  '%s on 320 × 568 at the largest type scrolls whole, and its field and button are still there once and pressable',
  async (_, screen, label, field) => {
    const it = await open(screen, { width: 320, height: 568, fontScale: 3.571, top: 20 });
    // At ×3.571 the layer alone is taller than the window less its status line.
    await measure(it.root, { footer: 700 });
    const [button] = it.main(label);
    expect(button).toBeDefined();
    expect(scrolled(button)).toBe(true);
    expect(it.main(label)).toHaveLength(1);
    // One field, not the one that stood at the bottom and another in the scroll.
    expect(it.root.findAllByType('input-stub' as never)).toHaveLength(field ? 1 : 0);
    expect(life.alive).toBe(field ? 1 : 0);
    // Nothing is left outside the scroll to be past the edge: only the board itself round it.
    expect(blocks(it.root)).toEqual([]);
    expect(it.root.findAllByType(ScrollView)).toHaveLength(1);
    // The same press as ever reaches the button.
    expect(typeof button.props.onPress).toBe('function');
  },
);

test.each(SCREENS.filter(([, , label]) => WITH_BACK.includes(label)))(
  '%s: «Назад» stands just under the status line, in the body',
  async (_, screen) => {
    for (const top of [24, 47]) {
      const it = await open(screen, { top });
      // The board keeps clear of the status line, whatever the phone says its height is …
      expect(
        StyleSheet.flatten(it.root.findByType(KeyboardAvoidingView).props.style),
      ).toMatchObject({
        paddingTop: top,
      });
      // … and «Назад» is the first thing in what stands under it: pinned to the body's own top, not to
      // the window's, and 10 off the edge — where the layout floats it on both screens (the measured
      // `LoginEmail` and `LoginCode`, «Назад» at x 10 right under the status line, TASK-378).
      const back = it.root
        .findAllByType(IconButton)
        .find((one) => one.props.label === ru.action.back) as ReactTestInstance;
      expect(scrolled(back)).toBe(true);
      let holder = back.parent as ReactTestInstance;
      while (StyleSheet.flatten(holder.props.style)?.position !== 'absolute')
        holder = holder.parent as ReactTestInstance;
      expect(StyleSheet.flatten(holder.props.style) as ViewStyle).toMatchObject({
        position: 'absolute',
        left: 10,
        top: 0,
      });
    }
  },
);
