import type { PushPlatform } from '@/types/push';

import { request } from './client';

export function registerPushToken(
  token: string,
  pushToken: string,
  platform: PushPlatform,
): Promise<{ ok: true }> {
  return request('/v1/me/push-tokens', {
    method: 'POST',
    body: { token: pushToken, platform },
    token,
  });
}

export function removePushToken(token: string, pushToken: string): Promise<{ ok: true }> {
  return request('/v1/me/push-tokens', {
    method: 'DELETE',
    body: { token: pushToken },
    token,
  });
}
