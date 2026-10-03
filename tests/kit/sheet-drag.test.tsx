import { afterEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { restFinger, touch } from '@tests/helpers/gesture';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { ScrollView } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { Button } from '@/kit/button';
import { Sheet } from '@/kit/sheet';
import { Text } from '@/kit/text';
import { DROP, SIDEWAYS } from '@/lib/gesture';

/**
 * A sheet is let go of by a downward drag on its handle and its head, and by nothing else
 * (TASK-477, AC #3). The load-bearing claim is the negative one: a sheet has a scroll of its own
 * inside it, «листать» and «закрыть» are the same movement, and the drag must not close a sheet
 * whose body the person was only trying to read.
 *
 * That is settled by which view the responder is hung on rather than by what a gesture looks like,
 * so most of what is here is about where the drag does and does not land.
 */

mountsTrees();

async function up(onCancel = vi.fn()) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <Sheet visible onCancel={onCancel} title="Фильтры">
          <Text>Кто принёс</Text>
          <Text>Когда</Text>
        </Sheet>,
      ),
    );
  });
  // Taken down at the end of this test, not at the end of the run: a sheet left standing is a live
  // responder answering for one that has gone, and `find` below lands on whichever comes first.
  afterEach(async () => act(async () => tree.unmount()));
  const grab = () =>
    tree.root.find((one) => typeof one.props.onMoveShouldSetResponderCapture === 'function');
  /** The sheet's own scroll — the view a drag over the body must never be taken by. */
  const body = () => tree.root.findByType(ScrollView);

  /**
   * A finger that goes down on `view` and is pulled down, as the responder system has it: start
   * capture, down, grant, the move that may claim it, and the lift — the whole order, because
   * `PanResponder` resets its tally of how far the finger has come on the start capture and not
   * before, so a helper that skipped it measured each gesture against the one before it.
   *
   * Every step is optional on the view — the scroll under the body has its own set and the grab
   * zone has ours — which is the point: a drag begun over the body is asked of a view that never
   * answers it.
   *
   * `over` is how long the finger took in milliseconds. It matters: «let go» and «flick» are the
   * same movement and only the speed tells them apart, so a drag meant to be slow has to be slow.
   */
  const dragFrom = async (
    view: () => { props: Record<string, unknown> },
    dy: number,
    over = 400,
  ) => {
    let taken = false;
    // The whole gesture inside one `act()`, because that is what one is: a finger going down,
    // moving and lifting is one thing that happened, and a flush between the parts of it is a
    // re-render the phone never does mid-gesture. It matters here rather than being tidiness —
    // `PanResponder` keeps how far the finger has come inside the object `create` hands back, so a
    // render between the events rebuilds it and the new one counts from nothing. A drag of 11 would
    // then be measured as the 200 of whatever came before it.
    await act(async () => {
      const zone = view();
      const call = (name: string, at: ReturnType<typeof touch>) => {
        if (typeof zone.props[name] !== 'function') return undefined;
        return (zone.props[name] as (e: unknown) => unknown)(at);
      };
      restFinger();
      call('onStartShouldSetResponderCapture', touch({ x: 100, y: 20 }));
      call('onStartShouldSetResponder', touch({ x: 100, y: 20 }));
      call('onResponderGrant', touch({ x: 100, y: 20 }));
      taken = Boolean(
        call(
          'onMoveShouldSetResponderCapture',
          touch({ x: 100, y: 20 + dy, fromX: 100, fromY: 20, over }),
        ),
      );
      if (taken) {
        // The finger lifts the moment it arrives, and the lift costs no more time than the move
        // did: the speed the release decides on is the speed the move reported, so a lift stamped
        // as another `over` milliseconds away would halve it and a flick read as a drag.
        call('onResponderRelease', touch({ x: 100, y: 20 + dy }));
      }
    });
    return taken;
  };

  return {
    onCancel,
    root: tree.root,
    grab,
    body,
    /** A drag down on the handle, deliberately slow unless a test says otherwise. */
    drag: (dy: number, over = 400) => dragFrom(grab, dy, over),
    dragOverBody: (dy: number, over = 400) => dragFrom(body, dy, over),
  };
}

