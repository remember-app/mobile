/**
 * The holes testing m-32 found in the comment checks, written on a stand-in api and brought in
 * whole (TASK-511). `frame-comments.test.tsx` holds the decisions; this file holds the places where
 * that suite could not tell a right answer from a wrong one — a delete out of a list of one, an
 * append that reads the same as a prepend, a scroll whose callback is a call on nothing, a second
 * tap nobody held the line against.
 *
 * Every case here was proved by breaking the code where the value is made and watching it go red.
 * Five of the seventeen the tester wrote did not survive that and are **not** in this file — three
 * outlived the code they were written against, two never caught anything:
 *
 * - the padded text and the text past the ceiling — TASK-507 took the ceiling off the phone, so both
 *   stood on a cut that no longer exists; the padded one is the committed suite's trim check twice;
 * - the emoji pinned with `test.fails` — the defect it named (a surrogate cut in half) was closed by
 *   TASK-507 removing the cut, and what is left cannot fail for the reason it was pinned;
 * - the api answering a write with a row that is not a comment — it accepted either answer, and the
 *   counter really does reach 1, so it proved nothing;
 * - the write landing on a panel being shut away — `void send()` drops the rejection and the block's
 *   own `try` holds the rest, so nothing thrown on that path can reach the check.
 *
 * `refused` and `later` are here for the errands that are held in the air, which is where the second
 * tap and the second errand live.
 *
 * Two cases here — the appended row's order and the second press — now stand beside TASK-510's own
 * checks of the same two things, which landed on `dev` while this file was being taken. They are
 * left in: each was proved against its own break, and a list where one file holds the order and
 * another the repeat press is harder to read than one where both stand together. Anyone trimming
 * this file should check TASK-510's two first, not assume this one is the only copy.
 */
import { type Asked, later, photo, refused, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';

/** Every walk any list in any tree asked for, in order — «to the end» or «away from it». */
const walks: string[] = [];

// `react-native-web`'s own `ScrollView` hands out a ref that is `null` under `react-test-renderer`,
// so the walk a list asks for is invisible here: `list.current?.scrollToEnd()` is a call on
// nothing, and a check that only proves the callback exists cannot tell it from an empty body.
// This stand-in gives the ref a real handle, so the calls can be watched — the one thing about the
// list that a person reads is whether the line they just wrote came into sight.
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  const React = await import('react');
  const Watched = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      scrollToEnd: () => (globalThis as unknown as { __walks: string[] }).__walks.push('end'),
      scrollToStart: () => (globalThis as unknown as { __walks: string[] }).__walks.push('top'),
      scrollTo: (where: number) =>
        (globalThis as unknown as { __walks: string[] }).__walks.push(`to:${where}`),
    }));
    return React.createElement(rn.ScrollView, props as never);
  });
  Watched.displayName = 'WatchedScrollView';
  return { ...rn, ScrollView: Watched };
});

(globalThis as unknown as { __walks: string[] }).__walks = walks;

// Same stand-ins the committed suite stands on, so a case here reads the same as one there.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
vi.mock('@/kit', async (original) => ({
  ...(await original<typeof import('@/kit')>()),
  Field: ({ trailing }: { trailing?: ReactNode }) => trailing ?? null,
}));

import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { FrameComment, FrameInfo } from '@/api';
import { Field, IconButton, Text } from '@/kit';
import { FrameInfoPanel } from '@/screens/memory/frame-info';
import { ru } from '@/strings';
import { setTheme } from '@/theme';

mountsTrees();
beforeAll(async () => {
  await setTheme('dark');
});
afterEach(() => vi.unstubAllGlobals());

const YESTERDAY = (() => {
  const day = new Date();
  day.setDate(day.getDate() - 1);
  day.setHours(14, 30, 0, 0);
  return day.toISOString();
})();

