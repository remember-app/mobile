import { request } from './call';

/** The phone's push token, handed to the api so it can knock. */
/**
 * Tell the api where to push to. Idempotent: the same device token registered twice is one row,
 * so this can run on every launch without asking whether it already ran.
 */
export function registerPushToken(
  token: string,
  expoToken: string,
  platform: string,
): Promise<{ ok: true }> {
  return request('/me/push-tokens', {
    method: 'POST',
    body: { token: expoToken, platform },
    token,
  });
}

/**
 * Join by invite link. Answers with the memory as its new member sees it — the same shape
 * `/memories` hands out, so the screen it lands on has nothing extra to fetch. 404 once the
 * link has been rotated, and being a member already is a plain 200 that changes no role.
 */
