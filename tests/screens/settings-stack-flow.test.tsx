import { afterEach, expect, test, vi } from 'vitest';

const { nav } = vi.hoisted(() => ({ nav: { router: null as unknown } }));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useLocalSearchParams: () => ({ id: 'm1' }),
    useRouter: () => nav.router,
  };
});
// A text input listens on the browser's `document`, which a test renderer has none of.
vi.mock('@/kit', async (original) => ({
  ...(await original<typeof import('@/kit')>()),
  Field: () => null,
}));

import { member, memory, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import {
  type CommonActions,
  type ParamListBase,
  type StackActionType,
  type StackNavigationState,
  StackRouter,
} from 'expo-router/build/react-navigation/routers';
import TestRenderer, { act } from 'react-test-renderer';
import MemorySettingsScreen from '@/app/memory/[id]/settings';
import { ConfirmSheet, IconButton } from '@/kit';
import { ru } from '@/strings';

/**
 * Where «Удалить навсегда» leaves the root stack (TASK-336). The stack is flat — the main screen,
 * the memory, its settings — and a `replace('/')` swaps only the top one: the memory that was just
 * deleted stayed one back gesture under the main screen, and answered 404 there.
 *
 * A spy that records `replace('/')` cannot see that, so the stack here is a real one: expo-router's
 * own `StackRouter`, fed the very actions expo-router's imperative router queues for each call
 * (`global-state/router.js`), and run after the press the way expo-router runs its queue — in an
 * effect, after the handler has returned. `canGoBack` answers from the stack as it stands when it
 * is asked, before anything queued has run, as the real one does.
 */

mountsTrees();
afterEach(() => vi.unstubAllGlobals());

const OPTIONS = {
  routeNames: ['index', 'memory/[id]', 'memory/[id]/settings'],
  routeParamList: {},
  routeGetIdList: {},
};

type Href = string | { pathname: string; params?: object };
type Action = StackActionType | CommonActions.Action;

function rootStack(names: string[]) {
  const router = StackRouter({});
  let state = router.getRehydratedState(
    { stale: true, routes: names.map((name) => ({ name, params: { id: 'm1' } })) },
    OPTIONS,
  );
  const run = (action: Action) =>
    router.getStateForAction(state, action, OPTIONS) as StackNavigationState<ParamListBase> | null;
  const queue: Action[] = [];
  // The route an href names in this flat stack, the way `getNavigateAction` finds it.
  const to = (href: Href) => {
    const path = typeof href === 'string' ? href : href.pathname;
    return {
      name: path === '/' ? 'index' : path.slice(1),
      params: typeof href === 'string' ? undefined : href.params,
    };
  };
  nav.router = {
    push: (href: Href) => queue.push({ type: 'PUSH', payload: to(href) }),
    navigate: (href: Href) => queue.push({ type: 'NAVIGATE', payload: to(href) }),
    replace: (href: Href) => queue.push({ type: 'REPLACE', payload: to(href) }),
    dismissTo: (href: Href) => queue.push({ type: 'POP_TO', payload: to(href) }),
    dismiss: (count = 1) => queue.push({ type: 'POP', payload: { count } }),
    dismissAll: () => queue.push({ type: 'POP_TO_TOP' }),
    back: () => queue.push({ type: 'GO_BACK' }),
    canGoBack: () => state.index > 0,
  };
  return {
    /** Runs what the screen asked for, in order. One no navigator takes is a failure, not a no-op. */
    flush() {
      for (const action of queue.splice(0)) {
        const next = run(action);
        if (next === null) throw new Error(`${action.type} was handled by no navigator`);
        state = next;
      }
    },
    names: () => state.routes.map((route) => route.name),
    /** Where the back gesture from the top leads — `null` when there is nothing under it. */
    back: () => run({ type: 'GO_BACK' })?.routes.map((route) => route.name) ?? null,
  };
}

test.each([
  ['from the main screen', ['index', 'memory/[id]', 'memory/[id]/settings']],
  // An invite accepted on a cold start: the invite screen was the first one, and it was replaced
  // by the memory — nothing is under it.
  ['from a memory with nothing under it', ['memory/[id]', 'memory/[id]/settings']],
])(
  'after «Удалить навсегда» %s the main screen is all that is left, and back leads nowhere',
  async (_, names) => {
    const stack = rootStack(names);
    serve((asked) => {
      if (asked.path === '/memories') return [memory({ media_count: 3 })];
      if (asked.path === '/memories/m1/members') return [member('me', 'organizer')];
      if (asked.method === 'DELETE' && asked.path === '/memories/m1') return { ok: true };
      return undefined;
    });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = mounted(TestRenderer.create(<MemorySettingsScreen />));
    });
    const trash = tree.root
      .findAllByType(IconButton)
      .find((one) => one.props.label === ru.settings.delete);
    await act(async () => trash?.props.onPress());
    await act(async () => tree.root.findByType(ConfirmSheet).props.onConfirm());

    stack.flush();
    expect(stack.names()).toEqual(['index']);
    expect(stack.back()).toBeNull();
  },
);
