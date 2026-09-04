import { StyleSheet } from 'react-native';

/**
 * The «Тёмная комната» kit, carried over from `design/kit.html` in the product repo — that file is
 * the single source of design truth and this one is its only translation. Names and values match it
 * one for one: a CSS custom property `--ember` is `color.ember` here, `--s4` is `space.s4`. When the
 * kit changes, this file changes with it and nothing else has to.
 *
 * React Native has no custom properties, so screens import these and put them in their own
 * `StyleSheet.create`. Nothing here computes or derives — it only names.
 */

/**
 * Colour. Four steps of darkness instead of shadows, plus what is read and what signals.
 * `ember` belongs to exactly one element per screen; if there are two, one of them is not the
 * main one.
 */
export const color = {
  ink: '#14110F', // screen background
  surface: '#1E1A17', // raised surface: card, field, sheet
  raise: '#262019', // surface on a surface: chip, hover, press
  line: '#332C27', // hairline, frame border
  paper: '#F2ECE3', // text and everything that gets read
  muted: '#8A7F74', // secondary text, captions, disabled
  ember: '#E4552B', // signal: main action, focus, progress
  fixed: '#7BA05B', // developed: done, uploaded, montage ready
  rust: '#7E2B1D', // failure: error bar, irreversible action
} as const;

/**
 * Light. A darkroom has no shadows — it has a hairline and the glow of a safelight, and the glow
 * goes to exactly one element per screen. A CSS shadow string because RN 0.76+ takes `boxShadow`
 * in that form, which keeps it identical to the kit.
 */
export const glow = '0 0 0 1px rgba(228,85,43,.30), 0 10px 34px -14px rgba(228,85,43,.60)';

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

/** The kit's six type roles — roles, not sizes. Line heights are the kit's ratios resolved to px. */
export const type = StyleSheet.create({
  display: { fontFamily: font.display, fontSize: 32, lineHeight: 33.6, letterSpacing: -0.64 },
  title: { fontFamily: font.display, fontSize: 22, lineHeight: 26.4, letterSpacing: -0.22 },
  subtitle: { fontSize: 17, lineHeight: 22.1, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23.2, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 16.8, fontWeight: '500' },
  // Figures are tabular everywhere in the kit, so dates and counters do not dance.
  meta: {
    fontSize: 13,
    lineHeight: 15.6,
    fontWeight: '500',
    color: color.muted,
    fontVariant: ['tabular-nums'],
  },
});
