import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { who, router } = vi.hoisted(() => ({
  /** Who is asking. A test sets it before it opens the screen. */
  who: { id: 'me' },
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: who.id } }) }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useLocalSearchParams: () => ({ id: 'm1' }),
    useRouter: () => router,
  };
});
// A text input listens on the browser's `document`, which a test renderer has none of.
vi.mock('@/kit', async (original) => ({ ...(await original<typeof import('@/kit')>()), Field: () => null }));

import TestRenderer, { act } from 'react-test-renderer';
import { Pressable } from 'react-native';

import type { Member, Memory } from '@/api';
import MemorySettingsScreen from '@/app/memory/[id]/settings';
import { Banner, BadgeContribution, Button, ConfirmSheet, IconButton, RowMember, Waiting } from '@/kit';
import { InviteSheet } from '@/memory/invite-sheet';
import { ru } from '@/strings';
import { later, member, memory, refused, serve, type Asked } from '@/test-api';
import { setTheme } from '@/theme';
import { mounted, mountsTrees, themesShown } from '@/test-renderer';

/**
 * `MemorySettings` and the mode of taking people out (spec 8, 10.8.3, 10.8.4) — the whole screen over
 * the real api client. What is asked here is who is *shown* a button (the spec says «не рисуется, а не
 * недоступна»), what the rows say, and what one press sends. Which of those the api would refuse
 * anyway is the api's; this is the client not offering what it will not be given.
 */

mountsTrees();

beforeEach(() => {
  who.id = 'me';
  router.push.mockClear();
  router.back.mockClear();
  router.replace.mockClear();
  router.canGoBack.mockReturnValue(true);
});
afterEach(() => vi.unstubAllGlobals());

/**
 * Five people: the organizer, three who bring material and one who only watches. Who has said what:
 * the organizer «всё загрузил», Anya «нечего добавлять», Liza still adding and Pavel not started —
 * so two of the four who bring have brought.
 */
const roster = (): Member[] => [
  member('me', 'organizer', { name: 'Я', contribution_status: 'done', media_count: 12 }),
  member('liza', 'contributor', { name: 'Лиза Морозова', contribution_status: 'more_coming', media_count: 54 }),
  member('anya', 'contributor', { name: 'Аня Петрова', username: 'anya.p', contribution_status: 'nothing', media_count: 0 }),
  member('pavel', 'contributor', { name: null, username: 'pavel', contribution_status: 'not_started', media_count: 3 }),
  member('vera', 'viewer', { name: 'Вера', username: 'vera', media_count: 0 }),
];

type World = {
  members: Member[];
  /** What the card of this memory says — the counters the price of deleting it is read off. */
  card?: Partial<Memory>;
  onRemove?: Response;
  onStanding?: Response;
  onWipe?: Response;
  log: Asked[];
};

function world(over: Partial<Omit<World, 'log'>> = {}): World {
  const w: World = { members: roster(), log: [] };
  Object.assign(w, over);
  w.log = serve((asked) => {
    if (asked.path === '/memories')
      return [memory({ member_count: w.members.length, media_count: 69, ...w.card })];
    if (asked.path === '/memories/m1/members' && asked.method === 'GET') return w.members;
    if (asked.path === '/contacts') return [];
    if (asked.method === 'DELETE' && asked.path === '/memories/m1') return w.onWipe ?? { ok: true };
    if (asked.method === 'DELETE' && asked.path.startsWith('/memories/m1/members/')) {
      if (w.onRemove) return w.onRemove;
      const gone = asked.path.split('/').pop();
      w.members = w.members.filter((one) => one.id !== gone);
      return { ok: true };
    }
    if (asked.path === '/memories/m1/contribution-status') {
      if (w.onStanding) return w.onStanding;
      return { status: (asked.body as { status: never }).status };
    }
    return undefined;
  });
  return w;
}

