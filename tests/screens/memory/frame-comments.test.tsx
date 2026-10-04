import { type Asked, later, photo, refused, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
// `Field` stood in for the way `film-flow` stands it in: a real `TextInput` under
// `react-test-renderer` is about neither this block nor anything else here, and what is under test
// is what the panel hands the field — its value, its error state and the change it sends back. How
// the pill itself draws is `tests/kit/field.test.tsx`'s, and it now has this variant to draw. What
// goes *into* the field is still mounted, because the button that sends lives there.
vi.mock('@/kit', async (original) => ({
  ...(await original<typeof import('@/kit')>()),
  Field: ({ trailing }: { trailing?: ReactNode }) => trailing ?? null,
}));

import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { FrameComment, FrameInfo } from '@/api';
import { Avatar, ConfirmSheet, Field, IconButton, Text } from '@/kit';
import { compiled } from '@/kit/story';
import { FrameInfoPanel } from '@/screens/memory/frame-info';
import { ru } from '@/strings';
import { setTheme } from '@/theme';

/**
 * «Комментарии» on `FrameInfo` (spec 8, `FrameInfo.html` lines 33–49, TASK-499) — what people wrote
 * under a frame, mounted through the panel that holds the block, so what is asked of it here is what
 * the panel draws and what a press on it sends.
 *
 * Six decisions of the human's own (2026-10-03) are what the cases below are: sending, deleting
 * one's own, the empty list, one's own row, the list scrolling, and the words that did not go.
 * What each one is worth is that a check **breaks where the value is made**, so every case here
 * names the place: the api answer that fills the list, the flag that turns a name into «вы», the
 * one that draws the sign, the words under the pill.
 */

mountsTrees();

beforeAll(async () => {
  await setTheme('dark');
});
afterEach(() => vi.unstubAllGlobals());

/** A day ago, at an hour that cannot fall on either side of midnight — «вчера» in every run. */
const YESTERDAY = (() => {
  const day = new Date();
  day.setDate(day.getDate() - 1);
  day.setHours(14, 30, 0, 0);
  return day.toISOString();
})();

const said = (over: Partial<FrameComment> = {}): FrameComment => ({
  id: 'c1',
  body: 'Здесь бабушка первый раз увидела платье — возьмите в ролик',
  created_at: YESTERDAY,
  author: { id: 'u', username: 'anya', name: 'Аня Петрова' },
  mine: false,
  ...over,
});

const told = (over: Partial<FrameInfo> = {}): FrameInfo => ({
  id: 'a',
  size_bytes: '4200000',
  captured_at: new Date(2026, 8, 13, 21, 47).toISOString(),
  created_at: new Date(2026, 8, 15, 9, 12).toISOString(),
  width: 4032,
  height: 3024,
  camera_model: null,
  focal_length_mm: null,
  aperture: null,
  latitude: null,
  longitude: null,
  uploaded_by: { id: 'u', username: 'mark', name: 'Марк Ковалёв', media_count: 96 },
  montages: [],
  labels: [],
  comments: [],
  ...over,
});

const frame = photo('a', 'u', new Date(2026, 8, 13).toISOString());
/** A video is the same panel with a different kind of row under it — the block is not about that. */
const video = photo('a', 'u', new Date(2026, 8, 13).toISOString(), {
  kind: 'video',
  duration_seconds: 42,
});

/** A write the api takes: `{ok:true}` for the delete, the row itself for the post. */
const ok = () => ({ ok: true });

/**
 * The panel mounted against a stand-in api, which is where its one read comes from. The read is
 * answered with `answer`; a write goes to `onWrite`, which by default says yes the way the api
 * does — a test about a failure names its own.
 */
async function drawn(answer: unknown, item = frame, onWrite: (asked: Asked) => unknown = ok) {
  const log = serve((asked) => (asked.method === 'GET' ? answer : onWrite(asked)));
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<FrameInfoPanel memoryId="m1" item={item} onFilm={() => {}} />),
    );
  });
  const root = tree.root;
  const press = (one: { props: { onPress?: () => void } }) =>
    act(async () => one.props.onPress?.());
  const button = (label: string) =>
    root.findAllByType(IconButton).find((one) => one.props.label === label);
  /** The pill, found by its placeholder — the one field the block adds to the panel. */
  const pill = () =>
    root.findAllByType(Field).find((one) => one.props.label === ru.viewer.commentPlaceholder);
  const type = async (text: string) => {
    await act(async () => pill()?.props.onChangeText?.(text));
  };
  return {
    root,
    log,
    press,
    button,
    pill,
    type,
    /** Every line of words on the panel, as one string — for what stands and what does not. */
    said: () =>
      root
        .findAllByType(Text)
        .map((one) => one.props.children)
        .join(' · '),
    /** The block's own words, without the panel's — the file, the person and the count beside. */
    words: () =>
      root
        .findAllByType(Text)
        .map((one) => one.props.children)
        .filter((one) => typeof one === 'string') as string[],
  };
}

