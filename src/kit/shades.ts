/**
 * The shades the kit writes straight into a rule instead of naming as a token: a hover step, the ink
 * that reads on ember, rust and fixed at partial alpha. They are not in `theme.ts` because the kit
 * does not name them either — but the same `#E98C7A` appears in five different components, so it is
 * spelled out once here and read from the kit rule quoted beside it.
 */
export const shade = {
  /** Text and icons on an ember fill — `.btn-primary`, `.tile__check`, `.card-montage__play`. */
  onEmber: '#1A0B05',
  /** `.btn-primary:hover` */
  emberHover: '#EF6136',
  /** One step up from `line` on hover — `.btn-secondary:hover`, `.input:hover`, `.card-memory:hover`. */
  lineHover: '#453B34',
  /** Rust lightened to stay readable — `.btn-danger`, `.field-error .field-hint`, `.tile--failed .tile__state`, `.banner-error .ico`, `.status-failed`. */
  danger: '#E98C7A',
  /** `.btn-danger`, `.tile--failed`, `.banner-error` borders */
  dangerLine: 'rgba(126,43,29,.9)',
  /** `.btn-danger:hover` */
  dangerHover: 'rgba(126,43,29,.35)',
  /** `.tile--failed` background */
  dangerTile: 'rgba(126,43,29,.18)',
  /** `.banner-error` background */
  dangerBanner: 'rgba(126,43,29,.22)',
  /** `.field-error .input` */
  errorLine: '#B0492F',
  /** `.field-ok .input` */
  fixedLine: 'rgba(123,160,91,.7)',
  /** `.banner-done` */
  fixedBanner: 'rgba(123,160,91,.5)',
  /** `.chip-organizer` */
  organizerLine: 'rgba(228,85,43,.55)',
  /** The dots punched down the side of a memory card — `.rail`. */
  perforation: '#4A403A',
  /** Ink you can read through: the duration pill on a frame (`.tile__duration`) and, at the same
   *  weight, what a confirm sheet lays over the screen it interrupts. */
  scrim: 'rgba(20,17,15,.78)',
} as const;