async function open() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<MemorySettingsScreen />));
  });
  const root = tree.root;
  const press = (find: () => { props: { onPress?: () => void } }) => act(async () => find().props.onPress?.());
  const screen = {
    root,
    press,
    button: (label: string) => root.findAllByType(Button).filter((one) => one.props.label === label),
    icon: (label: string) => root.findAllByType(IconButton).filter((one) => one.props.label === label),
    rows: () => root.findAllByType(RowMember),
    /** Who is on the screen, in the order drawn: the people and then the ones who only watch. */
    names: () => root.findAllByType(RowMember).map((one) => one.props.name as string),
    row: (name: string) => root.findAllByType(RowMember).find((one) => one.props.name === name)!,
    /** The one mark at the right of a row: `null` for nothing, or what kind of thing it is. */
    mark: (name: string) => {
      const status = screen.row(name).props.status as { type: unknown; props: Record<string, unknown> } | null | undefined;
      if (status === null || status === undefined) return null;
      return status.type === BadgeContribution ? `badge:${status.props.state}` : status.type === IconButton ? 'cross' : 'button';
    },
    sheet: () => root.findAllByType(ConfirmSheet),
    notice: () => root.findAllByType(Banner).map((one) => one.props.text as string),
    /** The screen's own heading of a block, as the layout writes it. */
    text: () => JSON.stringify(tree.toJSON()),
  };
  return screen;
}

type Screen = Awaited<ReturnType<typeof open>>;

test('the organizer sees the people in two blocks, counted by who has said they are done, and the way to invite', async () => {
  world();
  const screen = await open();
  // The four who bring, then the one who watches — a viewer stands in a block of their own.
  expect(screen.names()).toEqual(['Я (вы)', 'Лиза Морозова', 'Аня Петрова', 'pavel', 'Вера']);
  // «Всё загрузил» and «нечего добавлять» both end the wait; the other two do not; the viewer is not counted.
  expect(screen.text()).toContain(ru.members.brought(2, 4));
  expect(screen.text()).toContain(ru.settings.viewers);
  expect(screen.button(ru.action.invite)).toHaveLength(1);
  // The name, the days and how much it holds, on the card.
  expect(screen.text()).toContain('Свадьба Лизы и Марка');
  expect(screen.text()).toContain('12–13 сентября');
  expect(screen.text()).toContain(ru.memory.frames(69));
});

test('every row says how many frames that person brought — and a viewer’s says nothing at all', async () => {
  world();
  const screen = await open();
  expect(screen.row('Лиза Морозова').props.meta).toBe(ru.memory.frames(54));
  expect(screen.row('Аня Петрова').props.meta).toBe(ru.memory.frames(0));
  expect(screen.row('Вера').props.meta).toBeUndefined();
  // The organizer’s circle wears the collar and nobody else’s does.
  expect(screen.rows().map((one) => one.props.ring)).toEqual([true, false, false, false, false]);
});

test('a viewer has no standing: nothing at the right of their row, and no button either', async () => {
  world();
  const screen = await open();
  expect(screen.mark('Вера')).toBeNull();
  // The others are marks: a circle for each, and only one of them a button — one’s own.
  expect(screen.mark('Я (вы)')).toBe('button');
  expect(screen.mark('Лиза Морозова')).toBe('badge:planned');
  expect(screen.mark('Аня Петрова')).toBe('badge:done');
  expect(screen.mark('pavel')).toBe('badge:planned');
});

test('only the organizer is drawn the pencil and the way into taking people out; nobody else is shown a greyed one', async () => {
  for (const [id, role] of [['liza', 'contributor'], ['vera', 'viewer']] as const) {
    who.id = id;
    world();
    const screen = await open();
    expect(screen.icon(ru.settings.edit), `${role}: pencil`).toHaveLength(0);
    expect(screen.button(ru.members.edit), `${role}: edit the roster`).toHaveLength(0);
    // The names and the days are still there to read.
    expect(screen.text()).toContain('Свадьба Лизы и Марка');
  }
  who.id = 'me';
  world();
  const screen = await open();
  expect(screen.icon(ru.settings.edit)).toHaveLength(1);
  expect(screen.button(ru.members.edit)).toHaveLength(1);
});

