import { afterEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useLocalSearchParams: () => ({ id: 'm1' }),
  };
});
// The feed is `frames-feed-flow.test.tsx`'s. Here it is only what the route hands it.
vi.mock('@/screens/memory/frames', () => ({ Frames: () => null }));

import { memory, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { TriangleAlert, WifiOff } from 'lucide-react-native';
import TestRenderer, { act } from 'react-test-renderer';
import MemoryScreen from '@/app/memory/[id]';
import type { Failure } from '@/lib/failure';
import { Frames } from '@/screens/memory/frames';
import { ru } from '@/strings';

/**
 * The route of one memory (spec 8): it reads the memory once, above everything, and hands the feed
 * that and the way to read it again — so nothing about the name and the days blinks while the frames
 * under it move. Whatever else is asked of the api is the feed's own.
 */

mountsTrees();
afterEach(() => vi.unstubAllGlobals());

async function open(answer: () => unknown) {
  const log = serve((asked) => (asked.path === '/memories' ? answer() : undefined));
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<MemoryScreen />));
  });
  const head = () =>
    tree.root.findByType(Frames).props.head as {
      memory: { id: string } | null;
      error: Failure | null;
      reload: () => void;
    };
  return { log, head, id: () => tree.root.findByType(Frames).props.id };
}

test('the feed is handed its own memory out of the listing, found by the id in the route', async () => {
  const route = await open(() => [memory({ id: 'other' }), memory({ id: 'm1', title: 'Свадьба' })]);
  expect(route.id()).toBe('m1');
  expect(route.head().memory).toMatchObject({ id: 'm1', title: 'Свадьба' });
  expect(route.head().error).toBeNull();
  // One read of the listing for the whole screen.
  expect(route.log.filter((one) => one.path === '/memories')).toHaveLength(1);
});

test('a memory that is not on the list is nothing to hand over, and no failure either', async () => {
  const route = await open(() => [memory({ id: 'other' })]);
  expect(route.head().memory).toBeNull();
  expect(route.head().error).toBeNull();
});

test('a listing that would not come is the reason handed over, and reading it again clears it', async () => {
  let up = false;
  const route = await open(() => (up ? [memory({ id: 'm1' })] : 'offline'));
  expect(route.head().memory).toBeNull();
  expect(route.head().error).toEqual({ text: ru.error.offline });
  up = true;
  await act(async () => route.head().reload());
  expect(route.head().error).toBeNull();
  expect(route.head().memory).toMatchObject({ id: 'm1' });
});

/**
 * Only a request that never got an answer wears «no signal» (TASK-275): anything the api answered
 * is about something else, and the banner's sign has to say what. The words are the api's own here
 * — this task moves the sign, not the wording (TASK-273).
 */
test('a refused listing is the api’s words beside a warning, not «no signal»', async () => {
  const route = await open(() => new Response(JSON.stringify({ error: 'nope' }), { status: 409 }));
  expect(route.head().memory).toBeNull();
  expect(route.head().error).toEqual({ text: 'nope', icon: TriangleAlert });
});

test('a listing refused over rights wears the lock', async () => {
  const route = await open(
    () => new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }),
  );
  expect(route.head().error?.icon).not.toBe(WifiOff);
});
