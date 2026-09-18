import { createElement } from 'react';
import { View } from 'react-native';
import { vi } from 'vitest';

/**
 * The native modules the library reaches for, stood in for once instead of at the top of twenty
 * test files. Every one of these is a native module: node cannot parse any of them, so a component
 * that touches one will not even import without this.
 *
 * None of them is what a test here is about. These tests render a component to a string through
 * `react-native-web` and read the markup: what shape a part came out, what colour it is drawn in,
 * which state it is showing. What the phone's own Image does with a `ph://` reference, and what a
 * Lucide glyph looks like as SVG, are outside anything node can see and belong to the pilot.
 */

// The theme reads the stored pick at import; the keychain only has to answer.
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

// Photos and posters. `expo-image` and not React Native's own — `kit/tile.tsx` says why. It stands
// in as a plain view wearing the same style, so what a part does *to* a picture — dimming a dropped
// frame, rounding a thumbnail — is still there to be read off the markup.
vi.mock('expo-image', () => ({
  Image: ({ style }: { style?: unknown }) =>
    createElement(View, { style, testID: 'image' } as never),
}));

/**
 * One glyph, drawn as the bare `<svg>` a real Lucide icon comes out as — carrying the four things
 * `kit/icon.tsx` sets on it and nothing else. It has to draw *something*: a stub returning `null`
 * makes a button with a glyph and a button without one render identically, and a story that cannot
 * tell those apart is not watching the thing it was written for.
 */
const glyph = ({
  size,
  color,
  strokeWidth,
  fill,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) => createElement('svg', { 'data-glyph': '', width: size, height: size, stroke: color, strokeWidth, fill });

// Every glyph in the set, without naming them one by one: a test that had to list the icons a
// component happens to import would break every time one of them changed. Only the capitalised
// names answer — `default`, `__esModule` and the symbols vitest itself looks for have to come back
// undefined, or the module reads as something other than a bag of components.
vi.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      {
        get: (target, key) =>
          typeof key === 'string' && /^[A-Z]/.test(key) ? glyph : Reflect.get(target, key),
        // Vitest checks a mocked module actually carries the name a file imports before it hands
        // it over, so the bag has to admit to holding them as well as answering for them.
        has: (target, key) =>
          (typeof key === 'string' && /^[A-Z]/.test(key)) || Reflect.has(target, key),
      },
    ),
);

// The sheet shuts itself when the screen under it loses focus; nothing here mounts a router.
vi.mock('expo-router', () => ({ useFocusEffect: () => {} }));

/**
 * `Modal` puts its children through a portal, and a portal needs a document — so a sheet rendered
 * to a string comes out empty and every story about one would be a story about nothing. Here it is
 * the plain container it is on a phone: what is inside when it is up, nothing when it is not.
 */
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});

// The bar and the bottom layer both pad themselves off the phone's own insets.
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