test('the pencil leads to the edit screen of this memory', async () => {
  world();
  const screen = await open();
  await screen.press(() => screen.icon(ru.settings.edit)[0]);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/memory/[id]/edit', params: { id: 'm1' } });
});

test('whoever may add photos may invite; a viewer is shown the roster and nothing under it', async () => {
  who.id = 'liza';
  world();
  let screen = await open();
  expect(screen.button(ru.action.invite)).toHaveLength(1);
  who.id = 'vera';
  world();
  screen = await open();
  expect(screen.button(ru.action.invite)).toHaveLength(0);
  // The sheet itself is not raised until it is asked for.
  expect(screen.root.findByType(InviteSheet).props.visible).toBe(false);
});

test('the invite button raises the sheet, and it hands back the roster it is standing over', async () => {
  world();
  const screen = await open();
  await screen.press(() => screen.button(ru.action.invite)[0]);
  const sheet = screen.root.findByType(InviteSheet);
  expect(sheet.props.visible).toBe(true);
  expect(sheet.props.memoryId).toBe('m1');
  expect((sheet.props.members as Member[]).map((one) => one.id)).toEqual(['me', 'liza', 'anya', 'pavel', 'vera']);
});

test('nobody is shown a cross until the mode is on, and then everyone but oneself has one — the viewer too', async () => {
  world();
  const screen = await open();
  expect(screen.root.findAllByType(IconButton).filter((one) => one.props.tone === 'danger')).toHaveLength(0);

  await screen.press(() => screen.button(ru.members.edit)[0]);
  // The way in became the way out: the same button, «Готово» now, and held in.
  expect(screen.button(ru.members.edit)).toHaveLength(0);
  expect(screen.button(ru.action.done)).toHaveLength(1);
  expect(screen.button(ru.action.done)[0].props.variant).toBe('paper');
  // Liza, Anya, Pavel and Vera have one; the organizer's own row is where it was.
  expect(screen.mark('Лиза Морозова')).toBe('cross');
  expect(screen.mark('Аня Петрова')).toBe('cross');
  expect(screen.mark('pavel')).toBe('cross');
  expect(screen.mark('Вера')).toBe('cross');
  expect(screen.mark('Я (вы)')).toBe('button');
  expect(screen.icon(ru.members.remove('Я'))).toHaveLength(0);
  expect(screen.icon(ru.members.remove('Вера'))).toHaveLength(1);
  // The bottom button stays live: people are invited and taken out in one visit.
  expect(screen.button(ru.action.invite)[0].props.disabled).toBeFalsy();

  await screen.press(() => screen.button(ru.action.done)[0]);
  expect(screen.mark('Лиза Морозова')).toBe('badge:planned');
});

test('taking somebody out names the price in figures, the level of it is the frames they brought, and a viewer has no price', async () => {
  world();
  const screen = await open();
  await screen.press(() => screen.button(ru.members.edit)[0]);
  expect(screen.sheet()).toHaveLength(0);

  await screen.press(() => screen.icon(ru.members.remove('Лиза Морозова'))[0]);
  const ask = screen.sheet()[0].props;
  expect(ask.title).toBe(ru.members.removeAsk('Лиза Морозова'));
  expect(ask.price).toBe(ru.members.priceFrames(54));
  expect(ask.text).toBe(ru.members.removeText);
  expect(ask.who).toBe('Лиза Морозова');
  await act(async () => ask.onCancel());
  expect(screen.sheet()).toHaveLength(0);

  // Somebody who brought nothing has nothing to lose, and the sheet does not invent a price.
  await screen.press(() => screen.icon(ru.members.remove('Аня Петрова'))[0]);
  expect(screen.sheet()[0].props.price).toBeUndefined();
  expect(screen.sheet()[0].props.meta).toBe(`@anya.p · ${ru.memory.frames(0)}`);
  await act(async () => screen.sheet()[0].props.onCancel());

  // A viewer has brought nothing to be lost: the text says what is lost, and there is no line of frames.
  await screen.press(() => screen.icon(ru.members.remove('Вера'))[0]);
  expect(screen.sheet()[0].props.text).toBe(ru.members.removeViewerText);
  expect(screen.sheet()[0].props.price).toBeUndefined();
  expect(screen.sheet()[0].props.meta).toBe('@vera');
});

