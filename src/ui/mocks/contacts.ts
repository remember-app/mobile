export type MockContact = {
  id: string;
  name: string;
  username: string;
};

let contacts: MockContact[] = [
  { id: 'c1', name: 'Анна Петрова', username: 'anna' },
  { id: 'c2', name: 'Борис Лебедев', username: 'boris' },
  { id: 'c3', name: 'Вера Соколова', username: 'vera' },
  { id: 'c4', name: 'Глеб Морозов', username: 'gleb' },
  { id: 'c5', name: 'Даша Волкова', username: 'dasha' },
  { id: 'c6', name: 'Илья Кузнецов', username: 'ilya' },
  { id: 'c7', name: 'Кира Орлова', username: 'kira' },
  { id: 'c8', name: 'Марк Зайцев', username: 'mark' },
];

let suggestions: MockContact[] = [
  { id: 's1', name: 'Олег Смирнов', username: 'oleg' },
  { id: 's2', name: 'Ника Белова', username: 'nika' },
  { id: 's3', name: 'Лена Крылова', username: 'lena' },
];

const listeners = new Set<() => void>();

export const contactsState = () => contacts;
export const suggestionsState = () => suggestions;

export function subscribeContacts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const subscribeSuggestions = subscribeContacts;

function emit(): void {
  for (const listener of listeners) listener();
}

function withoutSuggestion(username: string): void {
  suggestions = suggestions.filter(
    (suggestion) => suggestion.username.toLowerCase() !== username.toLowerCase(),
  );
}

export function addContact(username: string): void {
  const clean = username.trim().replace(/^@/, '');
  if (!clean) return;
  if (contacts.some((contact) => contact.username.toLowerCase() === clean.toLowerCase())) {
    withoutSuggestion(clean);
    emit();
    return;
  }
  contacts = [...contacts, { id: `c-${clean}`, name: clean, username: clean }];
  withoutSuggestion(clean);
  emit();
}

export function removeContact(id: string): void {
  contacts = contacts.filter((contact) => contact.id !== id);
  emit();
}

export function setContactCount(count: number): void {
  const target = Math.max(0, Math.floor(count));
  if (target <= contacts.length) {
    contacts = contacts.slice(0, target);
    emit();
    return;
  }
  const next = [...contacts];
  for (let index = next.length; index < target; index += 1) {
    const username = `user${index + 1}`;
    next.push({ id: `c-${username}`, name: `Пользователь ${index + 1}`, username });
  }
  contacts = next;
  emit();
}

export function acceptSuggestion(id: string): void {
  const found = suggestions.find((suggestion) => suggestion.id === id);
  if (!found) return;
  if (!contacts.some((contact) => contact.username === found.username)) {
    contacts = [...contacts, found];
  }
  suggestions = suggestions.filter((suggestion) => suggestion.id !== id);
  emit();
}
