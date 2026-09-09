import { expect, test } from 'vitest';

import contacts from './app/contacts.tsx?raw';
import home from './app/index.tsx?raw';
import { en, ru } from '@/strings';

/**
 * Read as text, the idiom `memory-screens.test.ts` explains: a screen wired to auth, `expo-router`
 * and a debounced effect has no renderer here. What this file pins is the handful of rules on the
 * contacts screen that break silently — the screen keeps working and says the wrong thing, or asks
 * for the wrong thing, and only an eye on the simulator would catch it.
 */

test('the header opens contacts and leaves the profile the outermost icon', () => {
  // Kit «Экраны» 9, «Справа в шапке»: two icons is the ceiling and both are now taken; the profile
  // never moves. A second `IconButton` dropped in after it would look right and read wrong.
  expect(home).toContain("router.push('/contacts')");
  expect(home.indexOf('s.home.contacts')).toBeLessThan(home.indexOf('s.home.profile'));
});

test('one field does both jobs — it narrows the list and asks about what is not in it', () => {
  // The whole point of the screen having one field and not two. Losing either half leaves a field
  // that still works, for one of the two things a person came to do.
  expect(contacts).toContain('const shown = list.filter(');
  // The lookup itself lives in `@/find-user`, which the invite sheet reads off too — what is pinned
  // here is that this screen still asks it. «Уже сохранённого ник вводом не задваивает» is the
  // `skip`: an exact hit among the saved is answered by the list, so the api is not asked and no
  // second row is offered.
  expect(contacts).toContain('useFindUser(token, query, { skip: saved, selfId: user?.id })');
});

test('a nick typed with a capital or an @ is taken as it is', () => {
  // Kit «Края». Without the folding, `@Roma` filters to nothing and is looked up as a name nobody
  // could ever hold — the screen goes silent on a nick that is right there.
  expect(contacts).toContain("const query = typed.trim().replace(/^@+/, '');");
  expect(contacts).toContain('const needle = query.toLowerCase();');
});

test('the cross removes at once, with no sheet and no second question', () => {
  // Kit «Убрать»: the confirm sheet in this product is for what carries frames away, and this
  // carries nothing away. The obvious «safety» to add here is exactly the thing that is wrong.
  expect(contacts).not.toContain('ConfirmSheet');
  expect(contacts).toContain('removeContact(token, contact.id)');
});

test('the removed row stands its five seconds in place and then collapses', () => {
  // Nothing moves while it stands there — the row keeps its slot in `contacts` and only its id goes
  // into `gone`, so the neighbours do not shift under the finger that is about to undo the miss.
  expect(contacts).toContain('const UNDO_MS = 5000;');
  expect(contacts).toContain('setGone((ids) => [...ids, contact.id]);');
  expect(contacts).toContain('setContacts((held) => held?.filter((row) => row.id !== contact.id)');
  // And no timer outlives the screen: every one of them holds a `setState` on a gone component.
  expect(contacts).toContain('return () => pending.forEach(clearTimeout);');
});

test('«Вернуть» re-adds off the row itself, with nothing typed again', () => {
  // The kit's whole reason for keeping the row rather than dropping it: the username is right there
  // and the way back must not send anybody to the field for it.
  expect(contacts).toContain('addContact(token, contact.username)');
});

test('the row carries the username where a member row carries a standing', () => {
  // Kit «Порядок»: the same row as in a memory, without the role and without the count — a contact
  // uploads nothing, so there is nothing of theirs to state.
  expect(contacts).toContain('meta={fading ? s.contacts.removed : memberHandle(contact)}');
  expect(contacts).not.toContain('<Chip');
  expect(contacts).not.toContain('count=');
});

test('waiting, failing and empty each hold the place of the list', () => {
  // Kit «Ждём», «Сбой», «Пусто». Three separate silences, and the one that goes missing first is
  // the failure — a list that never arrives otherwise reads as a list with nobody in it.
  expect(contacts).toContain('<Empty busy text={s.state.loading} />');
  expect(contacts).toContain('<Banner tone="error" text={error}>');
  expect(contacts).toContain('<Empty icon={Users} text={s.contacts.empty} />');
  expect(contacts).toContain('<Empty text={s.contacts.noUser(query)} />');
  // And there is no fourth silence: a nick nobody *could* hold — two letters, a space in it,
  // anything Cyrillic — never reaches the api, so keying the line off the api's answer alone left
  // the body blank under a field with text in it.
  expect(contacts).toContain("nothing && (found === 'none' || !isValidUsername(query))");
});

test('«такого ника нет» is said once, in one of the two places', () => {
  // The kit says it under the field («Ждём») and on the place of the list («Пусто»). Both at once
  // is the same sentence twice, so the field takes it only while there are still rows under it.
  expect(contacts).toContain("state={found === 'none' && shown.length > 0 ? 'error' : undefined}");
  // And the wording is the invite sheet's own: one fact, one sentence, wherever it is found.
  expect(contacts).toContain('s.members.noSuchUser');
});

test('the empty list invites a nick instead of reporting that there is none', () => {
  // The kit's rule for every empty state in the product, and the one a rewrite flattens into
  // «Контактов нет» first. Pinned in both languages — the Russian is where the screen is read.
  for (const set of [en, ru]) {
    expect(set.contacts.empty).not.toEqual(set.contacts.noUser(''));
    expect(set.contacts.empty.length).toBeGreaterThan(40);
  }
});

test('the removed row says it without guessing anybody’s gender', () => {
  // The kit draws «Убрана из контактов» under Марина. Nothing in the product knows who is a он and
  // who is a она, so the line is spoken about the list instead of about the person.
  expect(ru.contacts.removed).toBe('Убрали из контактов');
});