test('a frame nobody wrote under says so under a counter of zero, and the block is still there', async () => {
  // An empty list is a fact about the frame, not a missing field and not a spinner: the api sends
  // `[]`, and «пока никто не написал» is the answer to it. What draws no block at all is an api
  // that sent no `comments` — which is not the same thing and must not read as one.
  const empty = await drawn(told({ comments: [] }));
  expect(empty.words()).toContain(ru.viewer.comments);
  expect(empty.words()).toContain('0');
  expect(empty.words()).toContain(ru.viewer.commentsNone);
  // The pill is the way in, and it stands in both cases — the field is not the block.
  expect(empty.pill()).toBeDefined();

  // The field itself missing: no block, and nothing standing in for it.
  const absent = await drawn({ ...told(), comments: undefined });
  expect(absent.words()).not.toContain(ru.viewer.comments);
  expect(absent.words()).not.toContain(ru.viewer.commentsNone);
  expect(absent.pill()).toBeUndefined();
});

test('a comment of somebody else stands as their name and their body, with no sign on it', async () => {
  const screen = await drawn(told({ comments: [said()] }));
  expect(screen.words()).toContain('Аня Петрова');
  expect(screen.words()).toContain(ru.viewer.agoYesterday);
  expect(screen.words()).toContain(said().body);
  expect(screen.words()).toContain('1');
  // The sign is drawn where the api said `mine` — and the api did not.
  expect(screen.button(ru.viewer.commentRemove)).toBeUndefined();
});

test('a comment of their own is the same row with «вы» where the name stands, and the sign on it', async () => {
  const screen = await drawn(told({ comments: [said({ mine: true })] }));
  // One place makes the name, and it is the flag: break `comment.mine` and the name goes with it.
  expect(screen.words()).toContain(ru.viewer.commentMine);
  expect(screen.words()).not.toContain('Аня Петрова');
  // The body and the moment are the same row's, not a second kind of thing.
  expect(screen.words()).toContain(said().body);
  expect(screen.words()).toContain(ru.viewer.agoYesterday);
  expect(screen.button(ru.viewer.commentRemove)).toBeDefined();
});

test('a row is the drawing: a 28 face, 10 from the words, the name 7 from when it was written', async () => {
  // `FrameInfo.html` lines 40–43. The sizes and the air between them are the whole of what the
  // drawing settles here, and each of them is one number somewhere in this block's own styles.
  const screen = await drawn(told({ comments: [said()] }));
  const avatar = screen.root.findAllByType(Avatar)[0];
  expect(avatar.props.size).toBe(28);

  // The row: the face at the left, the words taking what is left of it.
  const row = screen.root
    .findAllByType(View)
    .find((one) => styleOf(one).flexDirection === 'row' && styleOf(one).gap === 10);
  expect(row, 'the row: face and words').toBeDefined();
  const words = styleOf(row!);
  expect(words.gap).toBe(10);
  expect(words.alignItems).toBe('flex-start');

  // The name and the moment share a baseline 7 apart — line 42 — while the block's own head row
  // shares one 8 apart, so the row inside a comment is picked out by its own number.
  const line = screen.root
    .findAllByType(View)
    .find((one) => styleOf(one).alignItems === 'baseline' && styleOf(one).gap === 7);
  expect(line, 'the name and when it was written').toBeDefined();
  const stack = screen.root.findAllByType(View).find((one) => styleOf(one).gap === 2);
  expect(stack, 'the words under the name').toBeDefined();
});

