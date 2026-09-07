import { renderToStaticMarkup } from 'react-dom/server';
import { Switch } from 'react-native';
import { expect, test, vi } from 'vitest';

import { themes } from '@/theme';

// `@/theme` reads the stored pick on import and `expo-secure-store` is native. Nothing below asks
// it anything — the colours are read off `themes` by name — so the store only has to be there.
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

/**
 * The switch is the platform's, and on the web the platform hands out a colour of its own: the grip
 * comes from `activeThumbColor` while the switch is on and from `thumbColor` only while it is off,
 * so `thumbColor` alone buys paper on one half of the switch and Material teal `#009688` on the
 * other. `switch.d.ts` has the rest of the why.
 *
 * The way it broke is the reason it is pinned: nothing about it looks conditional at the call site.
 * The screen that showed it and the screen that did not were passing the very same props — the one
 * in the invite sheet just starts on, so it was the one anybody saw.
 *
 * Rendered through `react-native-web` (the alias lives in `vitest.config.mjs`), which is the same
 * code that draws it in a browser and writes its colours out as `rgba`. What a phone's own switch
 * does with them is native and the pilot's to check.
 */

const { color } = themes.dark;

/** The switch as the screens hand it over, in whichever position and state is being looked at. */
function grip(value: boolean, disabled: boolean): string {
  return renderToStaticMarkup(
    <Switch
      value={value}
      disabled={disabled}
      trackColor={{ false: color.line, true: color.ember }}
      thumbColor={color.paper}
      activeThumbColor={color.paper}
      ios_backgroundColor={color.line}
    />,
  );
}

test('the grip is the kit paper on both sides of the switch, in reach and out of it', () => {
  // #F2ECE3 paper on #E4552B ember. Both switches carry `disabled={busy}`, and the web switch keeps
  // a second pair of defaults for that — a grey grip of its own — so it is walked here too.
  for (const disabled of [false, true]) {
    expect(grip(true, disabled)).toContain('rgba(242,236,227');
    expect(grip(false, disabled)).toContain('rgba(242,236,227');
  }

  // The teal is what this is all about; naming it keeps the case honest if the library moves.
  expect(grip(true, false)).not.toContain('rgba(0,150,136');
  // And the track is still the kit's, which was never the broken half.
  expect(grip(true, false)).toContain('rgba(228,85,43');
});

/**
 * Swept over the sources rather than named screen by screen, the reason `screen-theme.test.ts`
 * gives: what breaks this is not today's two switches, it is the third one written by copying a
 * call site that looks complete — every colour the kit has, and still teal in a browser.
 */
const screens = Object.entries(
  import.meta.glob<string>('./app/**/*.tsx', { query: '?raw', import: 'default', eager: true }),
);

test.each(screens)('%s colours the grip of any switch it draws on both sides', (_path, source) => {
  for (const tag of source.matchAll(/<Switch\b[\s\S]*?\/>/g)) {
    expect(tag[0]).toContain('thumbColor=');
    expect(tag[0]).toContain('activeThumbColor=');
  }
});
