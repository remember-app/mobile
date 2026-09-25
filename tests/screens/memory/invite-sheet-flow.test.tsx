import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
// A text input listens on the browser's `document`, which a test renderer has none of.
vi.mock('@/kit', async (original) => ({
  ...(await original<typeof import('@/kit')>()),
  Field: () => null,
}));

import { type Asked, contact, later, member, refused, serve } from '@tests/helpers/api';
import { fontFile, wordWidth } from '@tests/helpers/font';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Text as RNText, StyleSheet, View } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import type { Contact, Member } from '@/api';
import { Banner, Button, Chip, Divider, Field, Text, Toggle } from '@/kit';
import { InviteSheet } from '@/screens/memory/invite-sheet';
import { ru } from '@/strings';
import { currentTheme, themes } from '@/theme';

/**
 * `SheetInvite` (spec 8) — both roads into a memory on one sheet: the nick of somebody whose name is
 * known, the chips of people already saved, and the link for whoever has neither. The real api
 * client over a stand-in server, and the fake clock for the wait the field gives a typed word.
 */

mountsTrees();

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const contacts: Contact[] = [
  contact('anya', 'Аня Петрова'),
  contact('pavel', 'Павел'),
  contact('liza', 'Лиза Морозова'),
];
const onRoster: Member[] = [
  member('me', 'organizer', { name: 'Я' }),
  member('liza', 'contributor', { name: 'Лиза Морозова' }),
];

type World = {
  log: Asked[];
  /** Who the api knows by nick, for the lookup of a name that is not among the contacts. */
  users: Record<string, Contact>;
  onInvite?: unknown;
  contacts: Contact[] | 'offline';
};

function world(over: Partial<Pick<World, 'users' | 'onInvite' | 'contacts'>> = {}): World {
  const w: World = { log: [], users: { zoya: contact('zoya', 'Зоя') }, contacts, ...over };
  w.log = serve((asked) => {
    if (asked.path === '/me/contacts') return w.contacts;
    if (asked.path.startsWith('/users?username=')) {
      const nick = decodeURIComponent(asked.path.split('=')[1]);
      return w.users[nick] ?? refused(404, 'no such user');
    }
    if (asked.method === 'POST' && asked.path === '/memories/m1/members') {
      if (w.onInvite) return w.onInvite;
      const { username } = asked.body as { username: string };
      const person = [...contacts, ...Object.values(w.users)].find(
        (one) => one.username === username,
      )!;
      return member(person.id, (asked.body as { role: never }).role, { name: person.name });
    }
    if (asked.path === '/memories/m1/invite' && asked.method === 'GET')
      return { token: 'first', role: 'contributor' };
    if (asked.path === '/memories/m1/invite')
      return { token: 'second', role: (asked.body as { role: never }).role };
    return undefined;
  });
  return w;
}

async function open(members: Member[] | null = onRoster) {
  const calls = { invited: 0, cancelled: 0 };
  const sheet = (visible: boolean) => (
    <InviteSheet
      visible={visible}
      onCancel={() => calls.cancelled++}
      memoryId="m1"
      members={members}
      onInvited={() => calls.invited++}
    />
  );
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(sheet(true)));
  });
  const root = tree.root;
  const screen = {
    root,
    calls,
    reopen: async () => {
      await act(async () => tree.update(sheet(false)));
      await act(async () => tree.update(sheet(true)));
    },
    type: (text: string) => act(async () => root.findByType(Field).props.onChangeText(text)),
    wait: (ms: number) => act(async () => void vi.advanceTimersByTime(ms)),
    field: () =>
      root.findByType(Field).props as {
        value: string;
        state?: string;
        hint?: string;
        editable?: boolean;
      },
    chips: () => root.findAllByType(Chip),
    chip: (label: string) => () =>
      root.findAllByType(Chip).find((one) => one.props.label === label)!,
    call: () => root.findAllByType(Button).find((one) => one.props.label === ru.members.inviteDo)!,
    button: (label: string) => root.findAllByType(Button).find((one) => one.props.label === label),
    mayAdd: () => root.findByType(Toggle),
    notice: () => root.findAllByType(Banner).map((one) => one.props.text as string),
    press: (find: () => { props: { onPress?: () => void } }) =>
      act(async () => find().props.onPress?.()),
    text: () => JSON.stringify(tree.toJSON()),
  };
  return screen;
}

const posts = (log: Asked[]) =>
  log
    .filter((one) => one.method === 'POST' && one.path === '/memories/m1/members')
    .map((one) => one.body);

test('nothing is asked and nobody is called until somebody is named: the button waits, the switch is on', async () => {
  world();
  const screen = await open();
  expect(screen.call().props.disabled).toBe(true);
  expect(screen.mayAdd().props.value).toBe(true);
  expect(screen.mayAdd().props.label).toBe(ru.members.mayAdd);
});