test('the count is the whole number, not a count of what fits — three stand and the fourth says 4', async () => {
  const many = await drawn(
    told({
      comments: [said({ id: 'c1' }), said({ id: 'c2' }), said({ id: 'c3' }), said({ id: 'c4' })],
    }),
  );
  // Every row is drawn; the list scrolls inside itself rather than dropping the ones past the third.
  for (const one of ['c1', 'c2', 'c3', 'c4']) {
    expect(many.words().filter((word) => word === 'Аня Петрова').length, one).toBe(4);
  }
  expect(counterOf(many.root)).toBe('4');
});

test('the count is the whole number at every size — nothing about it is cut to fit', async () => {
  // The fifth decision: «счётчик всегда показывает полное число и не обрезается». The check above
  // reads four, and every way of cutting a number agrees with the number itself below ten — so a
  // check on four alone cannot tell a whole count from a cut one.
  //
  // What is asked here is the invariant and not a number: the counter equals the number of rows
  // standing, checked over sizes that cross every place a cutting could happen. A count cut to its
  // last digit fails at ten, one cut to a fixed width fails at three digits, and one cut to what is
  // in sight fails the moment there are more rows than fit — so the class of cuttings is what dies
  // here, not one way of doing it.
  for (const n of [1, 3, 4, 9, 10, 12, 25, 99, 100, 123, 1001]) {
    const ids = Array.from({ length: n }, (_, at) => `c${at + 1}`);
    const screen = await drawn(told({ comments: ids.map((id) => said({ id })) }));
    expect(counterOf(screen.root), `counter at ${n} comments`).toBe(String(n));
    // And the rows behind it are all of them: a count of what is in sight would be in sight.
    expect(
      screen.words().filter((word) => word === 'Аня Петрова'),
      `rows at ${n}`,
    ).toHaveLength(n);
  }
});

/**
 * The number in the block's head, read as the one standing next to the heading rather than as any
 * number on the panel — the file's own lines carry digits too, and a check that went looking for
 * its count among all of them would be satisfied by the wrong one.
 */
const counterOf = (root: TestRenderer.ReactTestInstance): string | undefined => {
  const head = root.findAllByType(Text).find((one) => one.props.children === ru.viewer.comments);
  const siblings = head?.parent?.findAllByType(Text) ?? [];
  return siblings.map((one) => one.props.children).find((one) => one !== ru.viewer.comments) as
    | string
    | undefined;
};

/** A node's own style, flattened out of whatever shape React Native was given it in. */
const styleOf = (node: { props: { style?: unknown } }): Record<string, unknown> => {
  const one = (style: unknown): Record<string, unknown> =>
    Array.isArray(style)
      ? Object.assign({}, ...style.map(one))
      : ((style as Record<string, unknown> | null) ?? {});
  return one(node.props.style);
};

test('the list is floored at three rows and walks to its end when the list grows', async () => {
  // The fifth decision: three comments stand without a scroll and the rest are reached inside the
  // block, so a frame with thirty under it has not pushed the panel's own blocks off the window.
  const four = await drawn(
    told({
      comments: [said({ id: 'c1' }), said({ id: 'c2' }), said({ id: 'c3' }), said({ id: 'c4' })],
    }),
  );
  // The panel's own scroll is around it; this is the list inside the block, which is the one that
  // carries the floor and the walk.
  const list = four.root
    .findAllByType(ScrollView)
    .find((one) => one.props.onContentSizeChange !== undefined)!;
  // A floor and not a height: three rows of one line each (36) and the two 12s between them, so
  // three stand without a scroll and a row of two lines grows past it. Read off the sheet the style
  // compiled to, the way the kit's own stories read a shape.
  expect(compiled()).toContain(`max-height:${3 * 36 + 2 * 12}px`);
  // The 12 between the rows has to be there for the arithmetic to be about anything: without it
  // the floor is three rows and 24 of air, and the fourth comment arrives at a line already off.
  expect(JSON.stringify(list.props.contentContainerStyle)).toContain('gap');
  expect(JSON.stringify(list.props.contentContainerStyle)).toContain('12');
  // And a row pads nothing of its own, or the 36 above is not a row and the three do not fit.
  const row = four.root
    .findAllByType(View)
    .find((one) => styleOf(one).flexDirection === 'row' && styleOf(one).gap === 10);
  expect(row, 'the comment row: the face 28, 10 from the words').toBeDefined();
  expect(styleOf(row!), 'a row that pads itself is not a row').not.toHaveProperty(
    'paddingVertical',
  );

  // And the list walks to its end: a comment just written joins at the end of the api's order, and
  // a person who cannot see the line they just wrote has not been told anything. The scroll itself
  // belongs to the browser's own `ScrollView`, which carries no prototype to stand in for here — so
  // what is checked is the one thing this block decides, that it asks for the walk and not for a
  // fixed place. A list that kept its top would hide the line that was just written.
  const grow = list.props.onContentSizeChange;
  expect(grow).toBeTypeOf('function');
  // Calling it is what happens on every change of what fits inside: a new comment, and the api's
  // answer landing. It must not throw with a list that has nothing to scroll yet.
  await act(async () => grow());
});

