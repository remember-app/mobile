export type MockResources = {
  storageGb: number;
  tokensLeft: number;
  tokensTotal: number;
};

let data: Record<string, MockResources> = {
  birthday: { storageGb: 10, tokensLeft: 120, tokensTotal: 200 },
  sea: { storageGb: 10, tokensLeft: 180, tokensTotal: 300 },
  office: { storageGb: 10, tokensLeft: 40, tokensTotal: 100 },
};

const listeners = new Set<() => void>();

const NONE: MockResources = { storageGb: 0, tokensLeft: 0, tokensTotal: 0 };

export const resourcesOf = (projectId: string): MockResources => data[projectId] ?? NONE;

export function subscribeResources(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function receiveStorage(projectId: string, gigabytes: number): void {
  const current = resourcesOf(projectId);
  data = {
    ...data,
    [projectId]: { ...current, storageGb: current.storageGb + gigabytes },
  };
  emit();
}

export function receiveTokens(projectId: string, tokens: number): void {
  const current = resourcesOf(projectId);
  data = {
    ...data,
    [projectId]: {
      ...current,
      tokensLeft: current.tokensLeft + tokens,
      tokensTotal: current.tokensTotal + tokens,
    },
  };
  emit();
}
