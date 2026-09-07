import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { Appearance, StyleSheet, type ColorSchemeName } from 'react-native';

import { shades, type Shade } from '@/kit/shades';

/**
 * The kit, carried over from `design/kit.html` in the product repo — that file is the single source
 * of design truth and this one is its only translation. Names and values match it one for one: a CSS
 * custom property `--ember` is `color.ember` here, `--s4` is `space.s4`. When the kit changes, this
 * file changes with it and nothing else has to.
 *
 * The kit is one room at two lights — «Тёмная комната» and «Контактный лист» — and it is laid out in
 * three blocks: what both themes share, the dark set, the light set. So is this file. Rhythm, shape,
 * type and motion are shared, exported as they always were, and never look at the theme; only colour
 * and the light it casts have two sets, and those are asked for by `useTheme()` / `themed()`.
 *
 * React Native has no custom properties, so a component reads these and puts them in its own
 * `StyleSheet.create`. Nothing here computes or derives — it only names.
 */

/* ── Shared ─────────────────────────────────────────────────────────────── */

/** Rhythm. Step of 4. */
export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32, s8: 48 } as const;

/** Shape. The frame is nearly sharp — it is a frame, not a card. */
export const radius = { frame: 3, card: 12, pill: 999 } as const;

/** Motion. Only in answer to something a person did. */
export const duration = { fast: 120, slow: 280 } as const;

/**
 * The kit's `cubic-bezier(.2,.7,.2,1)`, kept as its four control points: that is what
 * `Easing.bezier(...ease)` wants, and the numbers still read straight off the kit.
 */
export const ease = [0.2, 0.7, 0.2, 1] as const;

/**
 * Type. Headings are Bricolage Grotesque, everything else is the system font — it is native to the
 * phone and does not argue with the frames. `display` is the loaded face's own name rather than a
 * family plus a weight: asking a single-weight custom font for `fontWeight` makes Android synthesise
 * one instead of using it. Leaving `fontFamily` off is how a style says «system font».
 */
export const font = { display: 'BricolageGrotesque_600SemiBold' } as const;

/**
 * The kit's six type roles — roles, not sizes. Line heights are the kit's ratios resolved to px.
 * Sizes only: the colour a role is read in belongs to the theme, and `kit/text.tsx` pairs the two.
 */
export const type = StyleSheet.create({
  display: { fontFamily: font.display, fontSize: 32, lineHeight: 33.6, letterSpacing: -0.64 },
  title: { fontFamily: font.display, fontSize: 22, lineHeight: 26.4, letterSpacing: -0.22 },
  subtitle: { fontSize: 17, lineHeight: 22.1, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23.2, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 16.8, fontWeight: '500' },
  // Figures are tabular everywhere in the kit, so dates and counters do not dance.
  meta: { fontSize: 13, lineHeight: 15.6, fontWeight: '500', fontVariant: ['tabular-nums'] },
});

/**
 * The dark laid over a frame, and what is read on it. Shared because it lies on a photograph and not
 * on the interface: the duration of a clip and the bar over an opened frame have to read on snow and
 * on a night sky alike, whichever theme the app is in.
 */
export const scrim = 'rgba(20,17,15,.78)';
export const onScrim = '#F2ECE3';

/* ── The two sets ───────────────────────────────────────────────────────── */

/**
 * Colour. Four steps of surface instead of shadows, plus what is read and what signals.
 * `ember` belongs to exactly one element per screen; if there are two, one of them is not the
 * main one.
 */
export type Color = {
  /** screen background */
  ink: string;
  /** raised surface: card, field, sheet */
  surface: string;
  /** surface on a surface: chip, hover, press */
  raise: string;
  /** hairline, frame border */
  line: string;
  /** text and everything that gets read */
  paper: string;
  /** secondary text, captions, disabled */
  muted: string;
  /** signal: main action, focus, progress */
  ember: string;
  /** developed: done, uploaded, montage ready */
  fixed: string;
  /** failure: error bar, irreversible action */
  rust: string;
};

