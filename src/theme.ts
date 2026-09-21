import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { Appearance, StyleSheet, type ColorSchemeName, type TextStyle } from 'react-native';

/**
 * The tokens of «Афиша» — `design/spec.md` in the product repo, sections 2–4 and 6. That file is the
 * single source of design truth and this one is its only translation: a token there is a token here
 * under the same name and the same value. Nothing here computes or derives, it only names.
 *
 * The spec's rule is that a token's name is its role and never its shade, so any theme is built by
 * substitution — which is exactly what the two sets below are. Rhythm, radii, type and motion are
 * shared and know nothing about the theme; only colour and the light it casts have two answers, and
 * those are asked for through `useTheme()` / `themed()`.
 *
 * React Native has no custom properties, so a component reads these and puts them in its own
 * `StyleSheet.create`.
 */

/* ── Shared ─────────────────────────────────────────────────────────────── */

/** Rhythm, step of 4 (spec 4). Screen margin is `s4`; an empty state opens out to `s7`–40. */
export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32, s8: 48 } as const;

/**
 * Radii by role (spec 4). The layout has more of them than a scale would allow, because each one
 * belongs to a thing: a tile in the grid is nearly sharp, a sheet's top corners are the softest
 * curve in the product.
 */
export const radius = {
  /** tile in the grid, filmstrip neighbour */
  tile: 4,
  /** thumbnail of a file in the upload queue */
  queue: 10,
  /** thumbnail in a sheet, 38 icon square */
  thumb: 12,
  /** the strip of frames inside an ordinary card, a 64 thumbnail */
  strip: 14,
  /** code cell, search field, connection banner, sheet action row, 52/56 icon square */
  cell: 16,
  /** field on a screen, queue row, hint plate, onboarding photo */
  field: 18,
  /** tall field (60), section card, order summary, textarea */
  section: 20,
  /** ordinary card, montage card, message card, progress block */
  card: 22,
  /** large memory card */
  cover: 26,
  /** top corners of a sheet */
  sheet: 28,
  /** everything pill-shaped: buttons, chips, segments, badges, avatars, progress bars */
  pill: 999,
} as const;

/**
 * Heights (spec 4). Named by the thing rather than the number, because the layout reuses one height
 * for several roles and changing one of them must not move the others.
 */
export const height = {
  /** the one main action of a screen */
  primary: 56,
  /** a button inside a sheet, or the secondary one under a main */
  sheetButton: 52,
  /** «Выйти из аккаунта» — the only 60 */
  logout: 60,
  /** secondary button in a card, small button with a label */
  small: 44,
  /** small button standing in a row — «Вернуть», «Отдать ещё» */
  rowButton: 40,
  /** round button at the bottom of the gallery */
  round: 56,
  /** round button in the viewer */
  roundViewer: 48,
  /** round button in a bar */
  roundBar: 44,
  /** round button in a row: a cross, the sound. Drawn at 36, felt at `TAP` */
  roundRow: 36,
  /** «скрыть баннер». Drawn at 32, felt at `TAP` */
  roundTiny: 32,
  /** text field on a screen */
  field: 52,
  /** the taller field: e-mail, username */
  fieldTall: 60,
  /** one cell of the six-digit code */
  code: 62,
  /** segment inside a pill */
  segment: 40,
  /** segment inside the memory's own header pill */
  segmentSm: 36,
  /** a tile of the three-up grid */
  tile: 117,
  /** a member/contact row: 42 avatar and 11 above and below */
  row: 64,
  /** the header line of a screen */
  bar: 44,
  /** a chip: the filter's own height, and the tallest of the three */
  chip: 40,
  /** the quick days on `Create` */
  chipSm: 36,
  /** the journal's filter */
  chipXs: 34,
  /** the «смотрят сейчас» pill in a bar */
  watchPill: 36,
  /** the pill carrying a switch — «Сообщить, когда будет готово» */
  togglePill: 52,
} as const;

/**
 * Vertical anchors of the 390 × 844 board (spec 4). The top 52 are the device's own status line and
 * stay empty — the layout draws no fake one.
 */