test('the chips are the saved people who are not in the memory yet, and the sheet reads them again on every open', async () => {
  const w = world();
  const screen = await open();
  // Liza is on the roster behind the sheet: offering to invite her again would argue with it.
  expect(screen.chips().map((one) => one.props.label)).toEqual(['Аня Петрова', 'Павел']);
  const reads = () => w.log.filter((one) => one.path === '/me/contacts').length;
  expect(reads()).toBe(1);
  await screen.reopen();
  expect(reads()).toBe(2);
});

test('the sheet stands as `SheetInvite.json` draws it: a quiet heading, chips of 44, the link and «Получить»', async () => {
  // Spec 8, `SheetInvite`, 10.11 and `SheetInvite.json` (TASK-390). «ИЗ КОНТАКТОВ» is `eyebrow` in
  // `muted` (e11, #A4A1B2 — it stood in `paper`) with the chips 10 under it (e12 at 227 under 201…
  // 217), each a chip of 44 with the face 32 (it was the filter's 40). Across the rule (e20, its
  // top hairline) the words stand 17 from it — the rule's 1 and 16: «Ссылка-приглашение» 14 / 600
  // (e21, it was 15), 4 over «Кто перейдёт по ней…» 12 / 400 / 17 `muted` (e22, it was 13 / 500 /
  // 19). The button is «Получить», not «Получить ссылку» (e23), ringed in `lineStrong` #45424F.
  world();
  const screen = await open();
  const said = (words: string) =>
    screen.root.find((one) => one.type === Text && one.props.children === words);
  const style = (node: { props: { style?: unknown } } | null) =>
    StyleSheet.flatten(node?.props.style as never) as Record<string, unknown>;
  /** The View a node stands in. */
  const holder = (node: ReactTestInstance) => {
    let up = node.parent;
    while (up && up.type !== View) up = up.parent;
    return up;
  };

  const heading = said(ru.members.fromContacts.toUpperCase());
  expect(heading.props.role).toBe('eyebrow');
  expect(style(heading.findByType(RNText))).toMatchObject({
    color: themes[currentTheme()].color.muted,
  });
  expect(style(holder(heading))).toMatchObject({ gap: 10 });
  expect(screen.chips().map((one) => one.props.size)).toEqual([44, 44]);

  const link = said(ru.members.inviteLink);
  expect(link.props.role).toBe('rowSm');
  expect(style(holder(link))).toMatchObject({ gap: 4 });
  expect(said(ru.members.linkGrants(ru.role.contributor)).props).toMatchObject({
    role: 'aside',
    tone: 'muted',
  });
  const road = holder(screen.root.findByType(Divider));
  expect(style(road)).toMatchObject({ gap: 16 });
  expect(road?.findAllByType(Text).map((one) => one.props.children)[0]).toBe(ru.members.inviteLink);

  expect(ru.members.getLink).toBe('Получить');
  const get = screen.button(ru.members.getLink)!;
  expect(style(get)).toMatchObject({
    borderColor: themes[currentTheme()].color.lineStrong,
    paddingHorizontal: 16,
  });
  // 94.2 wide in the layout: a hairline and 16 a side round the words at 13 / 600, read off the font.
  const words = wordWidth(
    fontFile('@expo-google-fonts/onest/600SemiBold/Onest_600SemiBold.ttf'),
    ru.members.getLink,
    13,
  );
  expect(2 + 2 * 16 + words).toBeCloseTo(94.2, 0);
});

test('with no contacts, or every one of them here already, there is no block and no empty list saying so', async () => {
  world({ contacts: [] });
  const none = await open();
  expect(none.chips()).toHaveLength(0);
  expect(none.text()).not.toContain(ru.members.fromContacts.toUpperCase());
  vi.unstubAllGlobals();
  world({ contacts: [contact('liza', 'Лиза Морозова')] });
  const all = await open();
  expect(all.chips()).toHaveLength(0);
  // And contacts that would not come are the same: the field beside it is the other road in.
  vi.unstubAllGlobals();
  world({ contacts: 'offline' });
  const down = await open();
  expect(down.chips()).toHaveLength(0);
  expect(down.notice()).toEqual([]);
});