test('confirming takes the person out at once: one request, the row and the count are gone, and no undo is offered', async () => {
  const w = world();
  const screen = await open();
  await screen.press(() => screen.button(ru.members.edit)[0]);
  await screen.press(() => screen.icon(ru.members.remove('Лиза Морозова'))[0]);
  await act(async () => screen.sheet()[0].props.onConfirm());

  expect(w.log.filter((one) => one.method !== 'GET')).toEqual([
    { method: 'DELETE', path: '/memories/m1/members/liza', body: null },
  ]);
  expect(screen.names()).toEqual(['Я (вы)', 'Аня Петрова', 'pavel', 'Вера']);
  // Two of the three who bring are done now, and one fewer to count: «2 из 3».
  expect(screen.text()).toContain(ru.members.brought(2, 3));
  expect(screen.sheet()).toHaveLength(0);
  expect(screen.notice()).toEqual([]);
  // The mode is still on for the next one.
  expect(screen.button(ru.action.done)).toHaveLength(1);
});

test('taking out a viewer leaves the block of viewers and the count of the others as they were', async () => {
  world();
  const screen = await open();
  await screen.press(() => screen.button(ru.members.edit)[0]);
  await screen.press(() => screen.icon(ru.members.remove('Вера'))[0]);
  await act(async () => screen.sheet()[0].props.onConfirm());
  expect(screen.names()).toEqual(['Я (вы)', 'Лиза Морозова', 'Аня Петрова', 'pavel']);
  expect(screen.text()).not.toContain(ru.settings.viewers);
  expect(screen.text()).toContain(ru.members.brought(2, 4));
});

test('somebody who is already gone is said to be, and the roster is read again so the row and its cross are gone with them', async () => {
  const w = world({ onRemove: refused(404) });
  const screen = await open();
  await screen.press(() => screen.button(ru.members.edit)[0]);
  // Somebody else took Pavel out first: the api no longer has him, and answers 404 to the request.
  w.members = w.members.filter((one) => one.id !== 'pavel');
  await screen.press(() => screen.icon(ru.members.remove('pavel'))[0]);
  await act(async () => screen.sheet()[0].props.onConfirm());
  expect(screen.notice()).toEqual([ru.members.gone]);
  expect(w.log.filter((one) => one.method === 'DELETE')).toHaveLength(1);
  expect(w.log.filter((one) => one.path === '/memories/m1/members' && one.method === 'GET')).toHaveLength(2);
  expect(screen.names()).toEqual(['Я (вы)', 'Лиза Морозова', 'Аня Петрова', 'Вера']);
  expect(screen.icon(ru.members.remove('pavel'))).toHaveLength(0);
});

test('any other failure of taking somebody out is said in the api’s words and leaves the roster as it was', async () => {
  const w = world({ onRemove: refused(500, 'boom') });
  const screen = await open();
  await screen.press(() => screen.button(ru.members.edit)[0]);
  await screen.press(() => screen.icon(ru.members.remove('pavel'))[0]);
  await act(async () => screen.sheet()[0].props.onConfirm());
  expect(screen.notice()).toEqual(['boom']);
  expect(screen.names()).toHaveLength(5);
  expect(w.log.filter((one) => one.path === '/memories/m1/members' && one.method === 'GET')).toHaveLength(1);
});

test('the mode goes when the last person to take out is gone, and the button with it', async () => {
  const w = world({ members: [roster()[0], roster()[1]] });
  const screen = await open();
  expect(screen.button(ru.members.edit)).toHaveLength(1);
  await screen.press(() => screen.button(ru.members.edit)[0]);
  await screen.press(() => screen.icon(ru.members.remove('Лиза Морозова'))[0]);
  await act(async () => screen.sheet()[0].props.onConfirm());
  expect(w.members.map((one) => one.id)).toEqual(['me']);
  // Alone in the memory: nobody to take out, so no button — and the mode did not survive to greet
  // whoever joins next with a cross already beside their name.
  expect(screen.button(ru.action.done)).toHaveLength(0);
  expect(screen.button(ru.members.edit)).toHaveLength(0);
  w.members = roster();
  await act(async () => screen.root.findByType(InviteSheet).props.onInvited());
  expect(screen.button(ru.members.edit)).toHaveLength(1);
  expect(screen.mark('Лиза Морозова')).toBe('badge:planned');
});