export const board = {
  /** the device's status line: empty, always */
  status: 52,
  /** gap under the footer's action block */
  bottom: 30,
  /** the gradient footer under a bottom layer */
  footer: 132,
  /** the same footer when a count stands above the button */
  footerTall: 176,
  /** the footer over the gallery, where three buttons stand on a wall of photographs */
  footerGallery: 190,
  /** the footer of `Upload`, the deepest one: a block of sending stands above the button */
  footerUpload: 210,
  /** the footer of a montage on air, the shallowest: one pill and nothing else */
  footerLive: 120,
  /** the darkening over the head of the gallery, under the glass bar */
  headGallery: 176,
} as const;

/**
 * Motion (spec 6). Every one of these is an answer to something a person did or to an event that
 * arrived; nothing in the product moves by itself. All of it goes silent under «reduce motion»,
 * which `kit/interaction.ts` holds for the whole app.
 */
export const duration = {
  /** button press: scale 0.98 and back */
  press: 120,
  /** the pick circle appearing on a tile */
  pick: 140,
  /** the action menu falling out of the button it was opened from */
  menu: 160,
  /** the connection banner sliding in, and a sheet going down */
  banner: 200,
  /** a step of the wizard sliding sideways */
  step: 240,
  /** a sheet coming up */
  sheet: 260,
  /** a progress bar reaching for a new value — and never going back */
  progress: 300,
  /** one turn of the spinner */
  spin: 900,
  /** how long «Соединение установлено» stands before it leaves on its own */
  hold: 3000,
  /** how long a removed row stands there offering the way back */
  undo: 5000,
} as const;

/** The layout's `ease-out`, kept as the four control points `Easing.bezier(...ease)` wants. */
export const ease = [0, 0, 0.2, 1] as const;

/**
 * The two families, both with Cyrillic — which is the whole reason they are these two. Each weight
 * is its own family name rather than a family plus `fontWeight`: asking a single-weight loaded face
 * for a weight makes Android synthesise one instead of using it.
 */
export const font = {
  headline: 'Unbounded_700Bold',
  headlineSemi: 'Unbounded_600SemiBold',
  regular: 'Onest_400Regular',
  medium: 'Onest_500Medium',
  semi: 'Onest_600SemiBold',
  bold: 'Onest_700Bold',
} as const;

/** Figures never dance: every counter, date, timecode and «N из M» is tabular (spec 3). */
const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * The type scale (spec 3) — roles, not sizes. Tracking is the spec's em values resolved to px at
 * each size, because CSS takes a ratio and React Native takes a number. Sizes only: the colour a
 * role is read in belongs to the theme, and `kit/text.tsx` pairs the two.
 */