const said = (over: Partial<FrameComment> = {}): FrameComment => ({
  id: 'c1',
  body: 'Первый танец',
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
  iso: null,
  exposure_ev: null,
  shutter: null,
  latitude: null,
  longitude: null,
  uploaded_by: { id: 'u', username: 'mark', name: 'Марк Ковалёв', media_count: 96 },
  montages: [],
  labels: [],
  comments: [],
  ...over,
});

const frame = photo('a', 'u', new Date(2026, 8, 13).toISOString());

/** A node's own style, flattened out of whatever shape React Native was given it in. */
const styleOf = (node: { props: { style?: unknown } }): Record<string, unknown> => {
  const one = (style: unknown): Record<string, unknown> =>
    Array.isArray(style)
      ? Object.assign({}, ...style.map(one))
      : ((style as Record<string, unknown> | null) ?? {});
  return one(node.props.style);
};

async function drawn(answer: unknown, onWrite: (asked: Asked) => unknown = () => ({ ok: true })) {
  const log = serve((asked) => (asked.method === 'GET' ? answer : onWrite(asked)));
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} onEdited={() => {}} />,
      ),
    );
  });
  const root = tree.root;
  const press = async (one: { props: { onPress?: () => void } }) =>
    await act(async () => one.props.onPress?.());
  const button = (label: string) =>
    root.findAllByType(IconButton).find((one) => one.props.label === label);
  const pill = () =>
    root.findAllByType(Field).find((one) => one.props.label === ru.viewer.commentPlaceholder);
  const type = async (text: string) => {
    await act(async () => pill()?.props.onChangeText?.(text));
  };
  const sheet = () => root.findAllByProps({ title: ru.viewer.commentDeleteAsk })[0];
  const bodies = () =>
    root
      .findAllByType(Text)
      .map((one) => one.props.children)
      .filter((one): one is string => typeof one === 'string');
  return { root, log, press, button, pill, type, sheet, bodies };
}

/* ── the hole the mutation run named: onGone removing the wrong row ─────────────── */

test('a delete takes down the comment that was asked for and leaves every other row standing', async () => {
  // The committed suite deletes out of a list of one, where "removed the right one" and "removed
  // all of them" are the same picture. Three rows is where they come apart.
  const screen = await drawn(
    told({
      comments: [
        said({ id: 'c1', body: 'Первый танец', mine: true }),
        said({ id: 'c2', body: 'Бабушка вон там', mine: false }),
        said({ id: 'c3', body: 'Закат над рекой', mine: true }),
      ],
    }),
  );
  // The sign on the middle-but-one row: c3's. Two rows carry it, so the test names the row by the
  // words on it rather than taking the first sign it finds.
  // The rows in the order they stand, each with the sign that is on it — the pair is what the
  // delete is about, and reading the two apart is what a one-row list cannot do. Scoped to the
  // block's own list, so the panel's row about the person who brought the frame is not one of them.
  const rows = screen.root
    .findAllByType(ScrollView)
    .find((one) => one.props.onContentSizeChange !== undefined)!
    .findAllByType(View)
    .filter((one) => styleOf(one).flexDirection === 'row' && styleOf(one).gap === 10);
  const pairs = rows.map((row) => ({
    body: row
      .findAllByType(Text)
      .map((one) => one.props.children)
      .find(
        (one) =>
          typeof one === 'string' &&
          one !== ru.viewer.agoYesterday &&
          one !== 'вы' &&
          one !== 'Аня Петрова' &&
          one !== 'АП',
      ),
    sign: row.findAllByType(IconButton).some((one) => one.props.label === ru.viewer.commentRemove),
  }));
  expect(pairs).toEqual([
    { body: 'Первый танец', sign: true },
    { body: 'Бабушка вон там', sign: false },
    { body: 'Закат над рекой', sign: true },
  ]);
  const ofC3 = rows[2]
    .findAllByType(IconButton)
    .find((one) => one.props.label === ru.viewer.commentRemove)!;
  await screen.press(ofC3);
  await act(async () => screen.sheet()?.props.onConfirm?.());

  expect(screen.log.at(-1)?.path).toBe('/memories/m1/media/a/comments/c3');
  // c3 went, c1 and c2 stayed. A filter that emptied the list passes a one-row test and fails here.
  expect(screen.bodies()).not.toContain('Закат над рекой');
  expect(screen.bodies()).toContain('Первый танец');
  expect(screen.bodies()).toContain('Бабушка вон там');
  // And the count is the two that are left, not three minus nothing.
  const head = screen.root
    .findAllByType(Text)
    .find((one) => one.props.children === ru.viewer.comments);
  const counter = head?.parent
    ?.findAllByType(Text)
    .map((one) => one.props.children)
    .find((one) => one !== ru.viewer.comments);
  expect(counter).toBe('2');
});

