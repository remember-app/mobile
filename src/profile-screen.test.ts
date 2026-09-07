import { expect, test } from 'vitest';

import form from './username-form.tsx?raw';
import profile from './app/profile.tsx?raw';

/**
 * Both of these break silently: nothing throws, the screen just says the wrong thing in the wrong
 * colour, and only an eye on the simulator catches it. Read as text for the reason
 * `memory-screens.test.ts` reads its routes that way — a screen wired to auth and `expo-router` has
 * no renderer here, and neither has a debounced effect.
 */

test('the field asks nothing about the name the account already holds', () => {
  // /profile opens with the saved username in the field. The api calls that name available (see
  // `checkUsername`) because re-sending it claims nothing — paint that green and the field tells
  // the person their own taken name is free. The guard is what keeps the question from being asked.
  expect(form).toContain("const unchanged = typed === (user?.username ?? '');");
  expect(form).toContain('if (token === null || unchanged || !isValidUsername(typed)) {');
});

test('the submit only glows once the name in the field is a different one', () => {
  // Same guard, second job (TASK-74): the ember marks what there is to do, and /profile at rest —
  // the saved name sitting in its own field — has nothing. It lights when the name changes.
  expect(form).toContain("variant={unchanged ? 'secondary' : 'primary'}");
});

test('logging out is not painted in the colour held for the irreversible', () => {
  // Kit section 2: rust is failure and what cannot be undone. Signing in again brings the session
  // back, so the way out wears the neutral button — the sheet is where the question gets asked.
  expect(profile).not.toContain('variant="danger"');
  expect(profile).toContain('variant="secondary"');
});
