import { flat } from '@tests/helpers/source';
import { expect, test } from 'vitest';

import contacts from '@/app/contacts.tsx?raw';
import { en, ru } from '@/strings';

/**
 * Read as text, the idiom `tests/routes/memory/screen.test.ts` explains: a screen wired to auth, `expo-router`
 * and a debounced effect has no renderer here. What this file pins is the handful of rules on the
 * contacts screen that break silently — the screen keeps working and says the wrong thing, or asks
 * for the wrong thing, and only an eye on the simulator would catch it.
 *
 * How the screen is *reached* is no longer pinned here: spec 8 leaves the main screen one icon and
 * it is the account, so the way in moved inside it — `home-screen.test.ts` holds that end now.
 */

test('the field is the search one: a magnifier, an @, and no label over it', () => {
  // Spec 7.3, the fifth field: 52 with a magnifier and a prefix. It is nailed to the bar rather than
  // standing in the body, because it is the way to add as much as the way to search — and the label
  // stays in the markup for a screen reader, since a placeholder is not a label (spec 7.9).
  expect(contacts).toContain('variant="search"');
  expect(contacts).toContain('icon={Search}');
  expect(contacts).toContain('prefix="@"');
  expect(contacts).toContain('labelHidden');
});

test('the stranger stands above the saved list, not under it', () => {
  // Spec 8, `Contacts`: «блок «Не в контактах» … заголовок «Сохранённые · 8»» — in that order. The
  // eye is at the field after typing, and the answer to what was typed belongs under it.
  expect(contacts.indexOf('s.contacts.notSaved')).toBeLessThan(
    contacts.indexOf('s.contacts.saved'),
  );
  // And the saved carry their own heading with the count on the end of its rule: the eyebrow in caps,
  // a hairline, the count 12 / 500 (`Contacts.json` e17–e19) — not the 10 / 12 seam of a feed.
  expect(flat(contacts)).toContain(
    '<DayHead eyebrow label={s.contacts.saved.toUpperCase()} count={String(shown.length)} />',
  );
  expect(contacts).not.toContain('<DayMark');
});

test('the groups of the body stand 18 apart, as the layout stacks them', () => {
  // `Contacts.html`: the found card ends at 276 under «НЕ В КОНТАКТАХ» (its block's `padding-bottom:
  // 18px`), and «СОХРАНЁННЫЕ» starts at 294. The body put 20 between them.
  expect(contacts).toContain('body: { flexGrow: 1, gap: 18, paddingHorizontal: space.s4');
});

test('one field does both jobs — it narrows the list and asks about what is not in it', () => {
  // The whole point of the screen having one field and not two. Losing either half leaves a field
  // that still works, for one of the two things a person came to do.
  expect(contacts).toContain('const shown = list.filter(');
  // The lookup itself lives in `@/lib/find-user`, which the invite sheet reads off too — what is pinned
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
  // The five seconds are the spec's own (`duration.undo`), not a number of this screen's.
  expect(contacts).toContain('}, duration.undo),');
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
  // Spec 7.5 has a row of its own for the address book — the same shape as in a memory, without the
  // role and without the count, because a contact uploads nothing and there is nothing of theirs to
  // state. Its three states are the row's, not three layouts on this screen.
  expect(contacts).toContain('<RowContact');
  expect(contacts).toContain('handle={fading ? s.contacts.removed : memberHandle(contact)}');
  expect(contacts).toContain("variant={fading ? 'gone' : 'saved'}");
  expect(contacts).toContain('variant="found"');
  expect(contacts).not.toContain('<Chip');
  expect(contacts).not.toContain('<Badge');
});

test('waiting, failing and empty each hold the place of the list', () => {
  // Kit «Ждём», «Сбой», «Пусто». Three separate silences, and the one that goes missing first is
  // the failure — a list that never arrives otherwise reads as a list with nobody in it.
  expect(contacts).toContain('<Empty busy text={s.state.loading} />');
  expect(contacts).toContain('<Banner tone="error" text={error.text} icon={error.icon}>');
  // Spec 7.8's rule of words, and `ContactsEmpty` draws it in two parts: the heading names what is
  // missing, the paragraph sends them to the field over it.
  expect(contacts).toContain(
    '<Empty icon={UserPlus} title={s.contacts.emptyTitle} text={s.contacts.empty} />',
  );
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

test('«Вернуть» that never reaches the api takes the row with it, not just the button', () => {
  // Review found this one: the delete already went through, so a failed re-add used to leave a live
  // cross standing over a contact the server no longer has. `undo` still calls `cancel` first (to
  // stop the fade and light the name again, the same as a working «Вернуть»), but its *catch* is the
  // opposite shape of `drop`'s on purpose — `drop`'s catch undoes the fade on a failed delete, and a
  // failed re-add here has nothing left to undo back to, so it drops the row from `contacts` instead.
  const undo = contacts.slice(
    contacts.indexOf('function undo('),
    contacts.indexOf('function save('),
  );
  expect(undo).toContain('addContact(token, contact.username).catch((e: unknown) => {');
  const catchBlock = undo.slice(undo.indexOf('.catch('));
  expect(catchBlock).toContain('setNotice(failure(e));');
  expect(catchBlock).toContain(
    'setContacts((held) => held?.filter((row) => row.id !== contact.id) ?? null);',
  );
  expect(catchBlock).not.toContain('cancel(contact.id);');
});

test('«Не в контактах» and its row are drawn to the layout: a quiet rule, a 14 «Сохранить»', () => {
  // TASK-383, off `Contacts.json`: e11 «Не в контактах» is `muted` #A4A1B2 (white #F5F3EE before),
  // 10 over the card under it (e12 at 184 + 16 + 10); e16 «Сохранить» is 14 / 600 in a 44 — at the
  // button's own 16 it came out 14 % wider than drawn.
  expect(contacts).toContain('<Text accessibilityRole="header" role="eyebrow" tone="muted">');
  expect(contacts).toContain('labelRole="controlSm"');
  expect(contacts).toContain('section: { gap: 10 }');
});

test('the empty state is centred on the body down to the phone’s edge, the rows kept clear of it', () => {
  // `ContactsEmpty.json`: the block stands in 184…844 (e9, the circle, at 400.5); the rows' bottom
  // padding under it lifted it 20 short of there.
  expect(contacts).toContain(
    'nothing ? styles.mid : { paddingBottom: Math.max(insets.bottom, board.bottom) },',
  );
});
