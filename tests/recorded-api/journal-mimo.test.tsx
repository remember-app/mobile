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
    useRouter: () => ({ push() {}, replace() {}, back() {}, canGoBack: () => true, setParams() {} }),
  };
});

import { AppState } from 'react-native';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';

import type { JournalEntry, MontageStageCode } from '@/api';
import MontageLiveStageScreen from '@/app/memory/[id]/montage/[montageId]/stage/[stage]';
import { BadgeDecision, Chip, LogEntry } from '@/kit';
import { setLanguage, type Language } from '@/lib/language';
import { SheetLiveFile } from '@/screens/memory/live-file';
import { strings } from '@/strings';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { act, BEAT_BY_BEAT, drives, settle } from '@tests/helpers/drive';

import { bodyOf, load, MEMORY, MONTAGE, PEOPLE, replay, type Scenario } from './recorded';

/**
 * «Мимо» on the card of a file names why the frame was passed over — the same words and the same
 * grey pill the journal of the stage wears beside it, a line under the decision. Read off the real
 * screen on the recorded answers for every frame the worker passed over, in both languages; and then
 * for every code of the worker's vocabulary (montage README, «Журнал монтажа») on a recorded record
 * whose reason is swapped — the recording itself holds no `duplicate`.
 */

mountsTrees();

const SCENARIOS: Scenario[] = ['director', 'algorithm'];
const LANGUAGES: Language[] = ['ru', 'en'];
/** Every reason the worker writes on a frame it passes over. */
const CODES = ['unreadable', 'blur', 'exposure', 'duplicate', 'excluded', 'no_room', 'left_out'] as const;
const STAGES: MontageStageCode[] = ['screening', 'directing'];
/** Not part of the recording: the people the journal names by id. */
const extra = {
  [`/memories/${MEMORY}/members`]: [
    { id: PEOPLE.organizer, name: 'Аня Петрова', username: 'anya', role: 'organizer', contribution_status: 'done', media_count: 7 },
    { id: PEOPLE.contributor, name: 'Марк', username: 'marko', role: 'contributor', contribution_status: 'done', media_count: 6 },
  ],
};

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

const press = async (instance: ReactTestInstance) => {
  await act(async () => instance.props.onPress());
  await settle();
};

/** The pills a card or a journal record wears, kind and words. */
const pillsOf = (node: ReactTestInstance) =>
  node.findAllByType(BadgeDecision).map((one) => [one.props.kind, one.props.label]);

describe.each(SCENARIOS)('%s — on the recorded answers', (scenario) => {
  const steps = load(scenario);
  const whole = bodyOf(steps, 'journal_of_ready_montage');

  test.each(LANGUAGES)('every frame passed over says why on its card, as the journal says it (%s)', BEAT_BY_BEAT, async (lang) => {
    await setLanguage(lang);
    const { live } = strings[lang].montage;
    let seen = 0;

    for (const stage of STAGES) {
      const passed = whole.entries.filter((one) => one.stage === stage && one.decision === 'skip');
      const api = replay(steps, { only: ['journal_of_ready_montage'], cutFrom: 'journal_of_ready_montage', extra });
      vi.stubGlobal('fetch', api.fetch);
      route.params = { id: MEMORY, montageId: MONTAGE, stage };
      let tree!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = mounted(TestRenderer.create(<MontageLiveStageScreen />));
      });
      await settle();
      await press(tree.root.findAllByType(Chip).find((one) => one.props.label === live.skip)!);

      const logs = tree.root.findAllByType(LogEntry);
      expect(logs).toHaveLength(passed.length);
      for (const [at, record] of passed.entries()) {
        const word = live.reason[record.reason as keyof typeof live.reason];
        expect(word, `${record.reason} has a word of its own`).toBeDefined();
        expect(word).not.toBe(live.reason.other);
        // The journal's own pills for this record…
        expect(pillsOf(logs[at])).toEqual([['pass', live.skip], ['pass', word]]);

        // …and the card it opens wears the same two.
        await press(logs[at]);
        const sheet = tree.root.findByType(SheetLiveFile);
        expect(sheet.props.entry.id).toBe(record.id);
        expect(pillsOf(sheet)).toEqual(pillsOf(logs[at]));
        await act(async () => sheet.props.onCancel());
        seen++;
      }
      expect(api.unmatched).toEqual([]);
      await act(() => tree.unmount());
    }
    expect(seen, 'the recording has frames passed over').toBeGreaterThan(0);
  });
});

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
        TestRenderer.create(<SheetLiveFile entry={entry} file={file} author="Аня Петрова" onCancel={() => {}} />),
      );
    });
    return pillsOf(tree.root);
  }

  const { live } = strings[lang].montage;

  test.each(CODES)('«%s» is named in its own word under «Мимо»', async (code) => {
    expect(await card(code)).toEqual([['pass', live.skip], ['pass', live.reason[code]]]);
    expect(live.reason[code]).not.toBe(live.reason.other);
  });

  test.each(['shaky_pan', 'constructor', '__proto__'])('a code the app has no word for («%s») is the spare word', async (code) => {
    expect(await card(code)).toEqual([['pass', live.skip], ['pass', live.reason.other]]);
  });

  test('no reason at all is «Мимо» alone', async () => {
    expect(await card(null)).toEqual([['pass', live.skip]]);
  });
});
