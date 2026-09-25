import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { ApiError, fetchJournal } from '@/api';
import { useReducedMotion } from '@/kit';
import { beingMade } from '@/lib/montage/order';
import {
  type Ask,
  type Journal,
  type Narrow,
  NO_JOURNAL,
  pull,
  pullOlder,
  relaid,
  type Standing,
  startedOver,
  WHILE_LIVE_MS,
} from './reading';

/**
 * Reading the journal while it is still being written: the poll that runs while the app is in front
 * of somebody, and the sentence that types itself out as the director says it.
 */
/* ── Reading it live ──────────────────────────────────────────────────── */

const watchApp = (listener: () => void) => {
  const subscription = AppState.addEventListener('change', listener);
  return () => subscription.remove();
};

const appActive = () => AppState.currentState === 'active';

/** Whether the app is the thing on the phone's screen at all. Polling stops when it is not. */
function useAppActive(): boolean {
  return useSyncExternalStore(watchApp, appActive, appActive);
}

/**
 * The journal of one video, read and kept up to date — what both screens of the live montage stand
 * on. It polls while the video is being made and stops the moment it is ready or has fallen over:
 * nothing more is coming, and what was read stays where it is. It also stops while the screen is
 * behind another one or the app is in somebody's pocket, and reads once the moment either comes
 * back — a phone that spent a minute asleep catches up in one poll, whatever landed meanwhile.
 *
 * A read that never comes back changes one word and nothing else (`offline`): the journal on screen
 * is the truth as of the last answer, and throwing it away because the lift has no signal would be
 * the one thing a person watching would never forgive. The next poll that succeeds takes the word
 * off again. A 404 is not that (`refused`): the api is saying this reader is not in the memory, and
 * polling stops until the screen comes back in front — on either road the journal is read by, the
 * poll and the page further back.
 */
export function useMontageJournal(
  token: string | null,
  memoryId: string,
  montageId: string,
  { stage }: Narrow = {},
): Journal & { standing: Standing; loadOlder: () => void; restart: () => void } {
  const [state, setState] = useState<Journal>(NO_JOURNAL);
  /** The same thing a poll reads and folds into — state itself is a render behind. */
  const held = useRef<Journal>(NO_JOURNAL);
  /** One read at a time: a poll may chase several pages, and two of them would race the cursor. */
  const reading = useRef(false);
  const focused = useIsFocused();
  const active = useAppActive();

  const ask = useCallback<Ask>(
    (query) => fetchJournal(token ?? '', memoryId, montageId, query),
    [token, memoryId, montageId],
  );

  const read = useCallback(
    async (older = false) => {
      if (!token || reading.current) return;
      reading.current = true;
      // What this read started from. If the journal underneath was thrown away while it was in
      // flight — another video, another narrowing — its answer belongs to the journal that is gone.
      const from = held.current;
      try {
        const narrow = { stage };
        // A poll that breaks halfway through its pages is dropped whole rather than kept in part:
        // the cursor then stays where it was and the next one asks for the same records again.
        let next = await (older ? pullOlder : pull)(from, ask, narrow);
        // Begun again under this screen: what is held belongs to an attempt that is gone, so the
        // journal is read from nothing, as `restart` has it read — without a blank screen between.
        // Not for a read whose journal was thrown away meanwhile: its answer resets nothing.
        if (held.current === from && startedOver(from.stages, next.stages)) {
          next = await pull(NO_JOURNAL, ask, narrow);
        }
        // Ready under the journal of a stage that was read while the film was being made: its
        // files predate the layout, and this is the last read there will be (`relaid`). The whole
        // journal is not read again — the one screen that reads it through the making leaves for
        // the film's page the moment it is ready, and that page reads it from nothing.
        if (
          stage !== undefined &&
          from.cursor !== null &&
          from.status !== 'ready' &&
          next.status === 'ready'
        ) {
          next = await relaid(next, ask, narrow);
        }
        if (held.current !== from) return;
        held.current = next;
        setState(next);
      } catch (e) {
        if (held.current !== from) return;
        held.current =
          e instanceof ApiError && e.status === 404
            ? { ...from, refused: true }
            : { ...from, offline: true };
        setState(held.current);
      } finally {
        reading.current = false;
      }
    },
    [token, ask, stage],
  );

  /**
   * Everything held thrown away, and the journal read again from nothing. Another video, or the same
   * one under a different narrowing, is another journal — and so is a fallen one queued again: the
   * api wipes the last attempt's records with it, and a screen still holding them would be showing
   * a making that no longer exists, stopped at `failed` with nothing left to poll for.
   */
  const restart = useCallback(() => {
    // A fresh object and not `NO_JOURNAL` itself: a first read still in the air started from that
    // very object, and `held.current !== from` must see the journal it read for as gone.
    held.current = { ...NO_JOURNAL };
    setState(held.current);
  }, []);

  useEffect(restart, [restart, ask, stage]);

  // On the way in, and again the moment the screen comes back in front or the app wakes up.
  useEffect(() => {
    if (focused && active) void read();
  }, [focused, active, read]);

  // And on its own while the worker still owes this one. An interval rather than a timeout chained
  // off each read, the same reasoning the gallery's own loop carries: one read failing on a bad
  // connection would end the chain, and end it silently.
  const making = !state.refused && (state.status === null || beingMade(state.status));
  useEffect(() => {
    if (!focused || !active || !making) return;
    const timer = setInterval(() => void read(), WHILE_LIVE_MS);
    return () => clearInterval(timer);
  }, [focused, active, making, read]);

  const standing: Standing = state.refused
    ? 'refused'
    : state.status === 'failed'
      ? 'failed'
      : state.status === 'ready'
        ? 'ready'
        : state.offline
          ? 'offline'
          : state.status === null
            ? 'opening'
            : 'live';

  const loadOlder = useCallback(() => void read(true), [read]);

  return { ...state, standing, loadOlder, restart };
}

