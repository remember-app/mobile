import { currentToken } from '@/functionality/auth/session';
import { listSuggestions } from '@/integrations/api';
import type { PublicUser } from '@/models';

export type SuggestionsState = {
  status: 'loading' | 'ready' | 'error';
  items: PublicUser[];
  error: unknown;
};

const EMPTY: SuggestionsState = {
  status: 'loading',
  items: [],
  error: null,
};

let state: SuggestionsState = EMPTY;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export const suggestionsState = (): SuggestionsState => state;

export const subscribeSuggestions = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(next: SuggestionsState): void {
  state = next;
  for (const listener of listeners) listener();
}

export async function loadSuggestions(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && state.status === 'ready') return;
  const token = currentToken();
  if (!token) {
    emit({ status: 'error', items: [], error: new Error('not signed in') });
    return;
  }
  inFlight = (async () => {
    if (state.items.length === 0) emit({ ...state, status: 'loading', error: null });
    try {
      const page = await listSuggestions(token);
      emit({ status: 'ready', items: page.items, error: null });
    } catch (error) {
      emit({ ...state, status: state.items.length > 0 ? 'ready' : 'error', error });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function clearSuggestions(): void {
  emit(EMPTY);
}
