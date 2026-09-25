/**
 * The library of parts — every detail of `design/spec.md` («Афиша», section 7) as React Native
 * components, and the only place a screen gets its looks from. A screen imports from `@/kit` and
 * nothing below it:
 *
 * ```tsx
 * import { AppBar, Button, CardMemory, Text } from '@/kit';
 * ```
 *
 * Values come from `@/theme`, which is the spec's tokens; every component draws in the theme the
 * app is currently in, so nothing here is dark by itself.
 *
 * Nothing here holds state of its own, fetches anything, or invents a word: every visible string is
 * a prop, because this is the look and the screens are the voice.
 */

export * from './badge';
export * from './bars';
export * from './bits';
export * from './button';
export * from './calendar';
export * from './card';
export * from './card-memory';
export * from './card-montage';
export * from './chip';
export * from './choice';
export * from './confirm';
export * from './cover';
export * from './daymark';
export * from './empty';
export * from './field';
export * from './filmstrip';
export * from './icon';
export * from './interaction';
export * from './label';
export * from './member';
export * from './menu';
export * from './montage-live';
export * from './montage-order';
export * from './palette';
export * from './rows';
export * from './segment';
export * from './sheet';
export * from './slider';
export * from './text';
export * from './tile';
export * from './toggle';
export * from './upload';