test('a chip pressed in is who «Позвать» calls: one request with the level the switch says, and the sheet is emptied of who it was about', async () => {
  const w = world();
  const screen = await open();
  await screen.press(screen.chip('Аня Петрова'));
  expect(screen.chip('Аня Петрова')().props.selected).toBe(true);
  expect(screen.call().props.disabled).toBe(false);
  await screen.press(() => screen.call());
  expect(posts(w.log)).toEqual([{ username: 'anya', role: 'contributor' }]);
  expect(screen.calls.invited).toBe(1);
  expect(screen.notice()).toEqual([ru.members.added('Аня Петрова', ru.role.contributor)]);
  // Nobody is pressed in any more, so the button is off again.
  expect(screen.call().props.disabled).toBe(true);
  expect(screen.chip('Аня Петрова')().props.selected).toBeFalsy();
});

test('with the switch off the newcomer arrives as a viewer, on both roads', async () => {
  const w = world();
  const screen = await open();
  await act(async () => screen.mayAdd().props.onValueChange(false));
  await screen.press(screen.chip('Павел'));
  await screen.press(() => screen.call());
  expect(posts(w.log)).toEqual([{ username: 'pavel', role: 'viewer' }]);
  // The link says what following it would grant, and follows the switch until there is one.
  expect(screen.text()).toContain(ru.members.linkGrants(ru.role.viewer));
  await screen.press(() => screen.button(ru.members.getLink)!);
  expect(screen.text()).toContain(ru.members.linkGrants(ru.role.contributor));
});

test('a chip pressed again lets go, and a chip and the field are one slot', async () => {
  world();
  const screen = await open();
  await screen.press(screen.chip('Аня Петрова'));
  await screen.press(screen.chip('Аня Петрова'));
  expect(screen.call().props.disabled).toBe(true);
  // Typing lets go of the chip; pressing a chip empties the field.
  await screen.press(screen.chip('Павел'));
  await screen.type('pa');
  expect(screen.chip('Павел')().props.selected).toBe(false);
  expect(screen.call().props.disabled).toBe(true);
  await screen.press(screen.chip('Павел'));
  expect(screen.field().value).toBe('');
  expect(screen.chip('Павел')().props.selected).toBe(true);
});

test('what is typed narrows the chips, and the @ and the capitals come off the way the contacts screen takes them', async () => {
  world();
  const screen = await open();
  await screen.type('  @ПАВ ');
  expect(screen.chips().map((one) => one.props.label)).toEqual(['Павел']);
  await screen.type('anya');
  expect(screen.chips().map((one) => one.props.label)).toEqual(['Аня Петрова']);
});

test('a nick nobody in the contacts holds is asked of the api once the typing has paused, and calls whoever holds it', async () => {
  const w = world();
  const screen = await open();
  await screen.type('zoya');
  // Not yet: a typed word is one question, and this one has not been finished.
  expect(w.log.filter((one) => one.path.startsWith('/users'))).toHaveLength(0);
  expect(screen.call().props.disabled).toBe(true);
  await screen.wait(500);
  expect(w.log.filter((one) => one.path.startsWith('/users'))).toEqual([
    { method: 'GET', path: '/users?username=zoya', body: null },
  ]);
  expect(screen.call().props.disabled).toBe(false);
  await screen.press(() => screen.call());
  expect(posts(w.log)).toEqual([{ username: 'zoya', role: 'contributor' }]);
  expect(screen.field().value).toBe('');
});

test('a nick nobody holds is said under the field as an error, and there is nobody to call', async () => {
  world();
  const screen = await open();
  await screen.type('nobody');
  await screen.wait(500);
  expect(screen.field().state).toBe('error');
  expect(screen.field().hint).toBe(ru.members.noSuchUser);
  expect(screen.call().props.disabled).toBe(true);
  // A half-typed name that could never be held is not even asked about.
  await screen.type('a');
  await screen.wait(500);
  expect(screen.field().state).toBeUndefined();
});

test('a nick that is already on the roster is answered on the sheet, and is no question for the api and nobody to call', async () => {
  const w = world();
  const screen = await open();
  await screen.type('liza');
  await screen.wait(500);
  expect(screen.field().hint).toBe(ru.members.already('Лиза Морозова', ru.role.contributor));
  expect(w.log.filter((one) => one.path.startsWith('/users'))).toEqual([]);
  expect(screen.call().props.disabled).toBe(true);
});

test('a nick that is one of the contacts is the contact, without a question to the api', async () => {
  const w = world();
  const screen = await open();
  await screen.type('anya');
  await screen.wait(500);
  expect(w.log.filter((one) => one.path.startsWith('/users'))).toEqual([]);
  expect(screen.call().props.disabled).toBe(false);
  await screen.press(() => screen.call());
  expect(posts(w.log)).toEqual([{ username: 'anya', role: 'contributor' }]);
});

test('oneself is nobody to offer: a nick that comes back as the asker’s own is not a target', async () => {
  world({ users: { me: contact('me', 'Я') } });
  const screen = await open();
  await screen.type('mememe');
  await screen.wait(500);
  expect(screen.call().props.disabled).toBe(true);
});