test('a drag down on the handle closes the sheet, once it has come far enough', async () => {
  const sheet = await up();
  expect(await sheet.drag(DROP)).toBe(true);
  expect(sheet.onCancel).toHaveBeenCalledTimes(1);
});

test('a short slow drag down brings the sheet back rather than closing it', async () => {
  const sheet = await up();
  // Enough to be a gesture and taken off whatever is under it, not enough to mean it: well short of
  // the distance, and slow enough that it is not a flick either.
  expect(await sheet.drag(DROP - 1, 600)).toBe(true);
  expect(sheet.onCancel).not.toHaveBeenCalled();
});

test('a flick closes it however short the throw, which is the same movement and faster', async () => {
  // The two are told apart by speed and by nothing else, so the speed has to be exercised: 30
  // points is not far enough to close by, but a finger that covered it in 30ms is not coming back.
  const sheet = await up();
  expect(await sheet.drag(30, 30)).toBe(true);
  expect(sheet.onCancel).toHaveBeenCalledTimes(1);
});

test('a drag over the body scrolls the body and does not close the sheet', async () => {
  // The whole of the difficulty: inside a sheet the body is a scroll, and a drag down over it is
  // «листать» whatever the finger meant. The scroll is a sibling of the grab zone, so it is never
  // even asked whether the gesture is ours.
  const sheet = await up();
  expect(await sheet.dragOverBody(DROP + 200)).toBe(false);
  expect(sheet.onCancel).not.toHaveBeenCalled();
});

test('a finger that only wandered is nobody’s gesture at all', async () => {
  // A sheet of its own, because the point is what a first gesture looks like: on a sheet still
  // counting the last one there is no such thing.
  const sheet = await up();
  expect(await sheet.drag(SIDEWAYS - 1)).toBe(false);
  expect(sheet.onCancel).not.toHaveBeenCalled();
});

test('a drag sideways across the handle is not a drag down, and closes nothing', async () => {
  const sheet = await up();
  const zone = sheet.grab();
  await act(async () => zone.props.onStartShouldSetResponder(touch({ x: 100, y: 20 })));
  await act(async () => zone.props.onResponderGrant(touch({ x: 100, y: 20 })));
  const taken = await act(async () =>
    zone.props.onMoveShouldSetResponderCapture(touch({ x: 400, y: 60, fromX: 100, fromY: 20 })),
  );
  expect(taken).toBe(false);
  expect(sheet.onCancel).not.toHaveBeenCalled();
});

test('a sheet with no heading is still catchable by its handle', async () => {
  // The grab zone is the handle and the head together, and a sheet is allowed to have neither a
  // heading nor a handle of its own height — 4 points is not something a thumb reliably finds.
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <Sheet visible onCancel={vi.fn()}>
          {'тело'}
        </Sheet>,
      ),
    );
  });
  const grab = tree.root.find(
    (one) => typeof one.props.onMoveShouldSetResponderCapture === 'function',
  );
  expect(grab).toBeTruthy();
  // The handle is inside it, which is what makes the zone worth having.
  expect(tree.root.findAllByProps({ testID: 'sheet-handle' })).toHaveLength(1);
});

test('a screen reader is answered by the same escape a finger is answered by', async () => {
  const sheet = await up();
  // The same `onCancel` the drag and the buttons go through, so there is one way out rather than
  // three that could drift apart.
  const wayOut = sheet.root.find((one) => typeof one.props.onAccessibilityEscape === 'function');
  await act(async () => void wayOut.props.onAccessibilityEscape());
  expect(sheet.onCancel).toHaveBeenCalledTimes(1);
});

test('the buttons of a sheet still close it, and nothing above took that away', async () => {
  // The gesture is an addition, never a replacement: every sheet that could be dragged shut is one
  // somebody must still be able to shut with a button (TASK-477, the fourth decision).
  const onCancel = vi.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <Sheet
          visible
          onCancel={onCancel}
          title="Сортировка"
          footer={<Button label="Отмена" onPress={onCancel} />}
        >
          <Text>тело</Text>
        </Sheet>,
      ),
    );
  });
  const cancel = tree.root.findAllByType(Button).find((one) => one.props.label === 'Отмена');
  expect(cancel).toBeDefined();
  await act(async () => void cancel?.props.onPress());
  expect(onCancel).toHaveBeenCalledTimes(1);
});