test('a memory with only the organizer in it is a list of one row and has no button for taking anybody out', async () => {
  world({ members: [roster()[0]] });
  const screen = await open();
  expect(screen.names()).toEqual(['Я (вы)']);
  expect(screen.button(ru.members.edit)).toHaveLength(0);
  expect(screen.icon(ru.settings.edit)).toHaveLength(1);
});

test('a memory with nobody watching has no block of viewers at all', async () => {
  world({ members: roster().slice(0, 4) });
  const screen = await open();
  expect(screen.text()).not.toContain(ru.settings.viewers);
});

/** One’s own standing is a button that turns it, and only one’s own. */
const standingButton = (screen: Screen, name: string) =>
  screen.root
    .findAllByType(Pressable)
    .find((one) => one.props.accessibilityLabel === ru.settings.yourStanding(name))!;

test('one’s own standing is the next of the ring on every press, and the roster is read again after it', async () => {
  const w = world();
  const screen = await open();
  // «Всё загрузил» → «нечего добавлять».
  await act(async () => standingButton(screen, ru.standing.done).props.onPress());
  expect(w.log.filter((one) => one.method === 'POST')).toEqual([
    { method: 'POST', path: '/memories/m1/contribution-status', body: { status: 'nothing' } },
  ]);
  expect(w.log.filter((one) => one.path === '/memories/m1/members')).toHaveLength(2);
});

test('the ring of standings closes: planned goes to done, done to nothing, nothing to more coming, and never to not started', async () => {
  const cases = [
    ['not_started', ru.standing.not_started, 'done'],
    ['more_coming', ru.standing.more_coming, 'done'],
    ['done', ru.standing.done, 'nothing'],
    ['nothing', ru.standing.nothing, 'more_coming'],
  ] as const;
  for (const [from, word, to] of cases) {
    const w = world({ members: [member('me', 'organizer', { name: 'Я', contribution_status: from }), roster()[1]] });
    const screen = await open();
    await act(async () => standingButton(screen, word).props.onPress());
    expect(w.log.filter((one) => one.method === 'POST').map((one) => one.body), from).toEqual([{ status: to }]);
    vi.unstubAllGlobals();
  }
});

test('a standing that could not be set is said and the buttons come back', async () => {
  world({ onStanding: refused(500, 'boom') });
  const screen = await open();
  await act(async () => standingButton(screen, ru.standing.done).props.onPress());
  expect(screen.notice()).toEqual(['boom']);
  expect(standingButton(screen, ru.standing.done).props.disabled).toBe(false);
});

test('a roster that will not come is an error with a way to try again, not a spinner that never ends', async () => {
  let up = false;
  serve((asked) => {
    if (!up) return 'offline';
    if (asked.path === '/memories') return [memory()];
    if (asked.path === '/memories/m1/members') return roster();
    return undefined;
  });
  const screen = await open();
  expect(screen.notice()).toEqual([ru.error.offline]);
  expect(screen.names()).toEqual([]);
  up = true;
  await act(async () => screen.button(ru.action.retry)[0].props.onPress());
  expect(screen.notice()).toEqual([]);
  expect(screen.names()).toHaveLength(5);
});

test('the rows are one card: a hairline between them and none above the first', async () => {
  world();
  const screen = await open();
  expect(screen.rows().map((one) => one.props.divider)).toEqual([false, true, true, true, false]);
});

test('a row whose count the api did not send says none, never «undefined кадров»', async () => {
  world({ members: [roster()[0], { ...roster()[1], media_count: undefined as never }] });
  const screen = await open();
  expect(screen.row('Лиза Морозова').props.meta).toBe(ru.memory.frames(0));
});

