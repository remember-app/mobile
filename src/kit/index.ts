/**
 * The kit — every component of `design/kit.html` (sections 2–14) as one React Native library, and
 * the only place a screen gets its looks from. A screen imports from `@/kit` and nothing below it:
 *
 * ```tsx
 * import { AppBar, Button, CardMemory, Text } from '@/kit';
 * ```
 *
 * Component and prop names echo the kit's own class names — `CardMemory` is `.card-memory`, `sm` is
 * `.btn-sm`, `tone="error"` is `.banner-error` — so a screen can be held up against the kit and
 * read off line by line. Values come from `@/theme`, which is the kit's tokens; the handful of
 * shades the kit writes inline live in `./shades`.
 *
 * Nothing here holds state of its own, fetches anything, or invents a word: every visible string is
 * a prop, because the kit is the look and the screens are the voice.
 */

export * from './banner';
export * from './bars';
export * from './button';
export * from './card-memory';
export * from './card-montage';
export * from './confirm';
export * from './empty';
export * from './field';
export * from './icon';
export * from './interaction';
export * from './member';
export * from './shades';
export * from './text';
export * from './tile';
export * from './upload';
