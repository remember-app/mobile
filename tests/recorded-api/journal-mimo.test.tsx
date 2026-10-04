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

import { act, drives, settle } from '@tests/helpers/drive';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { AppState } from 'react-native';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import type { JournalEntry } from '@/api';
import JournalStageScreen from '@/app/memory/[id]/montage/[montageId]/stage/[stage]';
import { BadgeDecision, Button } from '@/kit';
import { type Language, setLanguage } from '@/lib/language';
import { strings } from '@/strings';

import { bodyOf, load, MEMORY, MONTAGE, replay } from './recorded';

/**
 * «Мимо» on the frame that was passed over names why — the worker's own words, and the grey pill
 * beside the decision. Every code of the worker's vocabulary (api `docs/journal.md`, «Журнал
 * монтажа») is read off a recorded frame that was really passed over, with its reason swapped — the
 * recording itself holds only a few of them — and the codes the app has no word for are the spare
 * word rather than the raw code on the screen.
 *
 * The screen is the journal of the directing stage: the block «Не взял» folded away, its frames
 * standing under it once it is opened.
 */

mountsTrees();

const LANGUAGES: Language[] = ['ru', 'en'];
/**
 * Every code the app keeps a word for on a frame passed over, each with the word it must be said in
 * — the words written out, not read back out of the dictionary. Asking the dictionary what it says
 * about itself passes whatever the answer is, and the screen then says that same wrong word beside
 * it; a pinned word is what makes this test fail instead of agree.
 */
const CODES: [string, string, string][] = [
  ['unreadable', 'Не открылся', 'Would not open'],
  ['duplicate', 'Дубль', 'A double'],
  ['left_out', 'Не в истории', 'Not in the story'],
];

const READY = 'journal_of_ready_montage';
/** Seconds after the recording's own clock, so no stage has run «for minutes». */
const NOW = Date.parse('2026-01-01T00:00:20Z');

beforeEach(() => {
  // react-native-web has no app state to subscribe to off a phone and hands back no subscription.
  vi.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: () => {} });
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
  });
  vi.setSystemTime(NOW);
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await setLanguage('ru');
});
drives();

/** The pills the frames of the block wear, kind and words. */
const pillsOf = (node: ReactTestInstance) =>
  node.findAllByType(BadgeDecision).map((one) => [one.props.kind, one.props.label]);

describe.each(LANGUAGES)('every reason the worker writes, on the frame (%s)', (lang) => {
  const whole = bodyOf(load('director'), READY);
  const passed = whole.entries.find((one) => one.decision === 'skip' && one.media_id !== null)!;

  /**
   * NOT WORDS OF THE API — the recorded record with its reason swapped, put back into the recorded
   * journal so the screen reads the whole film and not just this one record.
   */
  function journalWith(reason: string | null) {
    const entry: JournalEntry = { ...passed, reason };
    const steps = load('director').map((one) =>
      one.name === READY
        ? {
            ...one,
            response: {
              ...one.response,
              body: {
                ...whole,
                entries: whole.entries.map((one) => (one.id === entry.id ? entry : one)),
              },
            },
          }
        : one,
    );
    return replay(steps, { cutFrom: READY });
  }

  /** The journal of the directing stage with the block «Не взял» opened, over the frame in question. */
  async function screen(reason: string | null) {
    await setLanguage(lang);
    route.params = { id: MEMORY, montageId: MONTAGE, stage: 'directing' };
    vi.stubGlobal('fetch', journalWith(reason).fetch);
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = mounted(TestRenderer.create(<JournalStageScreen />));
    });
    await settle();
    const ask = tree.root.findAllByType(Button).at(-1)!;
    await act(async () => ask.props.onPress());
    await settle();
    return tree.root;
  }

  const { live } = strings[lang].montage;

  // The word this test expects is the pinned one, never `live.reason[code]`: a screen drawn from a
  // wrong word and a test expecting that same wrong word are two halves of one mistake.
  test.each(CODES)('«%s» is named in its own word under «Мимо»', async (code, russian, english) => {
    expect(pillsOf(await screen(code))).toContainEqual(['pass', lang === 'ru' ? russian : english]);
  });

  test.each(['shaky_pan', 'constructor', '__proto__'])(
    'a code the app has no word for («%s») is the spare word',
    async (code) => {
      expect(pillsOf(await screen(code))).toContainEqual(['pass', live.reason.other]);
    },
  );

  test('no reason at all is «Мимо» alone', async () => {
    expect(pillsOf(await screen(null))).toContainEqual(['pass', live.skip]);
  });
});
