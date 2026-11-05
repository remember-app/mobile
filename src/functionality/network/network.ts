import { type Connection, networkStatus, watchNetwork } from '@/integrations/network';

export type NetworkState = {
  status: 'unknown' | 'online' | 'offline';
  type: string | null;
};

let state: NetworkState = { status: 'unknown', type: null };
let override: boolean | null = null;
let forced: NetworkState | null = null;
const listeners = new Set<() => void>();

export const networkState = (): NetworkState => forced ?? state;

export const subscribeNetwork = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isOnline = (): boolean => (override === null ? state.status === 'online' : override);

export function setNetworkOverride(online: boolean | null): void {
  override = online;
  forced = online === null ? null : { status: online ? 'online' : 'offline', type: 'test' };
  for (const listener of listeners) listener();
}

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