/** How long one step of the typing takes, and how many steps a thought is spread over. */
const TYPE_MS = 30;
const TYPE_STEPS = 60;

/**
 * A thought being said rather than simply being there (spec 7.6). Nothing streams — the api hands
 * over the whole sentence at once — so this is the app's own doing, and it only ever applies to a
 * record that arrived while somebody was watching: everything that was already in the journal when
 * the screen opened stands there finished, or opening a montage from last week would replay an
 * afternoon of typing.
 *
 * Longer thoughts are typed in bigger steps rather than over a longer time: the api lets a thought
 * run to 500 characters, and a sentence that takes fifteen seconds to appear is not being said, it
 * is being withheld. «Reduce motion» puts the whole of it up at once, which is also what the kit's
 * own cursor does under that setting.
 *
 * The sentence comes back in two halves, `said` and `unsaid`, and the kit lays the second out
 * without drawing it: the words take their final room from the first letter, so nothing under them
 * moves while they arrive (spec 7.6, «экран не прыгает»). A new sentence starts from nothing on the
 * very render it arrives on, not one frame later with the last one's length.
 */
export function useTypedThought(
  text: string | null | undefined,
  fresh: boolean,
): { said: string; unsaid: string } {
  const reduced = useReducedMotion();
  const whole = text ?? '';
  const typing = fresh && !reduced && whole !== '';
  const [typed, setTyped] = useState({ of: whole, at: typing ? 0 : whole.length });
  const at = typed.of === whole ? typed.at : typing ? 0 : whole.length;

  useEffect(() => {
    if (!typing) {
      setTyped({ of: whole, at: whole.length });
      return;
    }
    setTyped({ of: whole, at: 0 });
    const step = Math.max(1, Math.ceil(whole.length / TYPE_STEPS));
    let upTo = 0;
    const timer = setInterval(() => {
      upTo = Math.min(whole.length, upTo + step);
      setTyped({ of: whole, at: upTo });
      if (upTo === whole.length) clearInterval(timer);
    }, TYPE_MS);
    return () => clearInterval(timer);
  }, [whole, typing]);

  return { said: whole.slice(0, at), unsaid: whole.slice(at) };
}