test('the mode stays on while there is somebody left to take out: three people down to two is not the end of it', async () => {
  const w = world({ members: [roster()[0], roster()[1], roster()[2]] });
  const screen = await open();
  await screen.press(() => screen.button(ru.members.edit)[0]);
  await screen.press(() => screen.icon(ru.members.remove('Лиза Морозова'))[0]);
  await act(async () => screen.sheet()[0].props.onConfirm());
  expect(w.members.map((one) => one.id)).toEqual(['me', 'anya']);
  expect(screen.button(ru.action.done)).toHaveLength(1);
  expect(screen.mark('Аня Петрова')).toBe('cross');
});

test('while a call is in the air every control that would start another is off, and comes back when it is answered', async () => {
  const slow = later<unknown>();
  const w = world();
  w.log = serve((asked) => {
    if (asked.path === '/memories') return [memory()];
    if (asked.path === '/memories/m1/members' && asked.method === 'GET') return w.members;
    if (asked.path === '/contacts') return [];
    if (asked.method === 'DELETE') return slow.promise;
    return undefined;
  });
  const screen = await open();
  await screen.press(() => screen.button(ru.members.edit)[0]);
  await screen.press(() => screen.icon(ru.members.remove('pavel'))[0]);
  await act(async () => void screen.sheet()[0].props.onConfirm());
  // The pencil, the button, the invite and every cross wait; so does one’s own standing.
  expect(screen.icon(ru.settings.edit)[0].props.disabled).toBe(true);
  expect(screen.button(ru.action.done)[0].props.disabled).toBe(true);
  expect(screen.button(ru.action.invite)[0].props.disabled).toBe(true);
  expect(screen.icon(ru.members.remove('Лиза Морозова'))[0].props.disabled).toBe(true);
  expect(standingButton(screen, ru.standing.done).props.disabled).toBe(true);
  await act(async () => slow.settle({ ok: true }));
  expect(screen.icon(ru.settings.edit)[0].props.disabled).toBe(false);
  expect(screen.button(ru.action.invite)[0].props.disabled).toBe(false);
  expect(screen.icon(ru.members.remove('Лиза Морозова'))[0].props.disabled).toBe(false);
});

test('the invite sheet is raised by the button and put away by its own cancel', async () => {
  world();
  const screen = await open();
  const sheet = () => screen.root.findByType(InviteSheet);
  await screen.press(() => screen.button(ru.action.invite)[0]);
  expect(sheet().props.visible).toBe(true);
  await act(async () => sheet().props.onCancel());
  expect(sheet().props.visible).toBe(false);
});

test('the way back is the back it arrived on, or the memory itself when there is none', async () => {
  world();
  const screen = await open();
  await screen.press(() => screen.icon(ru.action.back)[0]);
  expect(router.back).toHaveBeenCalledTimes(1);
  router.canGoBack.mockReturnValue(false);
  await screen.press(() => screen.icon(ru.action.back)[0]);
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/memory/[id]', params: { id: 'm1' } });
});

test('a memory that is not on the list is a wait and not a crash, and the roster is not drawn under it', async () => {
  serve((asked) => (asked.path === '/memories' ? [memory({ id: 'other' })] : asked.path.endsWith('/members') ? roster() : undefined));
  const screen = await open();
  expect(screen.root.findAllByType(Waiting)).toHaveLength(1);
  expect(screen.rows()).toHaveLength(0);
});

test('in daylight the screen is drawn in the day’s tokens and carries none of the night’s', async () => {
  world();
  // The night is what the harness starts in, and the detector sees it — or the empty answer below proves nothing.
  expect(themesShown((await open()).root).night.length).toBeGreaterThan(0);
  await setTheme('light');
  try {
    const shown = themesShown((await open()).root);
    expect(shown.night).toEqual([]);
    expect(shown.day.length).toBeGreaterThan(0);
  } finally {
    await setTheme('dark');
  }
});

