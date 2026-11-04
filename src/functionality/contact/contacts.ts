import { currentToken, onSignOut } from '@/functionality/auth/session';
import {
  addContact as apiAddContact,
  findUser as apiFindUser,
  removeContact as apiRemoveContact,
  renameContact as apiRenameContact,
  listContacts,
} from '@/integrations/api';
import { readCache, writeCache } from '@/integrations/files/cache';
import type { Contact, PublicUser } from '@/models';
import type { UserId } from '@/types/id';

const CACHE = 'contacts';

export type ContactsState = {
  status: 'loading' | 'ready' | 'error';
  contacts: Contact[];
  nextOffset: number | null;
  error: unknown;
};

type Stored = {
  contacts: Contact[];
  nextOffset: number | null;
};

let state: ContactsState = {
  status: 'loading',
  contacts: [],
  nextOffset: null,
  error: null,
};
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export const contactsState = (): ContactsState => state;

export const subscribeContacts = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(next: ContactsState): void {
  state = next;
  for (const listener of listeners) listener();
}

function persist(): void {
  writeCache(CACHE, { contacts: state.contacts, nextOffset: state.nextOffset });
}

function token(): string {
  const value = currentToken();
  if (!value) throw new Error('not signed in');
  return value;
}

function order(contacts: Contact[]): Contact[] {
  return [...contacts].sort(
    (left, right) =>
      (left.name ?? left.username ?? '').localeCompare(right.name ?? right.username ?? '') ||
      left.userId.localeCompare(right.userId),
  );
}

export function hydrateContacts(): void {
  const stored = readCache<Stored>(CACHE);
  if (!stored || !Array.isArray(stored.contacts)) return;
  emit({
    status: 'ready',
    contacts: stored.contacts,
    nextOffset: stored.nextOffset,
    error: null,
  });
}

export function clearContacts(): void {
  emit({ status: 'loading', contacts: [], nextOffset: null, error: null });
}

export function contactById(userId: UserId): Contact | undefined {
  return state.contacts.find((contact) => contact.userId === userId);
}

export async function loadContacts(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && state.status === 'ready') return;
  inFlight = (async () => {
    try {
      const page = await listContacts(token());
      emit({
        status: 'ready',
        contacts: page.items,
        nextOffset: page.nextOffset,
        error: null,
      });
      persist();
    } catch (error) {
      emit({ ...state, status: state.contacts.length > 0 ? 'ready' : 'error', error });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function loadMoreContacts(): Promise<void> {
  if (inFlight) return inFlight;
  if (state.nextOffset === null) return;
  inFlight = (async () => {
    try {
      const page = await listContacts(token(), { offset: state.nextOffset ?? undefined });
      const seen = new Set(state.contacts.map((contact) => contact.userId));
      emit({
        status: 'ready',
        contacts: [...state.contacts, ...page.items.filter((contact) => !seen.has(contact.userId))],
        nextOffset: page.nextOffset,
        error: null,
      });
      persist();
    } catch (error) {
      emit({ ...state, error });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function addContact(username: string, name: string | null = null): Promise<Contact> {
  const contact = await apiAddContact(token(), { username, name });
  const exists = state.contacts.some((item) => item.userId === contact.userId);
  emit({
    ...state,
    status: 'ready',
    contacts: order(
      exists
        ? state.contacts.map((item) => (item.userId === contact.userId ? contact : item))
        : [...state.contacts, contact],
    ),
    error: null,
  });
  persist();
  return contact;
}

export async function findPerson(username: string): Promise<PublicUser> {
  return apiFindUser(token(), username);
}

export async function renameContact(userId: UserId, name: string | null): Promise<Contact> {
  const contact = await apiRenameContact(token(), userId, name);
  emit({
    ...state,
    contacts: order(state.contacts.map((item) => (item.userId === userId ? contact : item))),
  });
  persist();
  return contact;
}

export async function removeContact(userId: UserId): Promise<void> {
  await apiRemoveContact(token(), userId);
  emit({ ...state, contacts: state.contacts.filter((item) => item.userId !== userId) });
  persist();
}

onSignOut(clearContacts);
