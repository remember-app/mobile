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

const watchApp = (listener: () => void) => {
  const subscription = AppState.addEventListener('change', listener);
  return () => subscription.remove();
};
const appActive = () => AppState.currentState === 'active';
function useAppActive(): boolean {
  return useSyncExternalStore(watchApp, appActive, appActive);
}
export function useMontageJournal(
  token: string | null,
  memoryId: string,
  montageId: string,
  { stage }: Narrow = {},
): Journal & {
  standing: Standing;
  loadOlder: () => void;
  restart: () => void;
} {
  const [state, setState] = useState<Journal>(NO_JOURNAL);
  const held = useRef<Journal>(NO_JOURNAL);
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
      const from = held.current;
      try {
        const narrow = { stage };
        let next = await (older ? pullOlder : pull)(from, ask, narrow);
        if (held.current === from && startedOver(from.stages, next.stages)) {
          next = await pull(NO_JOURNAL, ask, narrow);
        }
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
  const restart = useCallback(() => {
    held.current = { ...NO_JOURNAL };
    setState(held.current);
  }, []);
  useEffect(restart, [restart, ask, stage]);
  useEffect(() => {
    if (focused && active) void read();
  }, [focused, active, read]);
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
const TYPE_MS = 30;
const TYPE_STEPS = 60;
export function useTypedThought(
  text: string | null | undefined,
  fresh: boolean,
): {
  said: string;
  unsaid: string;
} {
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
