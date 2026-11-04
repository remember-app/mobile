import { type Connection, networkStatus, watchNetwork } from '@/integrations/network';

export type NetworkState = {
  status: 'unknown' | 'online' | 'offline';
  type: string | null;
};

let state: NetworkState = { status: 'unknown', type: null };
const listeners = new Set<() => void>();

export const networkState = (): NetworkState => state;

export const subscribeNetwork = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isOnline = (): boolean => state.status === 'online';

function emit(next: NetworkState): void {
  state = next;
  for (const listener of listeners) listener();
}

function apply(connection: Connection): void {
  emit({
    status: connection.online ? 'online' : 'offline',
    type: connection.type,
  });
}

watchNetwork(apply);
void networkStatus().then(apply, () => undefined);