test('the button stands in the pill only once there is something in it', async () => {
  const screen = await drawn(told({ comments: [] }));
  expect(screen.pill()).toBeDefined();
  // An empty pill has no button — the decision is the human's, and it is where the trim is.
  expect(screen.button(ru.action.send)).toBeUndefined();
  await screen.type('Бабушка вон там');
  expect(screen.button(ru.action.send)).toBeDefined();
  // And only whitespace is still nothing.
  await screen.type('   ');
  expect(screen.button(ru.action.send)).toBeUndefined();
});

test('a press sends the words, the api’s own row joins the end of the list, and the pill empties', async () => {
  const written = said({ id: 'c9', body: 'Первый танец', mine: true });
  const log = serve((asked: Asked) =>
    asked.method === 'GET' ? told({ comments: [said()] }) : written,
  );
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} />),
    );
  });
  const root = tree.root;
  const send = () =>
    root.findAllByType(IconButton).find((one) => one.props.label === ru.action.send);
  // Padded at both ends on purpose: what goes over the wire is the sentence, not the spaces a
  // phone's keyboard left around it. The api trims as well, and the row it hands back is already
  // the trimmed one — this checks the phone, not the server.
  await act(async () => root.findAllByType(Field)[0]?.props.onChangeText?.('  Первый танец  '));
  await act(async () => send()?.props.onPress?.());
  // The body goes as written under this frame, and the api is asked nothing else: the row comes
  // back in the read's own form, so the list grows by it rather than by a second round trip.
  expect(log.filter((one) => one.method === 'POST')).toHaveLength(1);
  expect(log.at(-1)?.path).toBe('/memories/m1/media/a/comments');
  expect(log.at(-1)?.body).toEqual({ body: 'Первый танец' });
  const words = root
    .findAllByType(Text)
    .map((one) => one.props.children)
    .filter((one) => typeof one === 'string');
  expect(words).toContain('Первый танец');
  expect(words).toContain('2');
  // And the pill is empty again, so its button has gone with it.
  expect(send()).toBeUndefined();
});

test('a comment goes under a video exactly as it goes under a photograph', async () => {
  // One panel, one block: the kind of the frame is not anything this block reads.
  const screen = await drawn(told({ comments: [said({ mine: true })] }), video);
  expect(screen.words()).toContain(said().body);
  expect(screen.button(ru.viewer.commentRemove)).toBeDefined();
  await screen.type('Вот тут задержитесь');
  expect(screen.button(ru.action.send)).toBeDefined();
});

test('the sign of their own comment drops a sheet that asks, and the api takes the comment down', async () => {
  const screen = await drawn(told({ comments: [said({ mine: true })] }));
  const sheet = () => screen.root.findAllByType(ConfirmSheet)[0];
  // Nothing is asked before the sign is pressed.
  expect(sheet()?.props.visible).toBe(false);
  await screen.press(screen.button(ru.viewer.commentRemove)!);
  expect(sheet()?.props.visible).toBe(true);
  expect(sheet()?.props.title).toBe(ru.viewer.commentDeleteAsk);
  expect(screen.log.filter((one) => one.method === 'DELETE')).toHaveLength(0);

  await act(async () => sheet()?.props.onConfirm());
  expect(screen.log.at(-1)?.method).toBe('DELETE');
  expect(screen.log.at(-1)?.path).toBe('/memories/m1/media/a/comments/c1');
  // Gone from the panel, and the count says so.
  expect(screen.words()).not.toContain(said().body);
  expect(screen.words()).toContain('0');
  // And the sheet goes with it — a sheet left standing over a comment that is no longer there is
  // a sheet asking about something the person can no longer see.
  expect(sheet()?.props.visible).toBe(false);
});