test('a second press while the call is in the air sends nothing, and the controls are shut until it is answered', async () => {
  const slow = later<unknown>();
  const w = world({ onInvite: slow.promise });
  const screen = await open();
  await screen.press(screen.chip('Аня Петрова'));
  await act(async () => void screen.call().props.onPress());
  expect(screen.call().props.busy).toBe(true);
  expect(screen.chip('Аня Петрова')().props.disabled).toBe(true);
  expect(screen.field().editable).toBe(false);
  await act(async () => void screen.call().props.onPress());
  expect(posts(w.log)).toHaveLength(1);
  await act(async () => slow.settle(member('anya', 'contributor', { name: 'Аня Петрова' })));
  expect(screen.call().props.busy).toBe(false);
});

test('somebody who was already in is said to be, in the level they already had', async () => {
  // The api answers 200 for a person who is already in, so the only way to tell is the roster the sheet
  // stands over: the answer names somebody who is on it.
  world({ onInvite: member('liza', 'contributor', { name: 'Лиза Морозова' }) });
  const roster = [...onRoster];
  const screen = await open(roster);
  await screen.press(screen.chip('Павел'));
  await screen.press(() => screen.call());
  expect(screen.notice()).toEqual([ru.members.already('Лиза Морозова', ru.role.contributor)]);
});

test('a roster not read yet cannot say somebody was already in: the answer is «added»', async () => {
  world();
  const screen = await open(null);
  await screen.press(screen.chip('Павел'));
  await screen.press(() => screen.call());
  expect(screen.notice()).toEqual([ru.members.added('Павел', ru.role.contributor)]);
});

test('the field is a nick and nothing else: the @ in front, no capitals and no correcting, and it says it is checking while the question is out', async () => {
  const answer = later<unknown>();
  const w = world();
  w.log = serve((asked) =>
    asked.path.startsWith('/users')
      ? answer.promise
      : asked.path === '/me/contacts'
        ? contacts
        : undefined,
  );
  const screen = await open();
  const field = screen.field() as Record<string, unknown>;
  expect(field.prefix).toBe('@');
  expect(field.autoCapitalize).toBe('none');
  expect(field.autoCorrect).toBe(false);
  expect(field.variant).toBe('handle');
  await screen.type('zoya');
  // From the moment a nick that could be somebody’s is typed, through the pause and the question.
  expect(screen.field().hint).toBe(ru.state.checking);
  await screen.wait(500);
  expect(screen.field().hint).toBe(ru.state.checking);
  await act(async () => answer.settle(contact('zoya', 'Зоя')));
  expect(screen.field().hint).toBeUndefined();
  expect(screen.call().props.disabled).toBe(false);
});

test('a refusal says who may invite, and any other failure says what the api or the network said', async () => {
  world({ onInvite: refused(403, 'viewer') });
  const screen = await open();
  await screen.press(screen.chip('Павел'));
  await screen.press(() => screen.call());
  expect(screen.notice()).toEqual([ru.members.inviteDenied]);
  expect(screen.calls.invited).toBe(0);
  vi.unstubAllGlobals();
  world({ onInvite: 'offline' });
  await screen.press(() => screen.call());
  expect(screen.notice()).toEqual([ru.error.offline]);
  // The sheet is not emptied by a call that failed: whoever was going to be called still is.
  expect(screen.chip('Павел')().props.selected).toBe(true);
});

test('the link is minted when it is asked for, replaced on request at the level the switch says, and then it can be handed on', async () => {
  const w = world();
  const screen = await open();
  expect(screen.button(ru.members.replaceLink)).toBeUndefined();
  expect(w.log.filter((one) => one.path === '/memories/m1/invite')).toEqual([]);
  await screen.press(() => screen.button(ru.members.getLink)!);
  expect(w.log.filter((one) => one.path === '/memories/m1/invite')).toEqual([
    { method: 'GET', path: '/memories/m1/invite', body: null },
  ]);
  // Got: the button turns into the way to hand it on, and the quiet one beside it can replace it.
  expect(screen.button(ru.members.getLink)).toBeUndefined();
  expect(screen.button(ru.action.share)).toBeDefined();
  await act(async () => screen.mayAdd().props.onValueChange(false));
  await screen.press(() => screen.button(ru.members.replaceLink)!);
  expect(w.log.at(-1)).toEqual({
    method: 'POST',
    path: '/memories/m1/invite',
    body: { role: 'viewer' },
  });
  expect(screen.notice()).toEqual([ru.members.linkReplaced]);
  expect(screen.text()).toContain(ru.members.linkGrants(ru.role.viewer));
});
