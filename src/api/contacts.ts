import type { User } from './account';
import { request } from './call';

/** The people one knows by name, so an invitation costs no typing. */
/**
 * The three public fields the api hands out about somebody who is not you: no email, ever. It is
 * what `GET /users` answers and what a contact is, and the same shape a roster row is built on —
 * so `memberName` and `memberHandle` name one of these as readily as a member.
 */
export type Contact = Pick<User, 'id' | 'username' | 'name'>;

/**
 * Somebody by their exact username — no prefixes and no fuzzy matching, which would turn this into
 * a directory of everybody rather than a way to reach a person you already know. 404 when nobody
 * holds the name, and a name nobody could ever hold answers that same 404 rather than a 400.
 */
export function findUser(token: string, username: string): Promise<Contact> {
  return request(`/users?username=${encodeURIComponent(username)}`, { token });
}

/**
 * The caller's own contacts (doc-10), by username. No id in the route because there is no other
 * list to ask for: a contact list is one-way and private, so being on somebody's grants nothing and
 * reveals nothing.
 */
export function listContacts(token: string): Promise<Contact[]> {
  return request('/me/contacts', { token });
}

/**
 * Save somebody by their exact username. 404 when nobody holds it and 400 on one's own name;
 * saving somebody already saved is a plain 200, which is what makes «Сохранить» safe to press
 * beside a person who is already on the list.
 */
export function addContact(token: string, username: string): Promise<Contact> {
  return request('/me/contacts', { method: 'POST', body: { username }, token });
}

/** Drop one. 404 for somebody who was never on the list — and for anybody on another person's. */
export function removeContact(token: string, userId: string): Promise<{ ok: true }> {
  return request(`/me/contacts/${userId}`, { method: 'DELETE', token });
}