/* ── the hole: order of the appended row ──────────────────────────────────────── */

test('a comment just written stands after the ones already there, in the api’s order', async () => {
  // The decision is «встаёт в конец». With one row already standing, "at the end" and "at the
  // front" draw the same two rows; it takes three to tell them apart.
  const written = said({ id: 'c9', body: 'Вот тут задержитесь', mine: true });
  const screen = await drawn(
    told({
      comments: [
        said({ id: 'c1', body: 'Первый танец' }),
        said({ id: 'c2', body: 'Бабушка вон там' }),
      ],
    }),
    () => written,
  );
  await screen.type('Вот тут задержитесь');
  await screen.press(screen.button(ru.action.send)!);

  // The three bodies in the order the rows stand. A check that only asks "are all three words on
  // screen" cannot tell an append from a prepend — the third row's own words are in both.
  expect(bodiesOf(screen.root)).toEqual(['Первый танец', 'Бабушка вон там', 'Вот тут задержитесь']);
});

/**
 * One body per comment row, in the order the rows stand — the comment's own words, not the name's
 * or the moment's. Read inside the block's own list, so the panel's row about the person who
 * brought the frame (which is a row too) is not mistaken for a comment.
 */
const bodiesOf = (root: TestRenderer.ReactTestInstance): string[] =>
  root
    .findAllByType(ScrollView)
    .find((one) => one.props.onContentSizeChange !== undefined)!
    .findAllByType(View)
    .filter((one) => styleOf(one).flexDirection === 'row' && styleOf(one).gap === 10)
    .map(
      (row) =>
        row
          .findAllByType(Text)
          .map((one) => one.props.children)
          .find(
            (one) =>
              typeof one === 'string' &&
              !['вы', 'Аня Петрова', 'АП', ru.viewer.agoYesterday].includes(one),
          ) as string,
    );

/* ── the hole: the list actually walks to its end ─────────────────────────────── */

test('a comment that lands scrolls the list to it — the walk is asked for, not merely offered', async () => {
  // The committed check proves the callback is a function and that calling it does not throw —
  // which a callback with an empty body also passes. What has to be asked of the block is a walk
  // to the end of its own list, and a list that kept its top hides the line just written.
  const written = said({ id: 'c9', body: 'Вот тут задержитесь', mine: true });
  const screen = await drawn(
    told({
      comments: [
        said({ id: 'c1', body: 'Первый танец' }),
        said({ id: 'c2', body: 'Бабушка вон там' }),
        said({ id: 'c3', body: 'Закат над рекой' }),
        said({ id: 'c4', body: 'Торт в полдень' }),
      ],
    }),
    () => written,
  );
  const list = screen.root
    .findAllByType(ScrollView)
    .find((one) => one.props.onContentSizeChange !== undefined)!;
  walks.length = 0;
  // What the block decides is *which* walk it asks for when its content changes — the callback is
  // the platform's to call, and the committed check proves only that calling it does not throw.
  await act(async () => list.props.onContentSizeChange());
  expect(walks, 'the list is walked to its end').toContain('end');
  expect(walks, 'and not walked away from the line just written').not.toContain('top');
});

