/**
 * The kit's second tier of colour: the line under a finger, the perforation, and — for each of the
 * three meaning colours — what is read on top of it and what it tints a surface with. The kit names
 * every one of these now (`--on-ember`, `--rust-fill`), so they are named here too, one for one, in
 * a set per theme. Their own tier because from theme to theme they walk in opposite directions: on
 * charcoal a meaning colour is mixed with light, on paper with shadow.
 *
 * `theme.ts` is what puts these together with the colours proper; nothing outside it reads `shades`
 * directly — a component asks `themed()` for the set the app is drawing in.
 */
export type Shade = {
  /** The hairline under a finger — `.btn-secondary:hover`, `.input:hover`, `.card-memory:hover`. */
  lineHi: string;
  /** Film perforation — `.rail`, `.rail-h`. */
  perf: string;
  /** Read on an ember fill — `.btn-primary`, `.tile__check`, `.card-montage__play`. */
  onEmber: string;
  /** `.btn-primary:hover` */
  emberHi: string;
  /** A border marked with the signal — `.chip-organizer`. */
  emberLine: string;
  /** `.field-ok .input`, `.banner-done` */
  fixedLine: string;
  /** Read on a solid rust — `.btn-danger-solid`. */
  onRust: string;
  /** Rust itself is unreadable as text; this is what is read instead — `.btn-danger`,
   *  `.field-error`, `.tile--failed .tile__state`, `.banner-error .ico`, `.status-failed`. */
  rustText: string;
  /** `.btn-danger`, `.tile--failed`, `.banner-error` borders */
  rustLine: string;
  /** The tinted surface of a failure — `.tile--failed`, `.banner-error`. */
  rustFill: string;
  /** `.btn-danger:hover` */
  rustFillHi: string;
};

/** The kit's two sets, block 0.2 and block 0.3. */
export const shades: { dark: Shade; light: Shade } = {
  dark: {
    lineHi: '#453B34',
    perf: '#4A403A',
    onEmber: '#1A0B05',
    emberHi: '#EF6136',
    emberLine: 'rgba(228,85,43,.55)',
    fixedLine: 'rgba(123,160,91,.55)',
    onRust: '#F2ECE3',
    rustText: '#E98C7A',
    rustLine: 'rgba(126,43,29,.9)',
    rustFill: 'rgba(126,43,29,.20)',
    rustFillHi: 'rgba(126,43,29,.35)',
  },
  light: {
    lineHi: '#C0AF99',
    perf: '#CFC0AB',
    onEmber: '#FBF7F1',
    emberHi: '#A33314',
    emberLine: 'rgba(184,60,25,.5)',
    fixedLine: 'rgba(76,112,56,.5)',
    onRust: '#F2ECE3',
    rustText: '#86301E',
    rustLine: 'rgba(134,48,30,.5)',
    rustFill: 'rgba(134,48,30,.14)',
    rustFillHi: 'rgba(134,48,30,.24)',
  },
};

/**
 * The one shade a screen still reads off a fixed dark set, under the name it had before the kit
 * named it: `create.tsx` draws its date trigger with it. TASK-89 moves the screens onto the live
 * theme and takes this with it.
 */
export const shade = { lineHover: shades.dark.lineHi } as const;
