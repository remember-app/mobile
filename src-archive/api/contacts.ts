import type { User } from './account';
import { request } from './call';
export type Contact = Pick<User, 'id' | 'username' | 'name'>;
export function findUser(token: string, username: string): Promise<Contact> {
  return request(`/users?username=${encodeURIComponent(username)}`, { token });
}
export function listContacts(token: string): Promise<Contact[]> {
  return request('/me/contacts', { token });
}
export function addContact(token: string, username: string): Promise<Contact> {
  return request('/me/contacts', { method: 'POST', body: { username }, token });
}
export function removeContact(
  token: string,
  userId: string,
): Promise<{
  ok: true;
}> {
  return request(`/me/contacts/${userId}`, { method: 'DELETE', token });
}