/**
 * Удаление воспоминания целиком (doc-01, 2026-09-24) — опасное действие внизу настроек: у
 * организатора оно есть, у остальных его нет вовсе, и лист-подтверждение называет цену цифрами.
 */
test('the way to delete the whole memory is drawn to the organizer and to nobody else', async () => {
  world();
  let screen = await open();
  expect(screen.button(ru.settings.delete)).toHaveLength(1);
  expect(screen.button(ru.settings.delete)[0].props.variant).toBe('danger');

  for (const id of ['liza', 'vera']) {
    who.id = id;
    world();
    screen = await open();
    expect(screen.button(ru.settings.delete), id).toHaveLength(0);
  }
});

test('the sheet names the price in figures — how many frames and movies go — and says it is for good', async () => {
  const state = world({ card: { media_count: 69, montage_count: 2, cover_thumbnail_url: 'https://r2.example/cover' } });
  const screen = await open();
  expect(screen.sheet()).toHaveLength(0);

  await screen.press(() => screen.button(ru.settings.delete)[0]);
  const ask = screen.sheet()[0].props;
  expect(ask.title).toBe(ru.settings.deleteAsk);
  expect(ask.text).toBe(ru.settings.deleteText);
  expect(ask.price).toBe(ru.settings.deletePrice(69, 2));
  expect(ask.price).toContain('69');
  expect(ask.price).toContain('2 ролика');
  expect(ask.text).toContain('навсегда');
  expect(ask.confirmLabel).toBe(ru.settings.deleteDo);
  expect(ask.cancelLabel).toBe(ru.settings.keep);
  // The memory itself is the thing on the sheet: its cover, its name and its days.
  expect(ask.thumb).toBe('https://r2.example/cover');
  expect(ask.meta).toContain('Свадьба Лизы и Марка');
  expect(ask.meta).toContain('12–13 сентября');

  // «Оставить» leaves it alone: nothing was asked of the api.
  await act(async () => ask.onCancel());
  expect(screen.sheet()).toHaveLength(0);
  expect(state.log.filter((one) => one.method === 'DELETE')).toEqual([]);
});

test('a memory with nothing in it names no price: there is nothing to lose', async () => {
  world({ card: { media_count: 0, montage_count: 0 } });
  const screen = await open();
  await screen.press(() => screen.button(ru.settings.delete)[0]);
  expect(screen.sheet()[0].props.price).toBeUndefined();
  // No cover and no frames — the sheet is the plain one, with the words alone.
  expect(screen.sheet()[0].props.thumb).toBeUndefined();
});

test('confirming deletes it in one request and leaves for the main screen', async () => {
  const state = world({ card: { montage_count: 2 } });
  const screen = await open();
  await screen.press(() => screen.button(ru.settings.delete)[0]);
  await act(async () => screen.sheet()[0].props.onConfirm());

  expect(state.log.filter((one) => one.method === 'DELETE')).toEqual([
    { method: 'DELETE', path: '/memories/m1', body: null },
  ]);
  expect(router.replace).toHaveBeenCalledWith('/');
  expect(screen.sheet()).toHaveLength(0);
  expect(screen.notice()).toEqual([]);
});

test('a memory somebody already deleted is the same outcome, and a refusal keeps the screen where it is', async () => {
  world({ onWipe: refused(404) });
  let screen = await open();
  await screen.press(() => screen.button(ru.settings.delete)[0]);
  await act(async () => screen.sheet()[0].props.onConfirm());
  // Gone is gone, however it went: the screen still leaves and says nothing about it.
  expect(router.replace).toHaveBeenCalledWith('/');
  expect(screen.notice()).toEqual([]);

  router.replace.mockClear();
  world({ onWipe: refused(500, 'boom') });
  screen = await open();
  await screen.press(() => screen.button(ru.settings.delete)[0]);
  await act(async () => screen.sheet()[0].props.onConfirm());
  expect(screen.notice()).toEqual(['boom']);
  expect(router.replace).not.toHaveBeenCalled();
  // And the way to try again is live, not stuck behind a busy button.
  expect(screen.button(ru.settings.delete)[0].props.disabled).toBe(false);
});
