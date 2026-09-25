import { expect, test } from 'vitest';
import layout from '@/app/_layout.tsx?raw';
import profile from '@/app/profile.tsx?raw';
import setUsername from '@/app/set-username.tsx?raw';
import form from '@/screens/onboarding/username-form.tsx?raw';
import { en, ru } from '@/strings';

/**
 * Both of these break silently: nothing throws, the screen just says the wrong thing in the wrong
 * colour, and only an eye on the simulator catches it. Read as text for the reason
 * `tests/routes/memory/screen.test.ts` reads its routes that way — a screen wired to auth and `expo-router` has
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

test('the pencil changes the username on a sheet over the account, and nowhere else', () => {
  // The chief's word on the pencil: only the username changes (doc-04 keeps no name and no picture),
  // and it changes through the one form there is. On a sheet, not by a push to /set-username: that
  // screen is the last step of the way in, and the gate declares it only while an account has no
  // name — a push there from here would land on the first screen that *is* declared, which is home.
  expect(profile).toContain('<UsernameForm submitLabel={s.action.save}');
  expect(profile).not.toContain("'/set-username'");
  expect(layout).toMatch(
    /<Stack\.Protected guard=\{status === 'needs-username'\}>\s*<Stack\.Screen name="consent"[^/]*\/>\s*<Stack\.Screen name="set-username"/,
  );
  expect(setUsername).toContain('<UsernameForm');
  // No field the product has nothing behind: no name, no picture, no address to edit.
  expect(profile).not.toContain('<Field');
});

test('the head says who you are once, never the same word twice', () => {
  // `memberName` is the roster's own rule — the name, else the username (api.ts). Whoever signed in
  // by email is named by their username, and printing it again under itself spends the second line
  // on nothing. Both halves of the pair come off `api.ts`, beside each other, so the day the rule
  // changes it changes once.
  expect(profile).toContain('const name = memberName(user);');
  expect(profile).toContain('const handle = memberHandle(user);');
  expect(profile).toContain('{user.email}');
});

test('the three values share the row in equal thirds, as the two do', () => {
  // Spec 8: both rows of pills span the column. «Как в системе» fits a third of a 360dp phone at 13
  // (91pt of 95) — «Как в телефоне» did not, which is why the theme row used to be sized to its
  // words.
  const segment = (name: string) => {
    const at = profile.indexOf(`label={s.${name}.label}`);
    return profile.slice(at, profile.indexOf('/>', at));
  };
  for (const name of ['theme', 'language']) {
    expect(segment(name)).toContain('wide');
    expect(segment(name)).toContain('hideLabel');
  }
});

test('no rule cuts the screen any more: the cards are what part it', () => {
  // The layout of 25 September: the person on a card of their own, and the way out apart from the
  // body «без разделителя над ней». The hairlines of the screen before are what a rebuild keeps by
  // habit.
  expect(profile).not.toContain('borderBottomWidth');
  expect(profile).not.toContain('borderTopWidth');
  expect(profile).not.toContain('<Divider');
});

test('the way out is the red 60 at the foot, and it is asked about gently', () => {
  // Spec 8: the dangerous 60, alone at the bottom; and at its edges, the question — the gentle kind
  // of the confirmation sheet, because nothing is lost by leaving.
  expect(profile).toContain('variant="danger"');
  expect(profile).toContain('size="xl"');
  expect(profile).toContain("marginTop: 'auto'");
  // Not the bottom layer: that would draw its own rule over the button and read as the one thing
  // the screen is for (TASK-103), which the way out is not.
  expect(profile).not.toContain('ActionBar');
  expect(profile).toContain('variant="gentle"');
});

test('the lines the layout took off are gone from the dictionary too', () => {
  // Spec 9: no explanations under the theme and the language any more — and a key nobody reads is a
  // line somebody will put back on the screen by finding it.
  for (const set of [en, ru]) {
    expect(set.theme).not.toHaveProperty('hint');
    expect(set.language).not.toHaveProperty('hint');
  }
  expect(ru.theme.system).toBe('Как в системе');
});