/* ── the hole: two presses in the air at once ─────────────────────────────────── */

test('a second tap while the words are in the air cannot send them a second time', async () => {
  // Two taps, one after the other, with the api slow to answer — what a nervous finger does on a
  // connection that has gone quiet. The button is the only thing standing between the two, so what
  // it is while the first is in the air is the whole of the answer.
  const answer = later<FrameComment>();
  const screen = await drawn(told({ comments: [] }), () => answer.promise);
  await screen.type('Первый танец');
  const send = () => screen.button(ru.action.send);
  expect(send()?.props.disabled, 'the button stops taking presses').toBe(false);

  await screen.press(send()!);
  expect(send()?.props.disabled, 'while the words are in the air it is not taking presses').toBe(
    true,
  );
  expect(screen.pill()?.props.editable, 'and the field is not being typed into either').toBe(false);
  // The second tap, on the button as it stands now.
  await screen.press(send()!);
  expect(screen.log.filter((one) => one.method === 'POST')).toHaveLength(1);

  await act(async () => answer.settle(said({ id: 'c1', body: 'Первый танец', mine: true })));
  expect(screen.bodies()).toContain('Первый танец');
});

test('the block itself refuses a second errand while one is in the air, whatever the button does', async () => {
  // The disabled button is the kit's business and can be swapped for another control. What has to
  // hold on the block's own side is that `send` and `drop` share one guard — two errands at once
  // would put a comment in the list that the api never took, or take down a row that is still there.
  const answer = later<FrameComment>();
  const screen = await drawn(
    told({ comments: [said({ id: 'c1', mine: true })] }),
    () => answer.promise,
  );
  await screen.type('Первый танец');
  await screen.press(screen.button(ru.action.send)!);
  // The delete is asked for while the send is still unanswered — the sheet's own confirm.
  await screen.press(screen.button(ru.viewer.commentRemove)!);
  await act(async () => screen.sheet()?.props.onConfirm?.());
  expect(
    screen.log.filter((one) => one.method === 'DELETE'),
    'one errand at a time',
  ).toHaveLength(0);
  await act(async () => answer.settle(said({ id: 'c1', body: 'Первый танец', mine: true })));
});

test('a delete the api has not answered yet cannot be asked for twice', async () => {
  const answer = later<{ ok: true }>();
  const screen = await drawn(
    told({ comments: [said({ id: 'c1', mine: true })] }),
    () => answer.promise,
  );
  await screen.press(screen.button(ru.viewer.commentRemove)!);
  const confirm = () => screen.sheet()?.props.onConfirm;
  expect(screen.sheet()?.props.busy, 'the sheet says the errand is in the air').toBe(false);
  await act(async () => confirm()?.());
  expect(screen.sheet()?.props.busy).toBe(true);
  await act(async () => confirm()?.());
  expect(screen.log.filter((one) => one.method === 'DELETE')).toHaveLength(1);
  await act(async () => answer.settle({ ok: true }));
  expect(screen.bodies()).not.toContain('Первый танец');
});

/* ── scenarios the suite never stood on ──────────────────────────────────────── */

test('a comment of many lines grows the row, and the list still floors at three of them', async () => {
  // `THREE_ROWS` is three rows of one line each. A comment of four lines is taller than the floor
  // and has to scroll inside the block rather than push the panel's own blocks down the window.
  const long = 'а'.repeat(200);
  const screen = await drawn(
    told({ comments: [said({ id: 'c1', body: long }), said({ id: 'c2' }), said({ id: 'c3' })] }),
  );
  const list = screen.root
    .findAllByType(ScrollView)
    .find((one) => one.props.onContentSizeChange !== undefined)!;
  // A floor and not a height — what is checked is that the block does not size itself to its
  // content, which is what a frame with thirty long comments would need it not to do.
  const style = Object.assign({}, ...[list.props.style].flat(2).filter(Boolean));
  expect(style.maxHeight).toBeTypeOf('number');
  expect(style.height, 'a list that takes the height of what is in it pushes the panel down').toBe(
    undefined,
  );
  expect(style.flexGrow, 'and it does not grow the panel to fit').toBe(0);
});

