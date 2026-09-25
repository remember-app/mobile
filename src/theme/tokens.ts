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
  /** field on a screen, queue row, hint plate, onboarding photo, day tile in the filter */
  field: 18,
  /** tall field (60), section card, order summary, textarea */
  section: 20,
  /** ordinary card, montage card, message card, progress block */
  card: 22,
  /** large memory card; the cards of `Account` — the profile, «Контакты», «Галерея» */
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
  /** the quiet one under the main in a sheet — «Позже», «Оставить как есть» */
  quietSheet: 48,
  /** small button standing in a row — «Вернуть», «Отдать ещё» */
  rowButton: 40,
  /** round button at the bottom of the gallery */
  round: 56,
  /** round button in the viewer */
  roundViewer: 48,
  /** round button in a bar */
  roundBar: 44,
  /** «Послушать» in a track row on the shelf — 36 in «Выбрано», where it is `roundRow` */
  roundTrack: 40,
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
  /** a tile of the three-up grid */
  tile: 117,
  /** a member/contact row: 42 avatar and 11 above and below */
  row: 64,
  /** the header line of a screen */
  bar: 44,
  /**
   * The heading line of «Ролики» over its strip (`MemoryFrames`, `FilmsEmpty`): 24, and the strip
   * 10 under it — «Кадры» over the frames has no such floor. A floor: grown type makes it taller.
   */
  filmsHead: 24,
  /** a chip: the filter's own height, and the tallest of the three */
  chip: 40,
  /** the quick days on `Create` */
  chipSm: 36,
  /** the journal's filter */
  chipXs: 34,
  /** «Все дни» and the calendar in the head of the filter's day block. Drawn at 28, felt at `TAP` */
  chipTag: 28,
  /** a face in «Кто принёс» */
  face: 48,
  /** a day tile in the filter */
  dayTile: 86,
  /**
   * The «смотрят сейчас» pill in a bar. The spec's 36 is the layout's CSS box inside a 1px hairline,
   * and a box here counts its border in — drawn, the layout's pill is 38 (`MontageLive`).
   */
  watchPill: 38,
  /**
   * The sheets (spec 4, «Высоты листов»), each from its top edge down — a floor and not a cap: a
   * sheet holding more grows to hold it. `SheetSort` and `SheetConfirmMemory` are what their
   * content comes to (381 and 434), because the drawn 380 and 430 squeeze the handle and a button.
   */
  sheetConfirmDelete: 380,
  sheetSort: 381,
  sheetConfirmMember: 420,
  sheetConfirmMemory: 434,
  sheetFilter: 560,
} as const;

/**
 * The spinner's ring, outer edge to outer edge (spec 7.9, detail 70). The spec's 38 and 34 are the
 * layout's CSS box inside a 3px ring, and a ring here counts its border in — drawn, the layout's are
 * 44 and 40 (`HomeLoading`, `InviteJoining`). The small ones stay as written: the layout draws its
 * 16 border-box already (`MemoryFrames`), and has no 26 to measure.
 */
export const spinner = { tile: 16, card: 26, join: 40, screen: 44 } as const;

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
  /**
   * Where the body starts under an inner bar, from the top of the board: `MemorySettings` (and
   * `MemoryEdit`) at 112, `Create` at 124, `Account` — its card pushed off the bar — at 132. The
   * status line is the phone's own, so a screen pads by what lies under `status` and the bar's 44.
   */
  bodySettings: 112,
  bodyCreate: 124,
  bodyAccount: 132,
  /**
   * The `Upload*` faces with no glass over them, under the bar with a subtitle (spec 4: 124) — and
   * the message card of `UploadAccess`, which the layout stands lower still, at 132.
   */
  bodyUpload: 124,
  bodyUploadCard: 132,
} as const;

/**
 * What «Ваши кадры» draws between its blocks off the rhythm of 4 (spec 8, `UploadQueue` and
 * `UploadLimited`) — measured off the layout, the way `wizardLead` is.
 */
export const uploadGaps = {
  /** under «НЕ УШЛИ», and between the parked files under it */
  parked: 10,
  /** from the last strip of a day down to the plate saying the rest of it is unseen */
  unseen: 22,
} as const;

