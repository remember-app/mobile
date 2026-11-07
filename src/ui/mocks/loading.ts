let loading = false;
const listeners = new Set<() => void>();

export const loadingState = () => loading;

export function subscribeLoading(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setMockLoading(next: boolean): void {
  loading = next;
  for (const listener of listeners) listener();
}
