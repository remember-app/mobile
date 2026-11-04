import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import { type Theme, type ThemeChoice, type ThemeName, themes } from './colors';

export * from './colors';
export * from './tokens';

const CHOICE_KEY = 'theme';
export function resolveTheme(scheme: ColorSchemeName | null | undefined): ThemeName {
  return scheme === 'light' ? 'light' : 'dark';
}
let current: ThemeName = resolveTheme(Appearance.getColorScheme());
let choice: ThemeChoice = 'system';
const listeners = new Set<() => void>();
function tell() {
  for (const listener of listeners) listener();
}
function set(next: ThemeName): ThemeName {
  if (next !== current) {
    current = next;
    tell();
  }
  return current;
}
function pick(next: ThemeChoice): ThemeName {
  const moved = next !== choice;
  choice = next;
  const before = current;
  const name = set(next === 'system' ? resolveTheme(Appearance.getColorScheme()) : next);
  if (moved && name === before) tell();
  return name;
}
Appearance.addChangeListener(({ colorScheme }) => {
  if (choice === 'system') set(resolveTheme(colorScheme));
});
export const themeReady: Promise<ThemeName> = SecureStore.getItemAsync(CHOICE_KEY).then(
  (stored) =>
    stored === 'dark' || stored === 'light' || stored === 'system' ? pick(stored) : current,
  () => current,
);
export function currentTheme(): ThemeName {
  return current;
}
export function currentThemeChoice(): ThemeChoice {
  return choice;
}
export async function setTheme(next: ThemeChoice): Promise<void> {
  pick(next);
  await SecureStore.setItemAsync(CHOICE_KEY, next);
}
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const Pinned = createContext<ThemeName | null>(null);
export const ThemePin = Pinned.Provider;
export function useTheme(): Theme {
  const live = useSyncExternalStore(subscribe, currentTheme, currentTheme);
  return themes[useContext(Pinned) ?? live];
}
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, currentThemeChoice, currentThemeChoice);
}
export function themed<T>(make: (theme: Theme) => T): () => T {
  const made = {} as Record<ThemeName, T>;
  return function useThemed(): T {
    const { name } = useTheme();
    const sheet = made[name] ?? make(themes[name]);
    made[name] = sheet;
    return sheet;
  };
}
