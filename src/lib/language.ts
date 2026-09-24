import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { type Strings, strings } from '@/strings';

/**
 * Which of the two languages the app is speaking (doc-8) — the phone's, unless the person picked
 * the other one, and that pick outlives the app.
 *
 * The language is one value for the whole app, so it is one module variable and not a context: the
 * date formatter and any other plain function can ask for it without a component around them, and
 * components that must redraw on a switch go through `useLanguage()` / `useStrings()`. There is no
 * i18n framework under this — a dictionary and a resolver is the whole of it, the same way
 * `theme.ts` is the whole of the design tokens.
 */
export type Language = 'ru' | 'en';

/**
 * Where the picked language is kept. Not a secret, but `expo-secure-store` is the key-value store
 * this app already carries (`auth.tsx`), and one string is not worth a second storage library.
 */
const CHOICE_KEY = 'language';

/**
 * The phone's languages, in the order it prefers them, cut down to the two the app has. Anything
 * else is English: a phone in German is not a reason to guess.
 */
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

/**
 * The stored pick, read once at startup. It resolves to the language the app settled on, so a
 * splash can wait for it — nothing has to: until it lands the app is on the phone's own language,
 * which for everyone who never picked is the final answer anyway.
 */
export const languageReady: Promise<Language> = SecureStore.getItemAsync(CHOICE_KEY).then(
  (stored) => (stored === 'ru' || stored === 'en' ? set(stored) : current),
  // Unreadable keychain: nothing was picked as far as this launch can tell, the phone decides.
  () => current,
);

/** The language the app speaks right now, for code with no component around it. */
export function currentLanguage(): Language {
  return current;
}

/**
 * Switch by hand. The screen turns first and the disk catches up: a keychain that refuses throws
 * to the caller, and the only thing lost is the memory of the pick, not the pick itself.
 */
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

/** The language, for a component that has to redraw when it changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, currentLanguage, currentLanguage);
}

/** The words themselves: `const s = useStrings()`, then `s.action.back`. */
export function useStrings(): Strings {
  return strings[useLanguage()];
}
