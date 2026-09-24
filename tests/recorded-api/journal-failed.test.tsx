import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: session.token, user: { id: 'me' } }) }));
const { session, route, router } = vi.hoisted(() => ({
  session: { token: '' },
  route: { params: {} as Record<string, string> },
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: () => true,
    setParams: vi.fn(),
  },
}));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useLocalSearchParams: () => route.params,
    useRouter: () => router,
  };
});
// The strip carries the one player of the product, a window over the feed these tests do not open.
vi.mock('@/lib/orientation', () => ({ lockPortrait: () => {}, useTurnsWithPhone: () => {} }));
vi.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));
vi.mock('@/lib/downloads', () => ({
  maySaveToPhone: () => false,
  saveToPhone: async () => {},
  saveAndShare: async () => {},
  shareFile: async () => {},
}));

import { act, BEAT_BY_BEAT, drives, settle } from '@tests/helpers/drive';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { AppState } from 'react-native';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import MontageLiveScreen from '@/app/memory/[id]/montage/[montageId]/index';
import { CardMontage, CardNow, LiveDot, RowStep, StepNote, Text } from '@/kit';
import { Films } from '@/screens/memory/films';
import { ru } from '@/strings';

import {
  BROKE,
  bodyOf,
  fellOver,
  load,
  MEMORY,
  MONTAGE,
  type Replay,
  type Role,
  replay,
  type Scenario,
  TOKEN,
} from './recorded';

/**
 * A montage that fell over, opened the way anybody opens it — cold, from its card, days after it
 * broke. The screens, the client and the hook are the app's own over the recorded answers, and the
 * montage that fell is cut out of them (`fellOver` in `recorded.ts` — NOT WORDS OF THE API: the
 * recording has none). What is checked is that nothing on the way reads as a making still on air, and
 * that the card says why it broke in the worker's own sentence.
 */

mountsTrees();

const SCENARIOS: Scenario[] = ['director', 'algorithm'];
/** Not part of the recording: the memory and its people, which the journal names by id. */
const extra = (role: Role) => ({
  '/memories': [{ id: MEMORY, title: 'День рождения', role, recent_thumbnail_urls: [] }],
  [`/memories/${MEMORY}/members`]: [],
});

beforeEach(() => {
  // react-native-web has no app state to subscribe to off a phone and hands back no subscription.
  vi.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: () => {} });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
drives();

async function mount(element: React.ReactElement, api: Replay, as: Role) {
  session.token = TOKEN[as];
  vi.stubGlobal('fetch', api.fetch);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(element));
  });
  await settle();
  return tree.root;
}

/** Every string the tree draws, in order. */
function words(root: ReactTestInstance): string {
  const out: string[] = [];
  const walk = (node: ReactTestInstance | string) => {
    if (typeof node === 'string') out.push(node);
    else node.children.forEach(walk);
  };
  walk(root);
  return out.join('\n');
}

describe.each(SCENARIOS)('%s — a montage that fell over', (scenario) => {
  const steps = load(scenario);

  test.each(['organizer', 'viewer'] as const)(
    'its screen is not on air, for the %s: no «Сейчас», no live dot, nobody thinking',
    BEAT_BY_BEAT,
    async (role) => {
      route.params = { id: MEMORY, montageId: MONTAGE };
      const api = replay(fellOver(steps, role), { extra: extra(role) });
      const screen = await mount(<MontageLiveScreen />, api, role);
      const text = words(screen);

      expect(screen.findAllByType(CardNow)).toEqual([]);
      expect(screen.findAllByType(LiveDot)).toEqual([]);
      for (const live of [ru.montage.live.now, ru.montage.live.thinking, ru.montage.live.decided]) {
        expect(text).not.toContain(live);
      }

      // The journal is still read: the stage that broke wears the cross and is opened out on its last
      // records, each with the frame it was about — where it broke, told calmly.
      const rows = screen.findAllByType(RowStep);
      expect(rows.map((one) => one.props.state)).toEqual([
        'done',
        'failed',
        'waiting',
        'waiting',
        'waiting',
      ]);
      expect(rows.filter((one) => one.props.open)).toEqual([rows[1]]);
      const whole = bodyOf(steps, 'journal_of_ready_montage');
      const last = whole.entries.filter((one) => one.stage === 'understanding').slice(0, 2);
      const shot = (id: string | null) =>
        whole.files.find((one) => one.id === id)?.thumbnail_url ?? undefined;
      expect(rows[1].findAllByType(StepNote).map((one) => one.props.uri)).toEqual(
        last.map((one) => shot(one.media_id)),
      );
      expect(text).toContain(BROKE);
      expect(api.unmatched).toEqual([]);
    },
  );

  /** The fallen card in the strip — the second of three, between the queued one and the old one. */
  async function fallenCard(why: string | null) {
    route.params = { id: MEMORY };
    const api = replay(fellOver(steps, 'organizer', why), { extra: extra('organizer') });
    const strip = await mount(
      <Films id={MEMORY} memory={{ id: MEMORY, role: 'organizer' } as never} />,
      api,
      'organizer',
    );
    expect(api.unmatched).toEqual([]);
    const card = strip.findAllByType(CardMontage)[1];
    expect(card.props.state).toBe('failed');
    return card;
  }

  test('its card says why it broke in the worker’s own sentence, and paints the stage it broke on', async () => {
    const card = await fallenCard(BROKE);
    expect(card.props.caption).toBe(BROKE);
    expect(card.props.step).toEqual({
      at: 2,
      of: 5,
      count: ru.montage.live.doneOf(2, 5),
      failed: true,
    });
  });

  test.each([null, ''])(
    'where the worker said nothing (%j), its card says the general line',
    async (why) => {
      expect((await fallenCard(why)).props.caption).toBe(ru.montage.broke);
    },
  );

  test('a reason too long for the card is cut to one line on it, and read out whole', async () => {
    const why = 'материал не годится для ролика: файлы не читаются, кадры испорчены или исключены';
    const card = await fallenCard(why);
    expect(card.props.caption).toBe(why);
    const line = card.find((node) => node.type === Text && node.props.children === why);
    expect(line.props.numberOfLines).toBe(1);
    expect(
      card.findAll((node) => node.props.accessibilityLabel?.includes(why) === true).length,
    ).toBeGreaterThan(0);
  });
});