test('a delete the api refuses takes nothing down, and the sheet stays up over the comment', async () => {
  // The comment is still there because the api said so. Closing the sheet over it would be the app
  // deciding on the server's behalf that the words went.
  const screen = await drawn(told({ comments: [said({ mine: true })] }), frame, () =>
    refused(404, 'not found'),
  );
  const sheet = () => screen.root.findAllByType(ConfirmSheet)[0];
  await screen.press(screen.button(ru.viewer.commentRemove)!);
  await act(async () => sheet()?.props.onConfirm());
  expect(screen.log.filter((one) => one.method === 'DELETE')).toHaveLength(1);
  // The comment stands, and the count with it.
  expect(screen.words()).toContain(said().body);
  expect(screen.words()).toContain('1');
  expect(sheet()?.props.visible).toBe(true);
});

test('somebody else’s comment has no sign at all — the api owns that rule, not the phone', async () => {
  // The row comes down with `mine: false` and nothing is drawn to change it: an organizer takes
  // frames down, not words, and the app never repeats a rule the server enforces.
  const screen = await drawn(told({ comments: [said({ mine: false })] }));
  expect(screen.button(ru.viewer.commentRemove)).toBeUndefined();
  expect(screen.log.filter((one) => one.method === 'DELETE')).toHaveLength(0);
});

test('words that did not go stay in the pill, the field wears the red, and pressing again sends them', async () => {
  let tries = 0;
  const log = serve((asked: Asked) => {
    if (asked.method === 'GET') return told({ comments: [] });
    tries += 1;
    // The first attempt never lands — a connection that is not there, which is what the decision
    // describes; the second goes.
    return tries === 1 ? 'offline' : said({ id: 'c1', body: 'Первый танец', mine: true });
  });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} />),
    );
  });
  const root = tree.root;
  const pill = () =>
    root.findAllByType(Field).find((one) => one.props.label === ru.viewer.commentPlaceholder);
  const send = () =>
    root.findAllByType(IconButton).find((one) => one.props.label === ru.action.send);
  const words = () =>
    root
      .findAllByType(Text)
      .map((one) => one.props.children)
      .filter((one) => typeof one === 'string');

  await act(async () => pill()?.props.onChangeText?.('Первый танец'));
  await act(async () => send()?.props.onPress?.());

  // The words are still in the field — not thrown away, not moved somewhere else.
  expect(pill()?.props.value).toBe('Первый танец');
  // The field is the thing that wears the red: the api's refusal is not a banner over the panel,
  // which is still true about everything else.
  expect(pill()?.props.state).toBe('error');
  expect(words()).toContain(ru.viewer.commentNotSent);
  // And nothing was added to the list for a comment the api never took.
  expect(words()).not.toContain('1');

  // Pressing again sends the very same words.
  await act(async () => send()?.props.onPress?.());
  expect(log.filter((one) => one.method === 'POST')).toHaveLength(2);
  expect(log.at(-1)?.body).toEqual({ body: 'Первый танец' });
  expect(words()).toContain('Первый танец');
  expect(pill()?.props.state).toBeUndefined();
  expect(words()).not.toContain(ru.viewer.commentNotSent);
});

test('the red field and its line go as soon as the words are touched again', async () => {
  // The failure is about those words and not about the field: retyping is not sending, so it
  // takes the apology away and leaves the sentence in the pill to send.
  const screen = await drawn(told({ comments: [] }), frame, () => refused(503, 'busy'));
  await screen.type('Первый танец');
  await screen.press(screen.button(ru.action.send)!);
  expect(screen.pill()?.props.state).toBe('error');
  expect(screen.words()).toContain(ru.viewer.commentNotSent);
  await screen.type('Первый танец ');
  expect(screen.pill()?.props.state).toBeUndefined();
  expect(screen.words()).not.toContain(ru.viewer.commentNotSent);
});

