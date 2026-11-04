import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { type Strings, strings } from '@/strings';
export type Language = 'ru' | 'en';
const CHOICE_KEY = 'language';
export function resolveLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const code = tag.toLowerCase().split(/[-_]/)[0];
    if (code === 'ru' || code === 'en') return code;
  }
  return 'en';
}
let current: Language = resolveLanguage(getLocales().map((locale) => locale.languageTag));
const listeners = new Set<() => void>();
function set(next: Language): Language {
  if (next !== current) {
    current = next;
    for (const listener of listeners) listener();
  }
  return current;
}
export const languageReady: Promise<Language> = SecureStore.getItemAsync(CHOICE_KEY).then(
  (stored) => (stored === 'ru' || stored === 'en' ? set(stored) : current),
  () => current,
);
export function currentLanguage(): Language {
  return current;
}
export async function setLanguage(next: Language): Promise<void> {
  set(next);
  await SecureStore.setItemAsync(CHOICE_KEY, next);
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, currentLanguage, currentLanguage);
}
export function useStrings(): Strings {
  return strings[useLanguage()];
}
