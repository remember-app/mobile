import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

import {
  type Color,
  type Shadow,
  type Theme,
  type ThemeChoice,
  type ThemeName,
  themes,
} from './colors';

/**
 * Which of the two themes the app is drawing in, and the two hooks everything reads it through.
 *
 * The tokens themselves are beside this: `tokens.ts` for what has one answer, `colors.ts` for what
 * has two. Both are re-exported here, so a component imports `@/theme` and nothing else.
 */
export * from './colors';
export * from './tokens';

/*
 * Which of the two the app is drawing in — the phone's own setting, unless the person picked the
 * other one, and that pick outlives the app.
 *
 * Held the same way as the language (`language.ts`): one value for the whole app, so it is one
 * module variable and not a context, and components that must redraw on a switch go through the
 * hooks below.
 */

/**
 * Where the picked theme is kept. Not a secret, but `expo-secure-store` is the key-value store this
 * app already carries, and one string is not worth a second storage library.
 */
const CHOICE_KEY = 'theme';

/**
 * The phone's setting. Anything but light is the night — `unspecified`, a phone too old to be
 * asked, and the answer that never came: the layout is drawn in the dark, so that is where it
 * starts.
 */
export function resolveTheme(scheme: ColorSchemeName | null | undefined): ThemeName {
  return scheme === 'light' ? 'light' : 'dark';
}

let current: ThemeName = resolveTheme(Appearance.getColorScheme());

/** What was picked. Until someone picks, and again if they pick `system`, the phone decides. */
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
  // Picking `system` hands the phone back the decision, and the answer is asked for straight away
  // rather than waited on: the phone may well have changed while the app was ignoring it.
  const name = set(next === 'system' ? resolveTheme(Appearance.getColorScheme()) : next);
  // The pick can move without the theme moving — dark from the phone, then dark by hand. `set` stays
  // quiet then, and the switch showing the pick still has to redraw.
  if (moved && name === before) tell();
  return name;
}

// The phone changes theme while the app is open, and the app follows — unless the person took the
// decision off it.
Appearance.addChangeListener(({ colorScheme }) => {
  if (choice === 'system') set(resolveTheme(colorScheme));
});

/**
 * The stored pick, read once at startup. It resolves to the theme the app settled on, so a splash
 * can wait for it — nothing has to: until it lands the app is in the phone's own theme, which for
 * everyone who never picked is the final answer anyway.
 */
export const themeReady: Promise<ThemeName> = SecureStore.getItemAsync(CHOICE_KEY).then(
  (stored) =>
    stored === 'dark' || stored === 'light' || stored === 'system' ? pick(stored) : current,
  // Unreadable keychain: nothing was picked as far as this launch can tell, the phone decides.
  () => current,
);

/** The theme the app is in right now, for code with no component around it. */
export function currentTheme(): ThemeName {
  return current;
}

/** What was picked, which is what the switch shows — never what the screen is drawn in. */
export function currentThemeChoice(): ThemeChoice {
  return choice;
}

/**
 * Switch by hand. The screen turns first and the disk catches up: a keychain that refuses throws to
 * the caller, and the only thing lost is the memory of the pick, not the pick itself.
 */
export async function setTheme(next: ThemeChoice): Promise<void> {
  pick(next);
  await SecureStore.setItemAsync(CHOICE_KEY, next);
}

/**
 * Exported for `theme.test.ts` as well as the hooks below: there is no harness in this repo that
 * mounts a component and watches it redraw, so the one branch in `pick()` that moves the choice
 * without moving the resolved theme — dark from the phone, then dark by hand — is proven by
 * registering a listener here directly and asserting it is called, the same contract
 * `useSyncExternalStore` relies on.
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * A subtree held in one of the two sets whatever the app is in — `<ThemePin value="dark">`.
 *
 * The viewer is the one place that needs it: a frame opened full screen stands on `photo.viewer` in
 * both themes, and every kit component inside it — the filmstrip, a tile, a banner — would
 * otherwise go on answering `useTheme()` with the live set, which is a daylight surface inside a
 * dark room.
 */
const Pinned = createContext<ThemeName | null>(null);
export const ThemePin = Pinned.Provider;

/** The tokens with two answers, for a component that has to redraw when the theme changes. */
export function useTheme(): Theme {
  const live = useSyncExternalStore(subscribe, currentTheme, currentTheme);
  return themes[useContext(Pinned) ?? live];
}

/** The pick itself, for the one switch that shows it. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, currentThemeChoice, currentThemeChoice);
}

/**
 * A component's own styles, in the theme the app is in:
 *
 * ```tsx
 * const useStyles = themed(({ color }) =>
 *   StyleSheet.create({ card: { backgroundColor: color.ink } }),
 * );
 * ```
 *
 * The result is a hook — call it in the component and get the sheet back. Each theme's sheet is
 * built the first time it is drawn and kept, so switching costs one `StyleSheet.create` and a
 * redraw, and a re-render costs nothing.
 */
export function themed<T>(make: (theme: Theme) => T): () => T {
  const made = {} as Record<ThemeName, T>;
  return function useThemed(): T {
    const { name } = useTheme();
    // biome-ignore lint/suspicious/noAssignInExpressions: build once, keep, hand back — one line.
    return (made[name] ??= make(themes[name]));
  };
}
