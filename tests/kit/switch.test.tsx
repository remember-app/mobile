import { expect, test } from 'vitest';

/**
 * Spec 7.3, detail 17: the switch is 52 × 32 with a 26 grip, and the kit draws it itself
 * (`kit/toggle.tsx`, TASK-387). The platform's own `Switch` is whatever the system makes it — 63 × 28
 * with a pill of a grip on iOS 26, which is how «Даты между днями» on `Account` came out unlike the
 * layout — and on the web it painted its grip Material teal unless handed a colour prop React Native
 * does not even type (TASK-56).
 *
 * Swept over the sources rather than named screen by screen: what brings it back is not today's
 * switches, it is the next one written from memory of how a switch is done in React Native.
 */
const sources = Object.entries(
  import.meta.glob<string>('@/{app,screens,kit}/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

test.each(sources)('%s draws no platform switch', (_path, source) => {
  expect(source).not.toMatch(/import\s*{[^}]*\bSwitch\b[^}]*}\s*from\s*'react-native'/);
});