export const type = StyleSheet.create({
  /** «Remember» over the way in */
  hero: { fontFamily: font.headline, fontSize: 42, lineHeight: 44, letterSpacing: -1.89 },
  /** «Remember» where a block of promises has to fit under it */
  heroNarrow: { fontFamily: font.headline, fontSize: 34, lineHeight: 36, letterSpacing: -1.36 },
  /** the heading of a wizard step, the memory's name on its cover */
  display: { fontFamily: font.headline, fontSize: 26, lineHeight: 29, letterSpacing: -0.91 },
  /** «Воспоминания» on the main screen */
  displaySm: { fontFamily: font.headline, fontSize: 25, lineHeight: 28, letterSpacing: -0.75 },
  /** the heading of an empty state */
  emptyTitle: { fontFamily: font.headline, fontSize: 24, lineHeight: 28, letterSpacing: -0.84 },
  /** the heading of a sheet */
  sheetTitle: { fontFamily: font.headline, fontSize: 23, lineHeight: 26, letterSpacing: -0.69 },
  /** the heading of a confirmation sheet */
  sheetTitleSm: { fontFamily: font.headline, fontSize: 21, lineHeight: 24, letterSpacing: -0.63 },
  /** a card's name, «Кто здесь» */
  title: { fontFamily: font.headlineSemi, fontSize: 19, lineHeight: 22, letterSpacing: -0.475 },
  /** the heading of an inner bar */
  barTitle: { fontFamily: font.headlineSemi, fontSize: 18, lineHeight: 21, letterSpacing: -0.54 },
  /** the heading of the bar over a montage on air, which carries a line of meta under it */
  barTitleLive: { fontFamily: font.headlineSemi, fontSize: 17, lineHeight: 21, letterSpacing: -0.51 },
  /** «Ролики», «Кадры», «Люди» — the heading of a block, and the calendar's month */
  section: { fontFamily: font.headlineSemi, fontSize: 15, lineHeight: 18, letterSpacing: -0.3 },
  /** the memory's name inside the glass capsule over its feed */
  pillTitle: { fontFamily: font.headlineSemi, fontSize: 14, lineHeight: 17, letterSpacing: -0.28 },
  /** the length of a film, said as a poster says it */
  figure: { fontFamily: font.headline, fontSize: 34, lineHeight: 36, letterSpacing: -1.02, ...tabular },
  /** the same figure where a card holds it — the length on «Как собрать» */
  figureSm: { fontFamily: font.headline, fontSize: 30, lineHeight: 34, letterSpacing: -0.9, ...tabular },
  /** the smallest of the three — «214 просмотрел», a number that is the whole of what a tile says */
  figureTile: { fontFamily: font.headline, fontSize: 20, lineHeight: 24, letterSpacing: -0.6, ...tabular },
  /** «Отправляем», the value of the «Название» field — a name typed in the face it is printed in */
  subtitleDisplay: { fontFamily: font.headlineSemi, fontSize: 17, lineHeight: 22 },
  /** a subheading in the running text face */
  subtitle: { fontFamily: font.semi, fontSize: 17, lineHeight: 22 },
  /** a paragraph, the text of a field */
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  /** the same paragraph where it stands tighter — an empty state, a waiting caption */
  bodySm: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  /** a name in a list row, the label of a sheet action */
  row: { fontFamily: font.semi, fontSize: 15, lineHeight: 20 },
  /** the label of a button */
  control: { fontFamily: font.semi, fontSize: 16, lineHeight: 16, letterSpacing: -0.16 },
  /** the label of a segment */
  controlSm: { fontFamily: font.semi, fontSize: 14, lineHeight: 14 },
  /** the label of a chip — the same size a shade lighter, because a chip is offered and not pressed home */
  chip: { fontFamily: font.medium, fontSize: 14, lineHeight: 14 },
  /** a small button's label, a frame group's heading */
  label: { fontFamily: font.semi, fontSize: 13, lineHeight: 16 },
  /** an explanation under something — the one 13 that runs to more than a word */
  note: { fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
  /** «НАЗВАНИЕ», «ИЗ КОНТАКТОВ» */
  eyebrow: { fontFamily: font.bold, fontSize: 12, lineHeight: 14, letterSpacing: 1.2 },
  /** «ОРГАНИЗАТОР», «ГОТОВ» */
  badge: { fontFamily: font.bold, fontSize: 11, lineHeight: 13, letterSpacing: 0.66 },
  /** «Беру 0:04–0:07», «Взял 1 из 4» — the badge's size, written out rather than shouted */
  decision: { fontFamily: font.bold, fontSize: 11, lineHeight: 13, ...tabular },
  /** «ОРГАНИЗАТОР» inside a member row */
  badgeSm: { fontFamily: font.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.5 },
  /** dates, counters, timecodes */
  meta: { fontFamily: font.medium, fontSize: 12, lineHeight: 15, ...tabular },
});

/**
 * What lies on a photograph, and what is read on it. Shared by both themes on purpose (spec 2): the
 * darkening over a cover stays dark in daylight, and the text on it stays white, because it lies on
 * the picture and not on the interface.
 */
export const photo = {
  /** the cover of a memory — the layout's own four stops, top to bottom */
  cover:
    'linear-gradient(to top, rgba(7,7,13,.95) 0%, rgba(7,7,13,.78) 30%, rgba(7,7,13,.10) 62%, rgba(7,7,13,.28) 100%)',
  /** the poster of a montage — darker at the foot, where the name and the scale stand */
  poster: 'linear-gradient(to top, rgba(9,9,14,.82) 0%, rgba(9,9,14,0) 60%)',
  /**
   * The two footers that lie over photographs rather than over the screen (spec 2): the wall of
   * frames under the gallery's three buttons, and the queue under `Upload`. Dark in both themes for
   * the same reason a cover's darkening is — what is under them is the picture, not the interface.
   */
  footerGallery:
    'linear-gradient(to top, rgba(11,11,18,0.96) 0%, rgba(11,11,18,0.78) 40%, rgba(11,11,18,0) 100%)',
  footerUpload:
    'linear-gradient(to top, rgba(11,11,18,0.97) 0%, rgba(11,11,18,0.86) 45%, rgba(11,11,18,0) 100%)',
  /** The darkening over the head of the gallery, under the glass bar (spec 7.1). */
  headGallery:
    'linear-gradient(to bottom, rgba(11,11,18,0.94) 0%, rgba(11,11,18,0.72) 38%, rgba(11,11,18,0) 100%)',
  /** The glass of a bar standing over the feed — the other glass, `glass`, is the viewer's. */
  bar: 'rgba(22,22,31,0.62)',
  /** Its hairline, and the hairline of the action menu. */
  barEdge: 'rgba(255,255,255,0.09)',
  /** The glass of the action menu, which floats deeper than a bar does. */
  menu: 'rgba(30,30,40,0.86)',
  menuEdge: 'rgba(255,255,255,0.10)',
  /** The rule between two rows of that menu, and the gap before its dangerous row. */
  menuLine: 'rgba(255,255,255,0.08)',
  menuGap: 'rgba(0,0,0,0.28)',
  /** A glass button held open: the menu fell out of it and it stays lit (spec 7.1). */
  held: 'rgba(245,243,238,0.22)',
  /** the plate under a mark in the corner of a tile */
  mark: 'rgba(9,9,14,0.72)',
  /** the same plate under a reason a frame was dropped — denser, it carries smaller type */
  markStrong: 'rgba(9,9,14,0.86)',
  /** the blurred plate a whole phrase stands on over a photograph — an author, a length, a date */
  plate: 'rgba(11,11,18,0.58)',
  /** the date spine's hairline down the edge of the feed, and the tick that leaves it */
  spine: 'rgba(245,243,238,0.22)',
  /** what is read on that spine — the date in its pill, and the dot on the line */
  spineMark: 'rgba(245,243,238,0.72)',
  /** a picked tile goes down under this */
  picked: 'rgba(11,11,18,0.30)',
  /** the pick circle before anything is picked — a hole in the photograph, not a surface */
  pickOff: 'rgba(11,11,18,0.18)',
  /** its hairline */
  pickEdge: 'rgba(255,255,255,0.85)',
  /** the pick circle of a frame taken out by hand */
  pickHand: 'rgba(9,9,14,0.86)',
  /** the viewer's glass: a button over a photograph has no surface under it */
  glass: 'rgba(245,243,238,0.10)',
  /** the solid that puts out the mosaic under «Собираем ролик» */
  mosaic: 'rgba(9,9,14,0.72)',
  /** read on any of the above */
  on: '#FFFFFF',
  /** the second line read on any of the above — a date, a count, what a montage was made of */
  onQuiet: 'rgba(255,255,255,0.72)',
  /** the meta dot when it stands on a photograph */
  dot: 'rgba(255,255,255,.45)',
  /** the track of a contribution bar drawn over a cover */
  track: 'rgba(255,255,255,.22)',
  /** the viewer is darker than `ink`: the photograph is the only light thing on it */
  viewer: '#08080C',
} as const;

/** What a sheet dims the screen it interrupts down to (spec 6). The same in both themes. */
export const backdrop = 'rgba(0,0,0,0.5)';

/* ── The two sets ───────────────────────────────────────────────────────── */

/**
 * Colour by role (spec 2). Two accents in the whole product and no more: `accent` is the one main
 * action of a screen, `spark` is the organizer, «готово» and progress. Neither ever goes on decor.
 */
export type Color = {
  /** screen background */
  ink: string;
  /** card, sheet, field, header pill */
  surface: string;
  /** raised above a card: chip, avatar placeholder, unavailable button */
  raise: string;
  /** 1px border, divider */
  line: string;
  /** the border of a secondary button — louder than `line` */
  lineStrong: string;
  /** the border of a chip and of anything dashed — quieter than `lineStrong`, louder than `line` */
  lineQuiet: string;
  /** the text, and the fill of a paper button and of a chosen segment */
  paper: string;
  /** secondary text, captions, meta */
  muted: string;
  /** a note, unavailable text, a weak glyph. Never under running text — see spec 10.1 */
  faint: string;
  /** the one main action, the focus of a field, «идёт» */
  accent: string;
  /** accent as text or as a border, where the fill itself would not be read */
  accentText: string;
  /** the fill of a chosen choice-card and of the template plate — accent laid on very thin */
  accentSoft: string;
  /** the fill of the director's thought and of the stage they are on — thinner still */
  accentNote: string;
  /** the hairline round either of those two: the accent at just over a third */
  accentEdge: string;
  /** the organizer, «готово», progress, checked */
  spark: string;
  /** read on top of `spark` — dark in both themes */
  sparkInk: string;
  /** the base of danger; it lives only in the transparencies below */
  danger: string;
  /** dangerous text and a dangerous glyph */
  dangerText: string;
  /** the fill of an irreversible button */
  dangerFill: string;
  /** read on `accent` and on `dangerFill` */
  onFill: string;
  /** the dashed border of an empty frame */
  dashed: string;
  /** what lies inside a dashed block — a hole in the screen rather than a surface on it */
  hollow: string;
  /** the same hole under the round sign of an empty state */
  hollowSoft: string;
  /** a sheet's handle, a spent bar of the waveform */
  handle: string;
  /** the fill of a dangerous banner or plate */
  dangerSoft: string;
  /** the border of anything dangerous — one value everywhere (spec 10.5) */
  dangerEdge: string;
  /** the fill of the «Не собрался» badge */
  failedSoft: string;
  /** the fill of the «Собирается» badge */
  pendingSoft: string;
  /** the fill of the «связь вернулась» banner */
  sparkSoft: string;
  /** the border of that banner */
  sparkEdge: string;
};

/** «Ночь» — the theme the layout is drawn in (spec 2). */
const dark: Color = {
  ink: '#0B0B12',
  surface: '#16161F',
  raise: '#22222E',
  line: '#2C2C3A',
  lineStrong: '#45424F',
  lineQuiet: '#3A3747',
  paper: '#F5F3EE',
  muted: '#A4A1B2',
  faint: '#6E6B7D',
  accent: '#4B5BFF',
  accentText: '#A7AEFF',
  accentSoft: '#1A1C33',
  accentNote: '#14152A',
  accentEdge: 'rgba(75,91,255,0.35)',
  spark: '#E4FF4F',
  sparkInk: '#14160A',
  danger: '#FF5A5A',
  dangerText: '#FF8D8D',
  dangerFill: '#CE3028',
  onFill: '#FFFFFF',
  dashed: '#35333F',
  hollow: '#111119',
  hollowSoft: '#14141C',
  handle: '#3A3747',
  dangerSoft: 'rgba(206,48,40,0.14)',
  dangerEdge: 'rgba(206,48,40,0.45)',
  failedSoft: 'rgba(255,90,90,0.16)',
  pendingSoft: 'rgba(75,91,255,0.20)',
  sparkSoft: 'rgba(228,255,79,0.12)',
  sparkEdge: 'rgba(228,255,79,0.40)',
};

/**
 * «День» — the same layout with the values substituted (spec 2). The spec draws one screen of it,
 * `HomeDay`, and names the nine tokens it settles; the rest are that substitution carried through,
 * every pair checked against the floor in `theme.test.ts` rather than eyeballed — `muted` on `ink`
 * is 4.65 : 1 here, which is close enough to the floor that guessing the neighbours would not do.
 */
const light: Color = {
  ink: '#F2EFE7',
  surface: '#FFFFFF',
  raise: '#F7F4EC',
  line: '#E4DFD3',
  lineStrong: '#C4BCA8',
  // The same place between the two the night's `#3A3747` holds, and the day's handle already stood
  // at it — a chip's border and a sheet's handle are one value in the layout (spec 2).
  lineQuiet: '#CFC8B8',
  paper: '#15151C',
  muted: '#6C6979',
  // The mirror of the night's `faint`: 3.79 : 1 there on `ink`, 3.79 : 1 here. Decorative and
  // unavailable only — spec 10.1 keeps every readable secondary on `muted`.
  faint: '#7A7788',
  accent: '#3B3FE0',
  // On paper the accent reads as itself (6.2 : 1 on `ink`); it is the night that needs a lighter one.
  accentText: '#3B3FE0',
  // The night puts the chosen card a shade *darker* than the sheet; the day puts it a shade bluer
  // than the paper, which is the same move — the accent breathed onto the surface under it.
  accentSoft: '#ECEDFB',
  accentNote: '#F3F3FC',
  accentEdge: 'rgba(59,63,224,0.35)',
  spark: '#DCF531',
  sparkInk: '#15151C',
  danger: '#D93A3A',
  // The spec's `dangerTextOnLight` — the day's danger is too bright to be read at 13px.
  dangerText: '#A82C2C',
  dangerFill: '#CE3028',
  onFill: '#FFFFFF',
  dashed: '#D2CBBB',
  // A hole is darker than the screen at night and lighter than it in daylight — either way it is
  // the one step away from `ink` that says «nothing lives here yet».
  hollow: '#ECE8DE',
  hollowSoft: '#EFEBE2',
  handle: '#CFC8B8',
  dangerSoft: 'rgba(206,48,40,0.10)',
  dangerEdge: 'rgba(206,48,40,0.45)',
  failedSoft: 'rgba(206,48,40,0.12)',
  pendingSoft: 'rgba(59,63,224,0.14)',
  sparkSoft: 'rgba(220,245,49,0.28)',
  sparkEdge: 'rgba(200,225,40,0.60)',
};

/**
 * The second of the day's three departures from plain substitution (spec 2): in daylight a card is
 * lifted by a shadow where the night lifts it by a border, and the main button's own shadow is
 * softer. CSS strings because `boxShadow` takes that form in React Native, which keeps them
 * identical to the spec.
 */
export type Shadow = {
  card: string;
  cardLarge: string;
  primary: string;
  /** The round button held in — the shallower cousin of `primary` (spec 2). */
  round: string;
  /** The action menu, which floats higher than anything else in the product (spec 7.1). */
  menu: string;
};

const shadow: Record<'dark' | 'light', Shadow> = {
  // The night has no card shadows at all — a surface rises by getting lighter.
  dark: {
    card: 'none',
    cardLarge: 'none',
    primary: '0 12px 32px rgba(75,91,255,0.38)',
    round: '0 6px 18px rgba(75,91,255,0.40)',
    menu: '0 18px 50px rgba(0,0,0,0.55)',
  },
  light: {
    card: '0 2px 10px rgba(28,24,14,0.05)',
    cardLarge: '0 6px 20px rgba(28,24,14,0.10)',
    primary: '0 12px 28px rgba(59,63,224,0.28)',
    // The day's accent shadow is the softer one, by the same rule the main button follows.
    round: '0 6px 16px rgba(59,63,224,0.30)',
    menu: '0 18px 44px rgba(28,24,14,0.28)',
  },
};

/** Two themes, and there is no third one (doc-9). */
export type ThemeName = 'dark' | 'light';

/**
 * What a person can pick, which is one more thing than what the app draws in: `system` is not a
 * third theme but the absence of a pick — the phone goes on deciding, and the settings screen
 * offers it as «Как в телефоне».
 */
export type ThemeChoice = ThemeName | 'system';

/** Everything that has two answers, in the set the app is currently drawing in. */
export type Theme = { name: ThemeName; color: Color; shadow: Shadow };

export const themes: Record<ThemeName, Theme> = {
  dark: { name: 'dark', color: dark, shadow: shadow.dark },
  light: { name: 'light', color: light, shadow: shadow.light },
};

/**
 * The six backgrounds a face without a photograph is given (spec 2). They carry no meaning at all —
 * they are dealt out per person so that two circles side by side are two people, and that is the
 * whole of it. Shared by both themes: white initials are read on all six.
 */
export const faces = ['#5B4B8A', '#2F5E63', '#7A4B3A', '#3E5A2E', '#5A3E5E', '#3A4A6E'] as const;

/**
 * Which of the six a person gets — the same one every time, from their name, because a face that
 * changes colour between two screens is a different person to whoever is looking.
 */
export function faceOf(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum = (sum + name.charCodeAt(i)) % 4096;
  return faces[sum % faces.length];
}

/**
 * The eight colours a label can be (spec 2) — this one a person picks, so unlike the faces it is
 * offered rather than dealt. The last two are the theme's own `spark` and `muted`, which is why this
 * is a function and not a constant.
 */
export function labelColors({ color }: Theme): readonly string[] {
  return ['#FFB547', '#FF7A9C', '#FF5A5A', '#4BD6A0', '#4FB3FF', '#8A7CFF', color.spark, color.muted];
}

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
    return (made[name] ??= make(themes[name]));
  };
}