/** «Тёмная комната»: warm charcoal, photo paper, safelight. Media is the only bright thing. */
const dark: Color = {
  ink: '#14110F',
  surface: '#1E1A17',
  raise: '#262019',
  line: '#332C27',
  paper: '#F2ECE3',
  muted: '#948A7F',
  ember: '#E4552B',
  fixed: '#7BA05B',
  rust: '#7E2B1D',
};

/**
 * «Контактный лист»: the same room in daylight, prints laid out on a tinted mat board. The rule is
 * the same one turned over — a surface does not rise towards the light, it gets cleaner. Nothing is
 * white: there is no #FFF on photo paper.
 */
const light: Color = {
  ink: '#EFE8DC',
  surface: '#FBF7F1',
  raise: '#E5DACA',
  line: '#D5C8B6',
  paper: '#241D17',
  muted: '#655648',
  ember: '#B83C19',
  fixed: '#4C7038',
  rust: '#86301E',
};

/**
 * Light. In the dark room there are no shadows — there is the glow of the safelight; in daylight the
 * safelight does not show and things cast a warm shadow instead. Either way it goes to exactly one
 * element per screen. A CSS shadow string because RN 0.76+ takes `boxShadow` in that form, which
 * keeps it identical to the kit.
 */
const glow = {
  dark: '0 0 0 1px rgba(228,85,43,.30), 0 10px 34px -14px rgba(228,85,43,.60)',
  light: '0 0 0 1px rgba(184,60,25,.22), 0 8px 22px -12px rgba(58,38,26,.7)',
};

/** The kit's two lights, and there is no third one (doc-9). */
export type ThemeName = 'dark' | 'light';

/**
 * What a person can pick, which is one more thing than what the app draws in: `system` is not a
 * third light but the absence of a pick — the phone goes on deciding, and the kit's own switch
 * (section 15) offers it as «Как в телефоне». Everything that draws asks for a `ThemeName`; only
 * the switch itself, and the disk, know about this.
 */
export type ThemeChoice = ThemeName | 'system';

/** Everything that has two answers, in the set the app is currently drawing in. */
export type Theme = { name: ThemeName; color: Color; shade: Shade; glow: string };

export const themes: Record<ThemeName, Theme> = {
  dark: { name: 'dark', color: dark, shade: shades.dark, glow: glow.dark },
  light: { name: 'light', color: light, shade: shades.light, glow: glow.light },
};

/* ── Which theme the app is in ──────────────────────────────────────────── */

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
 * The phone's setting. Anything but light is the dark room — `unspecified`, a phone too old to be
 * asked, and the answer that never came: the product lives in the dark, so that is where it starts.
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
  // The pick can move without the light moving — dark from the phone, then dark by hand. `set` stays
  // quiet then, and the switch showing the pick still has to redraw.
  if (moved && name === before) tell();
  return name;
}

// Sundown, the control centre: the phone changes theme while the app is open, and the app follows —
// unless the person took the decision off it.
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
 * The kit does this exactly once: `.viewer` stands in the dark-pinned selector list beside `:root`
 * (kit.html, block 0.2), and in CSS everything under it inherits that pin — the filmstrip, the
 * tiles in it, a banner over the frame. Spelling `themes.dark` out in the container's own sheet
 * only pins the container: a `Tile` or an `Empty` inside it reads `useTheme()` and would go on
 * answering with the live set, which is a light surface inside the dark room.
 */
const Pinned = createContext<ThemeName | null>(null);
export const ThemePin = Pinned.Provider;

/** The tokens with two answers, for a component that has to redraw when the theme changes. */
export function useTheme(): Theme {
  const live = useSyncExternalStore(subscribe, currentTheme, currentTheme);
  return themes[useContext(Pinned) ?? live];
}

/** The pick itself, for the one switch that shows it (`profile.tsx`). */
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
    return (made[name] ??= make(themes[name]));
  };
}
