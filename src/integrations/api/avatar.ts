import { request } from './client';
import type { AvatarStartWire, AvatarWire } from './wire';

export type AvatarUpload = {
  mediaId: string;
  url: string;
};

export function startAvatarUpload(token: string, fileName: string): Promise<AvatarUpload> {
  return request<AvatarStartWire>('/v1/me/avatar', {
    method: 'POST',
    body: { fileName },
    token,
  });
}

export function completeAvatarUpload(token: string, mediaId: string): Promise<{ url: string }> {
  return request<AvatarWire>(`/v1/me/avatar/${mediaId}/complete`, {
    method: 'POST',
    token,
  }).then((wire) => ({ url: wire.url ?? '' }));
}

export function getAvatar(token: string): Promise<{ url: string | null }> {
  return request<AvatarWire>('/v1/me/avatar', { token });
}

export function removeAvatar(token: string): Promise<{ ok: true }> {
  return request('/v1/me/avatar', { method: 'DELETE', token });
}
