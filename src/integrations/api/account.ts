import type { Account, Language, PublicUser, User } from '@/models';

import { query, request } from './client';
import { toAccount, toPublicUser, toUser } from './map';
import type { AccountWire, PublicUserWire, UserWire } from './wire';

export function getMe(token: string): Promise<Account> {
  return request<AccountWire>('/v1/me', { token }).then(toAccount);
}

export function listUsers(token: string): Promise<User[]> {
  return request<UserWire[]>('/v1/dev/users', { token }).then((users) => users.map(toUser));
}

export function findUser(token: string, username: string): Promise<PublicUser> {
  return request<PublicUserWire>(`/v1/users/${encodeURIComponent(username)}`, { token }).then(
    toPublicUser,
  );
}

export function usernameAvailable(
  token: string,
  username: string,
): Promise<{ available: boolean }> {
  return request(`/v1/me/username/available${query({ username })}`, { token });
}

export function setUsername(token: string, username: string): Promise<User> {
  return request<UserWire>('/v1/me/username', { method: 'POST', body: { username }, token }).then(
    toUser,
  );
}

export function setName(token: string, name: string | null): Promise<User> {
  return request<UserWire>('/v1/me/name', { method: 'POST', body: { name }, token }).then(toUser);
}

export function setLanguage(token: string, language: Language): Promise<User> {
  return request<UserWire>('/v1/me/language', {
    method: 'POST',
    body: { language },
    token,
  }).then(toUser);
}