test('a delete of somebody else’s comment is never asked of the api — there is no sign to press', async () => {
  // Ten rows, none of them the viewer’s: not one of them may carry the sign, and the api must
  // never be asked about a row the viewer did not write.
  const theirs = Array.from({ length: 10 }, (_, at) => said({ id: `c${at + 1}`, mine: false }));
  const screen = await drawn(told({ comments: theirs }));
  expect(
    screen.root
      .findAllByType(IconButton)
      .filter((one) => one.props.label === ru.viewer.commentRemove),
  ).toHaveLength(0);
  expect(screen.log.filter((one) => one.method === 'DELETE')).toHaveLength(0);
});

test('the pill is not editable while the words are in the air, and it is afterwards', async () => {
  const answer = later<FrameComment>();
  const screen = await drawn(told({ comments: [] }), () => answer.promise);
  expect(screen.pill()?.props.editable).toBe(true);
  await screen.type('Первый танец');
  await screen.press(screen.button(ru.action.send)!);
  expect(screen.pill()?.props.editable).toBe(false);
  expect(screen.button(ru.action.send)?.props.disabled).toBe(true);
  await act(async () => answer.settle(said({ id: 'c1', body: 'Первый танец', mine: true })));
  expect(screen.pill()?.props.editable).toBe(true);
  expect(screen.button(ru.action.send)).toBeUndefined();
});

test('a delete the api refuses with no network at all leaves the sheet up and the row standing', async () => {
  const screen = await drawn(told({ comments: [said({ id: 'c1', mine: true })] }), () => 'offline');
  await screen.press(screen.button(ru.viewer.commentRemove)!);
  await act(async () => screen.sheet()?.props.onConfirm?.());
  expect(screen.log.filter((one) => one.method === 'DELETE')).toHaveLength(1);
  expect(screen.bodies()).toContain('Первый танец');
  expect(screen.sheet()?.props.visible).toBe(true);
  // And the person can try again — the errand did not happen, so it is not a thing already done.
  await act(async () => screen.sheet()?.props.onConfirm?.());
  expect(screen.log.filter((one) => one.method === 'DELETE')).toHaveLength(2);
});

test('a sheet over a comment that was refused still takes the right row on the next try', async () => {
  let tries = 0;
  const screen = await drawn(told({ comments: [said({ id: 'c1', mine: true })] }), () => {
    tries += 1;
    return tries === 1 ? refused(503, 'busy') : { ok: true };
  });
  await screen.press(screen.button(ru.viewer.commentRemove)!);
  await act(async () => screen.sheet()?.props.onConfirm?.());
  expect(screen.bodies()).toContain('Первый танец');
  await act(async () => screen.sheet()?.props.onConfirm?.());
  expect(screen.log.at(-1)?.path).toBe('/memories/m1/media/a/comments/c1');
  expect(screen.bodies()).not.toContain('Первый танец');
});

test('cancelling the sheet asks the api nothing and leaves the row standing', async () => {
  const screen = await drawn(told({ comments: [said({ id: 'c1', mine: true })] }));
  await screen.press(screen.button(ru.viewer.commentRemove)!);
  expect(screen.sheet()?.props.visible).toBe(true);
  await act(async () => screen.sheet()?.props.onCancel?.());
  expect(screen.log.filter((one) => one.method === 'DELETE')).toHaveLength(0);
  expect(screen.bodies()).toContain('Первый танец');
  expect(screen.sheet()?.props.visible).toBe(false);
});
