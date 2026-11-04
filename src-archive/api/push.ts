import { request } from './call';
export function registerPushToken(
  token: string,
  expoToken: string,
  platform: string,
): Promise<{
  ok: true;
}> {
  return request('/me/push-tokens', {
    method: 'POST',
    body: { token: expoToken, platform },
    token,
  });
}
