import { expect, test } from 'vitest';
import profile from '@/app/profile.tsx?raw';
import setUsername from '@/app/set-username.tsx?raw';
import form from '@/screens/onboarding/username-form.tsx?raw';

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
  // TASK-113: the human took the change off the design, and TASK-114 rebuilt the screen without
  // putting it back. The head row reads the account out; the form is gone from this screen and lives
  // on /set-username alone, which is the one claim of a name there is. Nothing was taken from the
  // api — this is what the screen draws, not what it may do.
  expect(profile).toContain('<Avatar name={name} size={68} />');
  expect(profile).not.toContain('UsernameForm');
  expect(profile).not.toContain('<Field');
  expect(setUsername).toContain('<UsernameForm');
});

test('the head says who you are once, never the same word twice', () => {
  // `memberName` is the roster's own rule — the name, else the username (api.ts). Whoever signed in
  // by email is named by their username, and printing it again under itself spends the second line
  // on nothing.
  expect(profile).toContain('const name = memberName(user);');
  // Both halves of the pair come off `api.ts`, and the rule for dropping the second one is written
  // there beside the rule for choosing the first. It was spelled out here and again on the roster
  // row until review pulled it back to its sibling.
  expect(profile).toContain('{memberHandle(user)}');
  expect(profile).toContain('{user.email}');
});

test('both settings say where they reach', () => {
  // Kit screen 8: under each switch a line naming what the pick touches — the theme this screen, the
  // language the mails and the pushes too. Without them the screen is two bare rows of pills.
  expect(profile).toContain('hint={s.theme.hint}');
  expect(profile).toContain('hint={s.language.hint}');
});

test('the three-value switch is not squeezed into equal thirds', () => {
  // Measured, not guessed: a third of a phone's column leaves 97pt for a word and «Как в телефоне»
  // needs 108. The kit puts both rows on `.segment-wide`, and the obvious tidying is to make these
  // two match — which cuts the longest value on every phone in service. Two values fit that way,
  // three do not.
  // Read off each `<Segment` block rather than off the line breaks around a prop: pinned by
  // adjacency, this passed just as happily with `wide` moved *above* the hint on the theme row —
  // which is the one arrangement it exists to catch.
  const segment = (name: string) => {
    const at = profile.indexOf(`label={s.${name}.label}`);
    return profile.slice(at, profile.indexOf('/>', at));
  };
  expect(segment('theme')).not.toContain('wide');
  expect(segment('language')).toContain('wide');
});

test('two hairlines cut the screen into who you are, what to set, how to leave', () => {
  // Spec 8's assembly for this screen: a rule under «кто вы» and a rule over the way out. The second
  // is the one a rebuild loses first, because the group reads finished without it.
  expect(profile).toContain('borderBottomWidth: 1');
  expect(profile).toContain('borderBottomColor: color.line');
  expect(profile).toContain('borderTopWidth: 1');
  expect(profile).toContain('borderTopColor: color.line');
});

test('the account is the one door to the contact list', () => {
  // Spec 8: «Контакты — раздел аккаунта, а не вторая иконка в шапке главного». The row is the whole
  // way in, so a screen that draws it without the press leaves the list unreachable.
  expect(profile).toContain('<RowSection');
  expect(profile).toContain("router.push('/contacts')");
});

test('the way out is the red 60 at the foot of the body, and it stands alone there', () => {
  // Spec 8: «отделённая линией кнопка опасная 60 «Выйти из аккаунта»», and «Выход стоит внизу и
  // один, чтобы не попасть в него по дороге» — which is what `.push` under the second rule is for.
  expect(profile).toContain('variant="danger" size="xl"');
  expect(profile).toContain("marginTop: 'auto'");
  // Not the bottom layer: that would draw its own rule over the button and read as the one thing
  // the screen is for (TASK-103), which the way out is not — the name, the theme and the language
  // are.
  expect(profile).not.toContain('ActionBar');
  // Nothing is written under it either (the macro carries no line there), and nothing is asked after
  // it: spec 8 leaves the confirmation undrawn (`[дописано]`) rather than answering it here.
  expect(profile).not.toContain('<Hint');
  expect(profile).not.toContain('ConfirmSheet');
});
