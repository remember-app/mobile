/**
 * The half of the tokens that has two answers — `design/spec.md` sections 2 and 6. A token's name is
 * its role and never its shade, which is what lets «Ночь» and «День» be the same sheet of names with
 * different values under them; the shadow each one casts comes with it, because light falls the way
 * the surface it falls on is lit.
 *
 * These are read through `useTheme()` / `themed()` and never imported by a component directly.
 */
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
  /** a row lit inside a card, a step short of `raise` — the recognising line of `Consent` */
  raiseSoft: string;
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
  /** the fill of «часть 2» in the journal — «Собирается» lies on a poster and is `photo`'s */
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
  // Spec 8, `Consent`.
  raiseSoft: '#1A1A24',
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
  failedSoft: 'rgba(206,48,40,0.16)',
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
  // The night's step sits a third of the way from the card to `raise`; on a white card that third is
  // a tint nobody sees, so the day's lit row takes `raise` whole.
  raiseSoft: '#F7F4EC',
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
  sparkInk: '#16180A',
  danger: '#D93A3A',
  // The spec's `dangerTextOnLight` — the day's danger is too bright to be read at 13px.
  dangerText: '#A82C2C',
  dangerFill: '#CE3028',
  onFill: '#FFFFFF',
  dashed: '#D3CCBB',
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
};

const shadow: Record<'dark' | 'light', Shadow> = {
  // The night has no card shadows at all — a surface rises by getting lighter.
  dark: {
    card: 'none',
    cardLarge: 'none',
    primary: '0 12px 32px rgba(75,91,255,0.38)',
    round: '0 6px 18px rgba(75,91,255,0.40)',
  },
  light: {
    card: '0 2px 10px rgba(28,24,14,0.05)',
    cardLarge: '0 6px 20px rgba(28,24,14,0.10)',
    primary: '0 12px 28px rgba(59,63,224,0.28)',
    // The day's accent shadow is the softer one, by the same rule the main button follows.
    round: '0 6px 16px rgba(59,63,224,0.30)',
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
 * The night's colours as a fixed set, for what stands on a photograph or on glass. Those layers are
 * dark in both themes (spec 2), so the paper and the muted read on them are the night's whichever
 * theme the app is in. A subtree gets the same through `<ThemePin value="dark">`; this is for the
 * one colour a component works out for itself.
 */
export const night: Color = dark;

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
  return [
    '#FFB547',
    '#FF7A9C',
    '#FF5A5A',
    '#4BD6A0',
    '#4FB3FF',
    '#8A7CFF',
    color.spark,
    color.muted,
  ];
}
