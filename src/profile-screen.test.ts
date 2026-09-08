import { expect, test } from 'vitest';

import form from './username-form.tsx?raw';
import profile from './app/profile.tsx?raw';
import setUsername from './app/set-username.tsx?raw';

/**
 * Both of these break silently: nothing throws, the screen just says the wrong thing in the wrong
 * colour, and only an eye on the simulator catches it. Read as text for the reason
 * `memory-screens.test.ts` reads its routes that way — a screen wired to auth and `expo-router` has
 * no renderer here, and neither has a debounced effect.
 */

test('the field asks nothing about the name the account already holds', () => {
  // A field opened on the saved username: the api calls that name available (see `checkUsername`)
  // because re-sending it claims nothing — paint that green and the field tells the person their own
  // taken name is free. The guard is what keeps the question from being asked.
  expect(form).toContain("const unchanged = typed === (user?.username ?? '');");
  expect(form).toContain('if (token === null || unchanged || !isValidUsername(typed)) {');
});

test('the submit only glows once the name in the field is a different one', () => {
  // Same guard, second job (TASK-74): the ember marks what there is to do, and a field already
  // holding the account's name has nothing. It lights when the name changes.
  expect(form).toContain("variant={unchanged ? 'secondary' : 'primary'}");
});

test('the profile shows the name and offers no way to change it', () => {
  // TASK-113: the human took the change off the design. The row that reads the name out stays; the
  // form is gone from this screen and lives on /set-username alone, which is the one claim of a name
  // there is. Nothing was taken from the api — this is what the screen draws, not what it may do.
  expect(profile).toContain('<RowMember name={user?.username');
  expect(profile).not.toContain('UsernameForm');
  expect(setUsername).toContain('<UsernameForm');
});

test('logging out is not painted in the colour held for the irreversible', () => {
  // Kit section 2: rust is failure and what cannot be undone. Signing in again brings the session
  // back, so the way out wears no colour at all — the sheet is where the question gets asked.
  expect(profile).not.toContain('variant="danger"');
  expect(profile).toContain('variant="quiet"');
});

test('the way out stands in the body, not in a footer', () => {
  // Kit screen 8: a quiet small button on `.push` at the end of the scrolling body. An actionbar
  // would draw a hairline over it and read as the one thing the screen is for (TASK-103), which the
  // way out is not — the name, the theme and the language are.
  expect(profile).not.toContain('ActionBar');
  expect(profile).toContain("marginTop: 'auto'");
});
