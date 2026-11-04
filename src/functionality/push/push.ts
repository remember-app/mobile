import { currentToken, onBeforeSignOut, onSignOut } from '@/functionality/auth/session';
import { registerPushToken, removePushToken } from '@/integrations/api';
import { readCache, removeCache, writeCache } from '@/integrations/files/cache';
import { expoPushToken, permissionGranted, pushPlatform } from '@/integrations/notifications';
import type { PushPlatform } from '@/types/push';

export { onPushOpened, type PushPayload } from '@/integrations/notifications';

const CACHE = 'push-token';

type Stored = {
  token: string;
  platform: PushPlatform;
};

export type PushState = {
  registered: boolean;
  token: string | null;
};

let stored = readCache<Stored>(CACHE);
let state: PushState = { registered: stored !== null, token: stored?.token ?? null };
const listeners = new Set<() => void>();

export const pushState = (): PushState => state;

export const subscribePush = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(next: PushState): void {
  state = next;
  for (const listener of listeners) listener();
}

export async function registerPush(): Promise<boolean> {
  const session = currentToken();
  const platform = pushPlatform();
  if (!session || !platform) return false;
  if (!(await permissionGranted())) return false;
  const device = await expoPushToken();
  if (!device) return false;
  await registerPushToken(session, device, platform);
  stored = { token: device, platform };
  writeCache(CACHE, stored);
  emit({ registered: true, token: device });
  return true;
}

export async function unregisterPush(): Promise<void> {
  const session = currentToken();
  if (session && stored) {
    await removePushToken(session, stored.token).catch(() => undefined);
  }
  stored = null;
  removeCache(CACHE);
  emit({ registered: false, token: null });
}

onBeforeSignOut(unregisterPush);
onSignOut(() => {
  stored = null;
  emit({ registered: false, token: null });
});
