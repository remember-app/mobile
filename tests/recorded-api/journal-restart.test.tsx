import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
/** Whether the screen is in front — flipped by a test to have the hook read again on coming back. */
const focus = vi.hoisted(() => ({ now: true }));
vi.mock('expo-router', () => ({ useFocusEffect: () => {}, useIsFocused: () => focus.now }));

import { AppState } from 'react-native';
import TestRenderer from 'react-test-renderer';

import { MONTAGE_STAGES, type JournalEntry, type MontageJournal } from '@/api';
import { useMontageJournal, WHILE_LIVE_MS } from '@/lib/montage/journal';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { act, BEAT_BY_BEAT, drives, settle } from '@tests/helpers/drive';

import {
  bodyOf,
  journalPath,
  liveSteps,
  load,
  MEMORY,
  MONTAGE,
  replay,
  step,
  TOKEN,
  type Replay,
  type Scenario,
  type Step,
} from './recorded';

/**
 * The same film begun again while its journal is open: the worker retrying its own job after a
 * passing failure, or the organizer pressing «Повторить» on another phone. The api wipes the last
 * attempt's records and its stages start over, and the new records carry larger ids — so a phone
 * that read on after its cursor would show the old attempt and the new one mixed. The hook is read
 * off a bare component, over the recorded making (`README.md` beside this file).
 *
 * NOT WORDS OF THE API — the recording has one attempt. The retry is cut out of it: the answer right
 * after the worker's `begin` (five stages back in `pending`, no records), the one after the api's
 * retry (`queued`, no stages, no records), a fallen attempt (the stage at work `failed`, its start
 * untouched), and the second attempt itself — the recorded sitting said again, its ids after the
 * first attempt's largest and its stages started an hour later.
 */

mountsTrees();

const SCENARIOS: Scenario[] = ['director', 'algorithm'];
const HOUR = 3_600_000;

beforeEach(() => {
  // react-native-web has no app state to subscribe to off a phone and hands back no subscription.
  vi.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: () => {} });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  focus.now = true;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(AppState.addEventListener).mockRestore();
});
drives();

type Held = ReturnType<typeof useMontageJournal>;

function Probe({ into }: { into: { now?: Held } }) {
  into.now = useMontageJournal(TOKEN.organizer, MEMORY, MONTAGE);
  return null;
}

/** The organizer's phone with the journal open, reading through `fetch`. */
async function watch(fetch: typeof globalThis.fetch) {
  vi.stubGlobal('fetch', fetch);
  const into: { now?: Held } = {};
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<Probe into={into} />));
  });
  await settle();
  return {
    journal: () => into.now!,
    tick: async () => {
      await act(async () => {
        vi.advanceTimersByTime(WHILE_LIVE_MS);
      });
      await settle();
    },
    /** Behind another screen and back in front — the hook reads once on the way back. */
    comeBack: async () => {
      for (const now of [false, true]) {
        focus.now = now;
        await act(async () => tree.update(<Probe into={into} />));
      }
      await settle();
    },
    /** Ticks until the film is ready, which is where the reading stops. */
    untilReady: async () => {
      for (let beat = 0; into.now!.status !== 'ready'; beat++) {
        if (beat > 40) throw new Error(`the film never got ready; last read ${into.now!.status}`);
        await act(async () => {
          vi.advanceTimersByTime(WHILE_LIVE_MS);
        });
        await settle();
      }
    },
    unmount: () => act(() => tree.unmount()),
  };
}

const idsOf = (entries: readonly JournalEntry[]) => entries.map((one) => one.id);
const desc = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => to - i);

/** A journal answer that is not in the recording, to the organizer, at `query`. */
const said = (name: string, query: Step['request']['query'], body: MontageJournal): Step => ({
  name,
  request: { as: 'organizer', method: 'GET', path: journalPath(), query },
  response: { status: 200, body },
});

