import { StyleSheet, type TextStyle } from 'react-native';

/**
 * The tokens of «Афиша» that have one answer — `design/spec.md` in the product repo, sections 3, 4
 * and 6. Rhythm, radii, heights, type, motion and the fixed inks of a photograph know nothing about
 * which theme the app is in: substitution is what makes a theme, and there is nothing here to
 * substitute. Nothing computes or derives, it only names.
 *
 * React Native has no custom properties, so a component reads these and puts them in its own
 * `StyleSheet.create`.
 */
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
  /** `SheetSort`, the whole sheet from its top edge down */
  sheetSort: 380,
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
  /** the date spine proving while a finger moves the feed, and its slower going a second later */
  spineIn: 120,
  spineOut: 400,
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
  barTitleLive: {
    fontFamily: font.headlineSemi,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.51,
  },
  /** «Ролики», «Кадры», «Люди» — the heading of a block, and the calendar's month */
  section: { fontFamily: font.headlineSemi, fontSize: 15, lineHeight: 18, letterSpacing: -0.3 },
  /** the memory's name inside the glass capsule over its feed */
  pillTitle: { fontFamily: font.headlineSemi, fontSize: 14, lineHeight: 17, letterSpacing: -0.28 },
  /** the length of a film, said as a poster says it */
  figure: {
    fontFamily: font.headline,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.02,
    ...tabular,
  },
  /** the same figure where a card holds it — the length on «Как собрать» */
  figureSm: {
    fontFamily: font.headline,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.9,
    ...tabular,
  },
  /** the smallest of the three — «214 просмотрел», a number that is the whole of what a tile says */
  figureTile: {
    fontFamily: font.headline,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.6,
    ...tabular,
  },
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
  menuShadow: '0 18px 50px rgba(0,0,0,0.55)',
  /** The rule between two rows of that menu, and the gap before its dangerous row. */
  menuLine: 'rgba(255,255,255,0.08)',
  menuGap: 'rgba(0,0,0,0.28)',
  /** A glass button held open: the menu fell out of it and it stays lit (spec 7.1). */
  held: 'rgba(245,243,238,0.22)',
  /** the plate under a mark in the corner of a tile */
  mark: 'rgba(9,9,14,0.72)',
  /** the same plate under a reason a frame was dropped — denser, it carries smaller type */
  markStrong: 'rgba(9,9,14,0.86)',
  /** the plate a whole phrase stands on over a photograph — an author, a length, a date */
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