test('the phone holds no ceiling of its own: what was written is what goes over the wire', async () => {
  // The ceiling belongs to the api (`MAX_COMMENT_LENGTH`), and a phone that kept a copy of the
  // number would answer for a limit it cannot see — so nothing is cut here and nothing counts down.
  // What a person wrote is what the api is asked, whole; what the api answers is the whole answer.
  const screen = await drawn(told({ comments: [] }));
  const long = 'а'.repeat(900);
  await screen.type(long);
  expect(screen.pill()?.props.value).toBe(long);
  await screen.press(screen.button(ru.action.send)!);
  expect(screen.log.at(-1)?.body).toEqual({ body: long });
});

test('an emoji a ceiling would have cut in half reaches the api whole', async () => {
  // Why the ceiling cannot simply be copied and obeyed: the base counts an emoji as one letter and
  // a phone as two, so `slice` at the api's own 500 lands between the halves of a pair and sends
  // back a broken character no wording can undo. Written whole is the only way it survives, which
  // is what makes TASK-509's slice redundant rather than merely nicer (decision, TASK-507).
  const screen = await drawn(told({ comments: [] }));
  // 300 emojis are 600 units — over the api's 500 counted the api's way and a slice's way both.
  const said = '😀'.repeat(300);
  await screen.type(said);
  expect(screen.pill()?.props.value).toBe(said);
  await screen.press(screen.button(ru.action.send)!);
  expect(screen.log.at(-1)?.body).toEqual({ body: said });
});

test('a refusal over the api’s ceiling leaves the words where they were written', async () => {
  // The other half of handing the ceiling over: now that the phone does not pre-empt it, an over-long
  // comment is the api's 400 to give, and it must arrive as a refusal with the words still in the
  // pill — not as a silently shortened text that went through. What the line under the field *says*
  // about it is TASK-506's to word; that the words survive the refusal is this screen's own.
  const long = 'а'.repeat(900);
  const screen = await drawn(told({ comments: [] }), frame, () => refused(400, 'too long'));
  await screen.type(long);
  await screen.press(screen.button(ru.action.send)!);
  expect(screen.pill()?.props.value).toBe(long);
  expect(screen.pill()?.props.state).toBe('error');
  expect(screen.words()).toContain(ru.viewer.commentNotSent);
  // And nothing was added to the list for a comment the api never took.
  expect(screen.words()).not.toContain('1');
});

test('a comment is named by its day, and only the two nearest days are named by words', async () => {
  // The decision is made in one place (`formatAgo`) and the words for it are the dictionary's, so
  // there is no second reading of the same moment anywhere on the screen.
  const morning = new Date();
  morning.setHours(9, 0, 0, 0);
  const threeBack = new Date();
  threeBack.setDate(threeBack.getDate() - 3);
  threeBack.setHours(9, 0, 0, 0);

  const screen = await drawn(
    told({
      comments: [
        // Written today. There is no «сегодня» in the dictionary on purpose: a moment under a day
        // old belongs to its own day, and that is what every other line on this panel writes.
        said({ id: 'c1', created_at: morning.toISOString() }),
        said({ id: 'c2', created_at: YESTERDAY }),
        said({ id: 'c3', created_at: threeBack.toISOString() }),
      ],
    }),
  );
  const found = screen.words();
  expect(found).toContain(ru.viewer.agoYesterday);
  // Both of the named days are read off the local day, and the older one falls to a plain day —
  // «3 октября», written the way every other day on the panel is written, not «109 дней назад».
  const plain = `${threeBack.getDate()} ${threeBack
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    .replace(/[\d\s.,]+/g, ' ')
    .trim()}`;
  expect(found).toContain(plain);
});

test('a read that has not answered yet is a wait with no comments block over it', async () => {
  // The block belongs to a frame the panel knows about; before the read lands there is nothing to
  // hang it on, and an empty counter would be a number about nobody.
  const answer = later<unknown>();
  serve(() => answer.promise);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} />),
    );
  });
  const saidNow = () =>
    tree.root
      .findAllByType(Text)
      .map((one) => one.props.children)
      .filter((one) => typeof one === 'string');
  expect(saidNow()).not.toContain(ru.viewer.comments);
  await act(async () => answer.settle(told({ comments: [] })));
  expect(saidNow()).toContain(ru.viewer.comments);
});