describe.each(SCENARIOS)('%s — the film begun again under an open journal', (scenario) => {
  const steps = load(scenario);
  const whole = bodyOf(steps, 'journal_of_ready_montage');
  /** The first attempt's largest id: every record of the second one is past it. */
  const last = Math.max(...idsOf(whole.entries));
  const sitting = [...liveSteps(steps), step(steps, 'journal_after_ready_nothing_new')];
  const names = (list: readonly Step[]) => list.map((one) => one.name);

  /** The first attempt as far as the phone read it: up to `understanding` at work. */
  const first = sitting.slice(0, sitting.indexOf(step(steps, 'live_poll_5')));
  const reached = first.map((one) => one.response.body as MontageJournal);
  /** Where its cursor stands after that. */
  const cursor = Math.max(...reached.flatMap((one) => idsOf(one.entries)));
  const atCursor = reached.at(-1)!;

  /** Right after the worker's `begin`: five stages waiting, nothing said — the recording's own first opening. */
  const begun: MontageJournal = {
    ...atCursor,
    stages: bodyOf(steps, 'live_first_open_empty').stages,
    entries: [],
    has_more: false,
    files: [],
  };

  /** NOT WORDS OF THE API — after «Повторить»: back in the queue, no stages and no records. */
  const queued: MontageJournal = {
    ...begun,
    montage: { ...begun.montage, status: 'queued' },
    stages: [],
  };

  /**
   * NOT WORDS OF THE API — the first attempt fallen over where the phone left it: the stage at work
   * `failed`, its start as it was. `entries` is the whole of what that attempt said, for a phone
   * that opens it cold, or nothing new for one that reads after its cursor.
   */
  const fallen = (entries: 'all' | 'none'): MontageJournal => ({
    ...atCursor,
    montage: { ...atCursor.montage, status: 'failed' },
    stages: atCursor.stages.map((row) => (row.state === 'running' ? { ...row, state: 'failed' as const } : row)),
    entries: entries === 'all' ? reached.flatMap((one) => one.entries).sort((a, b) => b.id - a.id) : [],
    has_more: false,
    files: entries === 'all' ? reached.flatMap((one) => one.files) : [],
  });

  const later = (at: string | null) => (at === null ? null : new Date(Date.parse(at) + HOUR).toISOString());

  /** NOT WORDS OF THE API — a recorded answer said again by the second attempt. */
  const again = (recorded: Step): Step => {
    const body = recorded.response.body as MontageJournal;
    const after = Number(recorded.request.query.after ?? 0);
    return said(
      `again_${recorded.name}`,
      after > 0 ? { ...recorded.request.query, after: after + last } : recorded.request.query,
      {
        ...body,
        stages: body.stages.map((row) => ({
          ...row,
          started_at: later(row.started_at),
          finished_at: later(row.finished_at),
          updated_at: later(row.updated_at)!,
        })),
        entries: body.entries.map((one) => ({ ...one, id: one.id + last })),
      },
    );
  };
  /** The second attempt from its first record to ready, as the phone polls it. */
  const secondAttempt = sitting.slice(1).map(again);
  const secondIds = desc(last + 1, 2 * last);

  /** The phone reads the first attempt up to its cursor, with every record it said. */
  async function readFirstAttempt(phone: Awaited<ReturnType<typeof watch>>) {
    for (let beat = 0; phone.journal().cursor !== cursor && beat < first.length; beat++) await phone.tick();
    expect(idsOf(phone.journal().entries)).toEqual(desc(1, cursor));
  }

  test('the worker retrying its job: the stages go back to waiting, and the old records go with them', BEAT_BY_BEAT, async () => {
    const api = replay([
      ...first,
      said('begun_after_cursor', { after: cursor }, begun),
      said('begun_from_the_start', {}, begun),
      ...secondAttempt,
    ]);
    const phone = await watch(api.fetch);
    await readFirstAttempt(phone);

    await phone.tick();
    // Read again from its start, and nothing of the attempt that is gone.
    expect(phone.journal()).toMatchObject({ status: 'processing', entries: [], cursor: null, oldest: null, settled: null });
    expect(phone.journal().stages.map((one) => one.state)).toEqual(MONTAGE_STAGES.map(() => 'pending'));
    expect(phone.journal().standing).toBe('live');

    await phone.untilReady();
    expect(idsOf(phone.journal().entries)).toEqual(secondIds);
    // Once from the start and never again: the second attempt going on is not a third one.
    expect(api.served).toEqual([
      ...names(first),
      'begun_after_cursor',
      'begun_from_the_start',
      ...names(secondAttempt),
    ]);
    expect(api.unmatched).toEqual([]);
    await phone.unmount();
  });

  test('the moment of waiting missed: the new attempt already under way is seen by its new start', BEAT_BY_BEAT, async () => {
    // The phone was in a pocket while the worker began again, and the first answer it gets after its
    // cursor is the new attempt's first records — ids past the cursor, stages started anew.
    const seen = again(sitting[1]);
    const api = replay([
      ...first,
      { ...seen, name: 'again_after_old_cursor', request: { ...seen.request, query: { after: cursor } } },
      ...secondAttempt,
    ]);
    const phone = await watch(api.fetch);
    await readFirstAttempt(phone);

    await phone.untilReady();
    expect(idsOf(phone.journal().entries)).toEqual(secondIds);
    expect(api.served).toEqual([...names(first), 'again_after_old_cursor', ...names(secondAttempt)]);
    expect(api.unmatched).toEqual([]);
    await phone.unmount();
  });

  test('«Повторить» pressed on another phone: the fallen journal gives way to the new attempt when the screen is back', BEAT_BY_BEAT, async () => {
    const api = replay([
      said('fallen', {}, fallen('all')),
      said('retried_after_cursor', { after: cursor }, queued),
      said('retried_from_the_start', {}, queued),
      ...secondAttempt,
    ]);
    const phone = await watch(api.fetch);
    expect(phone.journal().standing).toBe('failed');
    expect(idsOf(phone.journal().entries)).toEqual(desc(1, cursor));

    await phone.comeBack();
    expect(phone.journal()).toMatchObject({ status: 'queued', stages: [], entries: [], cursor: null, standing: 'live' });

    await phone.untilReady();
    expect(idsOf(phone.journal().entries)).toEqual(secondIds);
    expect(api.served).toEqual(['fallen', 'retried_after_cursor', 'retried_from_the_start', ...names(secondAttempt)]);
    expect(api.unmatched).toEqual([]);
    await phone.unmount();
  });

  describe('and nothing is read over again when it is not', () => {
    test('a making that goes on to ready: every stage waiting, at work, done — one reading, every record', BEAT_BY_BEAT, async () => {
      const api = replay(sitting);
      const phone = await watch(api.fetch);
      await phone.untilReady();
      expect(idsOf(phone.journal().entries)).toEqual(desc(1, last));
      expect(api.served).toEqual(names(sitting));
      expect(api.unmatched).toEqual([]);
      await phone.unmount();
    });

    test('a making that falls over keeps what it said, and stops', BEAT_BY_BEAT, async () => {
      const api = replay([...first, said('fell_over', { after: cursor }, fallen('none'))]);
      const phone = await watch(api.fetch);
      await readFirstAttempt(phone);

      for (let beat = 0; beat < 3; beat++) await phone.tick();
      expect(phone.journal().standing).toBe('failed');
      expect(idsOf(phone.journal().entries)).toEqual(desc(1, cursor));
      expect(api.served).toEqual([...names(first), 'fell_over']);
      await phone.unmount();
    });

    test('a late answer to a read sent before this phone’s own «Повторить» resets nothing', BEAT_BY_BEAT, async () => {
      const api = replay([
        said('fallen', {}, fallen('all')),
        said('late_after_cursor', { after: cursor }, queued),
        said('retried_from_the_start', {}, queued),
        ...secondAttempt,
      ]);
      // Every request waits at the gate while it is shut; the answer is the api's at the moment it opens.
      let gate: Promise<void> | undefined;
      let open!: () => void;
      const phone = await watch((async (...args: Parameters<typeof fetch>) => {
        await gate;
        return api.fetch(...args);
      }) as typeof fetch);

      gate = new Promise<void>((done) => {
        open = () => done();
      });
      await phone.comeBack();
      // Out, and in the air, when the organizer's own retry lands and throws the journal away.
      await act(async () => phone.journal().restart());
      gate = undefined;
      open();
      await settle();
      expect(api.served).toEqual(['fallen', 'late_after_cursor']);
      expect(phone.journal()).toMatchObject({ status: null, entries: [], standing: 'opening' });

      await phone.untilReady();
      expect(idsOf(phone.journal().entries)).toEqual(secondIds);
      expect(api.served).toEqual(['fallen', 'late_after_cursor', 'retried_from_the_start', ...names(secondAttempt)]);
      expect(api.unmatched).toEqual([]);
      await phone.unmount();
    });
  });
});
