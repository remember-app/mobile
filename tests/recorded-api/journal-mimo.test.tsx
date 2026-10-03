import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', async () => {
  const { TOKEN } = await import('./recorded');
  return { useAuth: () => ({ token: TOKEN.organizer, user: { id: 'me' } }) };
});
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useIsFocused: () => true,
    useLocalSearchParams: () => route.params,
    useRouter: () => ({
      push() {},
      replace() {},
      back() {},
      canGoBack: () => true,
      setParams() {},
    }),
  };
});

import { act, drives } from '@tests/helpers/drive';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { AppState } from 'react-native';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import type { JournalEntry } from '@/api';
import { BadgeDecision } from '@/kit';
import { type Language, setLanguage } from '@/lib/language';
import { SheetLiveFile } from '@/screens/memory/live-file';
import { strings } from '@/strings';

import { bodyOf, load } from './recorded';

/**
 * «Мимо» on the card of a file names why the frame was passed over — the worker's own words, and
 * the grey pill beside the decision. Every code of the worker's vocabulary (api `docs/journal.md`,
 * «Журнал монтажа») is read off the card of a recorded frame that was really passed over, with its
 * reason swapped — the recording itself holds only a few of them — and the codes the app has no
 * word for are the spare word rather than the raw code on the screen.
 */

mountsTrees();

const LANGUAGES: Language[] = ['ru', 'en'];
/** Every reason the worker writes on a frame it passes over. */
const CODES = [
  'unreadable',
  'blur',
  'exposure',
  'duplicate',
  'excluded',
  'no_room',
  'left_out',
] as const;

beforeEach(() => {
  // react-native-web has no app state to subscribe to off a phone and hands back no subscription.
  vi.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: () => {} });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await setLanguage('ru');
});
drives();

/** The pills a card wears, kind and words. */
const pillsOf = (node: ReactTestInstance) =>
  node.findAllByType(BadgeDecision).map((one) => [one.props.kind, one.props.label]);

describe.each(LANGUAGES)('every reason the worker writes, on the card (%s)', (lang) => {
  const whole = bodyOf(load('director'), 'journal_of_ready_montage');
  const passed = whole.entries.find((one) => one.decision === 'skip' && one.media_id !== null)!;
  const file = whole.files.find((one) => one.id === passed.media_id);

  /** NOT WORDS OF THE API — the recorded record with its reason swapped. */
  async function card(reason: string | null) {
    await setLanguage(lang);
    const entry: JournalEntry = { ...passed, reason };
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = mounted(
        TestRenderer.create(
          <SheetLiveFile
            entry={entry}
            file={file}
            nth={0}
            author="Аня Петрова"
            onCancel={() => {}}
          />,
        ),
      );
    });
    return pillsOf(tree.root);
  }

  const { live } = strings[lang].montage;

  test.each(CODES)('«%s» is named in its own word under «Мимо»', async (code) => {
    expect(await card(code)).toEqual([
      ['pass', live.skip],
      ['pass', live.reason[code]],
    ]);
    expect(live.reason[code]).not.toBe(live.reason.other);
  });

  test.each(['shaky_pan', 'constructor', '__proto__'])(
    'a code the app has no word for («%s») is the spare word',
    async (code) => {
      expect(await card(code)).toEqual([
        ['pass', live.skip],
        ['pass', live.reason.other],
      ]);
    },
  );

  test('no reason at all is «Мимо» alone', async () => {
    expect(await card(null)).toEqual([['pass', live.skip]]);
  });
});
