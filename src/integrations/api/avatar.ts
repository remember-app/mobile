import { request } from './client';
import type { AvatarWire } from './wire';

export function setAvatar(token: string, mediaId: string): Promise<{ url: string }> {
  return request<AvatarWire>('/v1/me/avatar', {
    method: 'POST',
    body: { mediaId },
    token,
  }).then((wire) => ({ url: wire.url ?? '' }));
}

export function getAvatar(token: string): Promise<{ url: string | null }> {
  return request<AvatarWire>('/v1/me/avatar', { token });
}

export function removeAvatar(token: string): Promise<{ ok: true }> {
  return request('/v1/me/avatar', { method: 'DELETE', token });
}