/**
 * How far a wizard step's body stands under its heading (spec 4: «190–238 — тело шага мастера»,
 * «150 — тело итога заказа»). The layout pins each body at an anchor of its own; the app lays the
 * heading out in flow and the body under it, so each anchor is kept as the gap under whatever the
 * heading ends with — measured off the layout, step by step.
 */
export const wizardLead = {
  /** under the heading and the line under it — `MontageTemplate` (190), `MontageStory` (238) */
  note: 22,
  /** `MontageMusic*`: the same line over it, and its body at 206 (spec 8, «тело от 206») */
  music: 19,
  /** under a heading with no line — `MontageBuild` (190) */
  title: 32,
  /** under the total's heading, which has no scale over it — `MontageSummary` (150) */
  total: 13,
} as const;

/**
 * The foot of the frame window (spec 8, `Viewer` / `ViewerVideo`; spec 7.10): the gaps between the
 * picture, the scrubber a video carries and the 48 strip, which stands `board.bottom` off the edge.
 * Measured off the layout — a photograph ends 96 above the bottom, a video 140 (704 of 844).
 */
export const viewerFoot = {
  /** from the foot of a photograph down to the strip */
  photo: 18,
  /** from the foot of a video down to its scrubber */
  video: 12,
  /** from the scrubber down to the strip */
  track: 14,
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
  /** «Remember» over the spinner of a link being walked in (`InviteJoining`) — its own role */
  heroSm: { fontFamily: font.headline, fontSize: 30, lineHeight: 32, letterSpacing: -1.35 },
  /** the heading of a wizard step */
  display: { fontFamily: font.headline, fontSize: 26, lineHeight: 29, letterSpacing: -0.91 },
  /** the memory's name on its cover — the heading's size a hair looser, −0.03em */
  displayCover: { fontFamily: font.headline, fontSize: 26, lineHeight: 29, letterSpacing: -0.78 },
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
  /** the memory's name on the card of its settings — the card's name a size down, whole */
  titleSm: { fontFamily: font.headlineSemi, fontSize: 17, lineHeight: 21, letterSpacing: -0.425 },
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
  /** the figure of a day on its tile in the filter — the same number two points tighter */
  figureDay: {
    fontFamily: font.headline,
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: -0.6,
    ...tabular,
  },
  /**
   * The spec's `subtitle`: «Отправляем», the value of the «Название» field — a name typed in the
   * face it is printed in
   */
  subtitleDisplay: {
    fontFamily: font.headlineSemi,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.34,
  },
  /** the same size in the running text face — «8 человек» on `Account` */
  subtitle: { fontFamily: font.semi, fontSize: 17, lineHeight: 22 },
  /** a paragraph, the text of a field */
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  /** the same paragraph where it stands tighter — an empty state, a waiting caption */
  bodySm: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  /**
   * the paragraph a size down again — a line of the card of promises on `Consent`, the report under
   * the heading of `SheetRejected` («68 кадров из 486…») (spec 8)
   */
  bodyXs: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  /** a name in a list row */
  row: { fontFamily: font.semi, fontSize: 15, lineHeight: 20 },
  /**
   * the row's size a weight down (spec 3, «подпись действия меню 15 / 500»): an action in the glass
   * menu, the words beside a switch
   */
  rowPlain: { fontFamily: font.medium, fontSize: 15, lineHeight: 20 },
  /** the value of a summary row — «IMG_4471.HEIC · 4,2 МБ» (spec 7.7, detail 52) */
  summary: { fontFamily: font.medium, fontSize: 14, lineHeight: 18, ...tabular },
  /**
   * a name in a tighter row — a stage of the build (spec 7.7, detail 56), a file on its sheet
   * (`SheetLiveFile`), «12 файлов ушли…»; the days picked beside «КОГДА ЭТО БЫЛО». 18 is Onest's own
   * line at 14: on a shorter one iOS sets the figures 3–4 higher than the layout does.
   */
  rowSm: { fontFamily: font.semi, fontSize: 14, lineHeight: 18 },
  /** the label of a button */
  control: { fontFamily: font.semi, fontSize: 16, lineHeight: 16, letterSpacing: -0.16 },
  /** «Выйти из аккаунта» — the label of the one 60, a size over every other button's */
  controlLg: { fontFamily: font.semi, fontSize: 17, lineHeight: 17, letterSpacing: -0.17 },
  /** the label of a segment */
  controlSm: { fontFamily: font.semi, fontSize: 14, lineHeight: 14 },
  /** «Разрешить доступ» — the 52 of the message card (spec 7.6, detail 45: 15 / 600) */
  controlMd: { fontFamily: font.semi, fontSize: 15, lineHeight: 15 },
  /** the label of a chip — the same size a shade lighter, because a chip is offered and not pressed home */
  chip: { fontFamily: font.medium, fontSize: 14, lineHeight: 14 },
  /**
   * «Все дни» in the head of the filter's day block — the smallest chip, and a heavier one; the
   * plate over the story on `MontageStory` is the same 12 / 600
   */
  chipXs: { fontFamily: font.semi, fontSize: 12, lineHeight: 12 },
  /** a template's name on its tile (spec 7.6, detail 41) — the one 14 in the bold weight */
  tileTitle: { fontFamily: font.bold, fontSize: 14, lineHeight: 17 },
  /** a small button's label, a frame group's heading, a button standing in a row, the journal's chip */
  label: { fontFamily: font.semi, fontSize: 13, lineHeight: 16 },
  /** an explanation under something — the one 13 that runs to more than a word */
  note: { fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
  /** the director's thought, in its plate and in a record of the journal (spec 3, 10.11: 13 / 400 / 18) */
  log: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  /** the words of a connection banner: the note's size a line tighter (spec 7.6, detail 47) */
  banner: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  /** the same explanation a size down and plain — «Без согласия зарегистрироваться нельзя.» */
  noteSm: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
  /** «Один день — одно касание…» under the calendar — the same plain 12 on the looser line of 17 */
  aside: { fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  /** words quoted back: the story in the summary of an order, four lines of it (spec 7.6, detail 43) */
  quote: { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  /** «НАЗВАНИЕ», «ИЗ КОНТАКТОВ» — on the line the layout gives every eyebrow, Onest's own at 12 */
  eyebrow: { fontFamily: font.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  /** «ОРГАНИЗАТОР», «ГОТОВ» */
  badge: { fontFamily: font.bold, fontSize: 11, lineHeight: 13, letterSpacing: 0.66 },
  /** «Беру 0:04–0:07», «Взял 1 из 4» — the badge's size, written out rather than shouted */
  decision: { fontFamily: font.bold, fontSize: 11, lineHeight: 13, ...tabular },
  /** «ГОТОВ» and «СОБИРАЕТСЯ» on a card in the strip — spec 3, `badge малый`: 0.06em in caps */
  badgeSm: { fontFamily: font.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.6 },
  /**
   * A video's running time in the corner of a journal's thumbnail, 34 or 62 — 9 / 700 and untracked
   * (spec detail 56, `MontageLive`, `MontageLiveStage`)
   */
  runtimeXs: { fontFamily: font.bold, fontSize: 9, lineHeight: 12, ...tabular },
  /** The words of a day gap — «13 сентября, суббота», a person's name (spec 3, `day`: 0.03em) */
  day: { fontFamily: font.semi, fontSize: 10, lineHeight: 12, letterSpacing: 0.3, ...tabular },
  /** The count beside those words — «61», «128»: the same 10 / 12 a weight down, untracked (spec 3, `day`) */
  dayCount: { fontFamily: font.medium, fontSize: 10, lineHeight: 12, ...tabular },
  /** «Новый / ролик» under the plus of the dashed tile (spec 7.6, detail 39) */
  caption: { fontFamily: font.semi, fontSize: 12, lineHeight: 15 },
  /** dates, counters */
  meta: { fontFamily: font.medium, fontSize: 12, lineHeight: 15, ...tabular },
  /**
   * The meta a size down (spec 3: meta is 11–12) — under a template's name, beside the poster's
   * shape, under a stage's name, at the two ends of the length line, under a number tile
   */
  metaSm: { fontFamily: font.medium, fontSize: 11, lineHeight: 14, ...tabular },
  /**
   * The meta's size a weight up: the two timecodes of a video (spec 7.10), «Этап 3 из 5», the way
   * into a stage's journal and where a frame lay in the film (spec 7.6).
   */
  timecode: { fontFamily: font.semi, fontSize: 12, lineHeight: 15, ...tabular },
  /**
   * A meta line a size down and a weight up: «сб» and «312 кадров» on a day tile, the author's plate
   * on the frame in hand (spec detail 49)
   */
  metaTile: { fontFamily: font.semi, fontSize: 11, lineHeight: 13, ...tabular },
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
  /** the large poster of a finished film (`MontageLiveDone`): no name on it, so lighter at the top */
  posterLarge: 'linear-gradient(to top, rgba(9,9,14,.80) 0%, rgba(9,9,14,.05) 60%)',
  /** the poster of the film being ordered, on the summary */
  posterOrder: 'linear-gradient(to top, rgba(9,9,14,.90) 10%, rgba(9,9,14,.10) 70%)',
  /** a template's tile: its frame well under the words */
  template: 'linear-gradient(to top, rgba(11,11,18,.94) 20%, rgba(11,11,18,.35) 100%)',
  /** the top of the frame in hand on the card «Сейчас», where the author and «СЕЙЧАС» stand */
  now: 'linear-gradient(to bottom, rgba(9,9,14,.55) 0%, rgba(9,9,14,0) 40%)',
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
  /** «СОБИРАЕТСЯ» on the poster of a montage being cut, and the words on it (spec 2, detail 24) */
  pending: 'rgba(75,91,255,0.28)',
  pendingInk: '#C9CDFF',
  /** the plate under a mark in the corner of a tile */
  mark: 'rgba(9,9,14,0.72)',
  /** the same plate under a reason a frame was dropped — denser, it carries smaller type */
  markStrong: 'rgba(9,9,14,0.86)',
  /**
   * The plate a whole phrase stands on over a photograph. Two values and not a range (spec 2): this
   * one under the author and «СЕЙЧАС» on the card «Сейчас» and under the template on the poster of
   * the summary…
   */
  plate: 'rgba(11,11,18,0.60)',
  /** …and the quieter one under «3:00 · 16:9» on a template's tile and under a date on the spine */
  plateQuiet: 'rgba(11,11,18,0.55)',
  /** the date spine's hairline down the edge of the feed — the line and nothing else */
  spine: 'rgba(245,243,238,0.22)',
  /** the tick from a date's pill to that line, brighter than the line… */
  spineTick: 'rgba(245,243,238,0.35)',
  /** …and the dot where it meets it, brighter than the tick */
  spineDot: 'rgba(245,243,238,0.6)',
  /** the date read in the pill on that spine */
  spineMark: 'rgba(245,243,238,0.72)',
  /** a picked tile goes down under this in the feed… */
  picked: 'rgba(11,11,18,0.30)',
  /** …and a shade less under the `accent` ring of the 117 grid (spec 2, 10.11) */
  pickedRing: 'rgba(11,11,18,0.28)',
  /** the pick circle before anything is picked — a hole in the photograph, not a surface */
  pickOff: 'rgba(11,11,18,0.18)',
  /** its hairline */
  pickEdge: 'rgba(255,255,255,0.85)',
  /** the pick circle of a frame taken out by hand */
  pickHand: 'rgba(9,9,14,0.86)',
  /** the viewer's glass: a button over a photograph has no surface under it */
  glass: 'rgba(245,243,238,0.10)',
  /** the track of a video's scrubber, what is still to play (spec 7.10) */
  videoTrack: 'rgba(245,243,238,0.24)',
  /**
   * Under «Пауза» in the middle of a playing video (spec 7.2): dark and not glass, because the
   * viewer's glass vanishes over a bright frame and this has to hold its glyph over any.
   */
  video: 'rgba(6,6,10,0.5)',
  /** read on any of the above */
  on: '#FFFFFF',
  /** the second line read on any of the above — a date, a count, what a montage was made of */
  onQuiet: 'rgba(255,255,255,0.72)',
  /**
   * The second voice of the viewer: the lower line of its pill — «21:47 · Марк Ковалёв» (spec 7.1,
   * detail 5) — and a video's whole length beside the scrubber (spec 7.10)
   */
  viewerMeta: 'rgba(245,243,238,0.66)',
  /** the meta dot when it stands on a photograph */
  dot: 'rgba(255,255,255,.45)',
  /** the track of a contribution bar drawn over a cover */
  track: 'rgba(255,255,255,.22)',
  /** the viewer is darker than `ink`: the photograph is the only light thing on it */
  viewer: '#08080C',
} as const;

/** What a sheet dims the screen it interrupts down to (spec 6). The same in both themes. */
export const backdrop = 'rgba(0,0,0,0.5)';
