import type { Contact } from '@/models';
import type { Page } from '@/types/api';
import type { UserId } from '@/types/id';

import { query, request } from './client';
import { toContact, toPage } from './map';
import type { ContactWire, OffsetPageWire } from './wire';

export function listContacts(
  token: string,
  page: { limit?: number; offset?: number } = {},
): Promise<Page<Contact>> {
  return request<OffsetPageWire<ContactWire>>(`/v1/me/contacts${query(page)}`, { token }).then(
    (wire) => toPage(wire, toContact),
  );
}

export function addContact(
  token: string,
  input: { username: string; name?: string | null },
): Promise<Contact> {
  return request<ContactWire>('/v1/me/contacts', { method: 'POST', body: input, token }).then(
    toContact,
  );
}

export function renameContact(
  token: string,
  userId: UserId,
  name: string | null,
): Promise<Contact> {
  return request<ContactWire>(`/v1/me/contacts/${userId}`, {
    method: 'PATCH',
    body: { name },
    token,
  }).then(toContact);
}

export function removeContact(token: string, userId: UserId): Promise<{ ok: true }> {
  return request(`/v1/me/contacts/${userId}`, { method: 'DELETE', token });
}
