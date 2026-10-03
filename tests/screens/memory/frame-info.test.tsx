import { type Asked, later, photo, refused, serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
// The labels sheet is raised over the panel and is its own surface; nothing here is about it. It is
// stood in for by a button that reports back, so that the two answers the panel reads on after it
// (something was filed, and it was then shut) can be given by hand.
const filed: { onFiled?: () => void; onClose?: () => void } = {};
vi.mock('@/screens/memory/label-sheets', () => ({
  LabelSheets: (props: { onFiled: () => void; onClose: () => void }) => {
    filed.onFiled = props.onFiled;
    filed.onClose = props.onClose;
    return null;
  },
}));

import TestRenderer, { act } from 'react-test-renderer';
import type { FrameInfo, Label } from '@/api';
import { Banner, Chip, IconButton, RowSummary, Spinner, Text } from '@/kit';
import { FrameInfoPanel } from '@/screens/memory/frame-info';
import { ru } from '@/strings';
import { setTheme, ThemePin } from '@/theme';

/**
 * `FrameInfo` (spec 8, TASK-478) — everything about a frame that the picture does not say, on a
 * screen standing *under* the picture rather than on a sheet over it. The panel reads the frame
 * itself, which the sheet used to be handed, so what is asked of it here is what it draws and what
 * it does to a label.
 *
 * The state of the viewer around it — the frame shrinking, the pill held in, the strip going away —
 * is `frame-viewer-flow.test.tsx`'s, which raises it the way a person does.
 */

mountsTrees();

beforeAll(async () => {
  await setTheme('dark');
});
afterEach(() => vi.unstubAllGlobals());

const told = (over: Partial<FrameInfo> = {}): FrameInfo => ({
  id: 'a',
  file_name: 'IMG_4471.HEIC',
  size_bytes: '4200000',
  // Local days, because the panel writes local ones: an instant spelled in UTC is the day before,
  // for anybody west of it, and the line «принёс 15 сентября» would read 14.
  captured_at: new Date(2026, 8, 13, 21, 47).toISOString(),
  created_at: new Date(2026, 8, 15, 9, 12).toISOString(),
  width: 4032,
  height: 3024,
  camera_model: 'iPhone 15 Pro',
  focal_length_mm: 24,
  aperture: 1.8,
  latitude: 55.518,
  longitude: 37.53,
  uploaded_by: { id: 'u', username: 'mark', name: 'Марк Ковалёв', media_count: 96 },
  montages: [{ id: 'f', duration_seconds: 60, start_seconds: 72 }],
  // A frame in no box at all: an empty array, which is how the api says it (TASK-479).
  labels: [],
  ...over,
});

const box = (over: Partial<Label> = {}): Label => ({
  id: 'best',
  title: 'Лучшее',
  color: 1,
  shared: true,
  mine: true,
  can_edit: true,
  can_add_media: true,
  media_count: 23,
  ...over,
});

const frame = photo('a', 'u', new Date(2026, 8, 13).toISOString());

/** The panel mounted against a stand-in api, which is where its one read comes from. */
async function drawn(answer: unknown) {
  const log = serve(() => answer);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} />),
    );
  });
  const root = tree.root;
  const press = (find: () => { props: { onPress?: () => void } }) =>
    act(async () => find().props.onPress?.());
  const chip = (label: string) => root.findAllByType(Chip).find((one) => one.props.label === label);
  return {
    root,
    log,
    press,
    facts: () => root.findAllByType(RowSummary).map((one) => [one.props.label, one.props.value]),
    chips: () => root.findAllByType(Chip),
    chip,
    /** The dashed one that opens `SheetLabels` — the only control the labels block adds. */
    into: () => root.findAllByType(IconButton).find((one) => one.props.label === ru.labels.putInto),
    /** Every line of words on the panel, as one string — for what stands and what does not. */
    said: () =>
      root
        .findAllByType(Text)
        .map((one) => one.props.children)
        .join(' \u00b7 '),
  };
}

test('the whole panel: who brought it, the file, the camera, the place, the movie', async () => {
  const screen = await drawn(told());
  expect(screen.facts()).toEqual([
    [ru.viewer.file, 'IMG_4471.HEIC · 4,2 МБ'],
    [ru.viewer.pixels, '4032 × 3024'],
    [ru.viewer.camera, 'iPhone 15 Pro · 24 мм · f/1.8'],
    [ru.viewer.place, ru.viewer.coords(55.518, 37.53)],
  ]);
  const said = screen.said();
  for (const line of ['Марк Ковалёв', 'принёс 15 сентября · всего 96 кадров', 'В роликах']) {
    expect(said, line).toContain(line);
  }
});

test('a frame the worker never read has none of its lines, and only the person is left', async () => {
  const screen = await drawn(
    told({
      file_name: undefined,
      // Not even a weight: nothing at all is known of this file, and «Файл» goes with it rather
      // than standing empty. What is left is the person, which the api knows whatever.
      size_bytes: '0',
      width: null,
      height: null,
      camera_model: null,
      focal_length_mm: null,
      aperture: null,
      latitude: null,
      longitude: null,
      montages: [],
      labels: [],
    }),
  );
  expect(screen.facts()).toEqual([]);
  expect(screen.said()).toContain('Марк Ковалёв');
  expect(screen.said()).not.toContain(ru.viewer.inFilms);
  // And not a dash anywhere: an empty line is not drawn at all (spec 8).
  expect(screen.said()).not.toContain('—');
});

test('a read that has not answered yet is a wait with no words under it', async () => {
  const answer = later<unknown>();
  serve(() => answer.promise);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} />),
    );
  });
  expect(tree.root.findAllByType(Spinner)).toHaveLength(1);
  expect(tree.root.findAllByType(Banner)).toHaveLength(0);
  expect(tree.root.findAllByType(RowSummary)).toHaveLength(0);
  await act(async () => answer.settle(told()));
  expect(tree.root.findAllByType(Spinner)).toHaveLength(0);
  expect(tree.root.findAllByType(RowSummary)).toHaveLength(4);
});

test('a read that fails is the api’s word in a banner, and nothing of the frame is drawn for it', async () => {
  const screen = await drawn(refused(500, 'boom'));
  expect(screen.root.findAllByType(Banner).map((one) => one.props.text)).toEqual(['boom']);
  expect(screen.root.findAllByType(Spinner)).toHaveLength(0);
  expect(screen.facts()).toEqual([]);
});

test('the labels are chips in the order the api sent them, and a shared one wears its colour and a private one a lock', async () => {
  const screen = await drawn(
    told({
      labels: [
        box({ id: 'best', title: 'Лучшее' }),
        box({ id: 'many', title: 'Бабушки', color: 2 }),
        // Private last, which is where the api puts it: shared first, by title within.
        box({ id: 'mine', title: 'Для себя', color: 6, shared: false }),
      ],
    }),
  );
  // Not sorted here: the api's order is the order the filter over the gallery reads too.
  expect(screen.chips().map((one) => one.props.label)).toEqual(['Лучшее', 'Бабушки', 'Для себя']);
  for (const shared of ['Лучшее', 'Бабушки']) {
    expect(screen.chip(shared)?.props.swatch, shared).toBeTypeOf('string');
    expect(screen.chip(shared)?.props.icon, shared).toBeUndefined();
  }
  expect(screen.chip('Для себя')?.props.icon).toBeDefined();
  // And the way into every box the frame is not in yet.
  expect(screen.into()).toBeDefined();
});

test('a frame in no box at all has no labels block, not an empty one', async () => {
  const screen = await drawn(told({ labels: [] }));
  expect(screen.chips()).toHaveLength(0);
  expect(screen.into()).toBeUndefined();
  // Everything else stands: the block is gone, not the panel.
  expect(screen.facts()).toHaveLength(4);
});

test('a box the server will not let this person file into has a chip with no press', async () => {
  const screen = await drawn(
    told({
      labels: [box({ title: 'Общее' }), box({ id: 'no', title: 'Чужие', can_add_media: false })],
    }),
  );
  expect(screen.chip('Общее')?.props.onPress).toBeTypeOf('function');
  // Not a press that refuses — no press at all: the app never repeats the api's own rule (doc-13).
  expect(screen.chip('Чужие')?.props.onPress).toBeUndefined();
  expect(screen.chip('Чужие')?.props.disabled).toBe(true);
});

test('a chip takes the frame back out of that box, and the chip is gone afterwards', async () => {
  const screen = await drawn(
    told({ labels: [box({ title: 'Лучшее' }), box({ id: 'two', title: 'Бабушки' })] }),
  );
  await screen.press(() => screen.chip('Лучшее')!);
  expect(screen.log.filter((one: Asked) => one.method === 'DELETE')).toHaveLength(1);
  // Only this frame, out of that box — the press is about the frame the panel is showing.
  expect(screen.log.at(-1)?.path).toBe('/memories/m1/labels/best/media');
  expect(screen.log.at(-1)?.body).toEqual({ media_ids: ['a'] });
  expect(screen.chips().map((one) => one.props.label)).toEqual(['Бабушки']);
});

test('a refusal from the server leaves the chip standing and says why', async () => {
  const log = serve((asked) =>
    asked.method === 'DELETE'
      ? refused(403, 'нельзя')
      : told({ labels: [box({ title: 'Лучшее' })] }),
  );
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} />),
    );
  });
  const root = tree.root;
  const chip = root.findAllByType(Chip).find((one) => one.props.label === 'Лучшее')!;
  await act(async () => chip.props.onPress?.());
  expect(log.at(-1)?.method).toBe('DELETE');
  // The api said no, so the chip is still a chip: an errand that did not happen changes nothing.
  expect(root.findAllByType(Chip).map((one) => one.props.label)).toEqual(['Лучшее']);
  expect(root.findAllByType(Banner).map((one) => one.props.text)).toEqual(['нельзя']);
});

test('the panel is drawn in the night in both app themes — it stands inside the room of the photograph', async () => {
  // The window pins itself dark for the picture (`frame-viewer.tsx`) and the panel stands inside
  // that room: it is the bottom of that window and not a surface of its own over it, so a theme is
  // not a colour it can answer to. Same words either way (spec 2).
  const drawn_in = async (pin: 'dark' | 'light') => {
    serve(() => told());
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = mounted(
        TestRenderer.create(
          <ThemePin value={pin}>
            <FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} />
          </ThemePin>,
        ),
      );
    });
    return tree.root.findAllByType(RowSummary).map((one) => [one.props.label, one.props.value]);
  };
  expect(await drawn_in('light')).toEqual(await drawn_in('dark'));
});

test('an answer to an earlier read never lands over a later one', async () => {
  // Two reads can be in the air at once: the labels sheet files something into the frame and is then
  // shut, and each of those says so and asks again. The first to land must not put the frame as it
  // was before the press under the finger that has already moved on.
  const first = later<unknown>();
  const second = later<unknown>();
  const queue: unknown[] = [told({ labels: [box()] }), first.promise, second.promise];
  serve(() => queue.shift());
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} />),
    );
  });
  const root = tree.root;
  const file = () => root.findAllByType(RowSummary).map((one) => one.props.value)[0];
  // The sheet is raised by the dashed one — which needs a frame in a box, since a frame in none has
  // no labels block and so no way in.
  const plus = root.findAllByType(IconButton).find((one) => one.props.label === ru.labels.putInto)!;
  await act(async () => plus.props.onPress?.());
  // The sheet's two answers in a row, each re-reading and each in the air at once with the other.
  await act(async () => filed.onClose?.());
  await act(async () => filed.onFiled?.());
  await act(async () => second.settle(told({ file_name: 'B.JPG', size_bytes: '1000000' })));
  expect(file()).toBe('B.JPG · 1 МБ');
  // The first read comes in late, with the frame before it, and is not let in.
  await act(async () => first.settle(told({ file_name: 'A.JPG', size_bytes: '2000000' })));
  expect(file()).toBe('B.JPG · 1 МБ');
});

test('a panel that is shut mid-read takes the answer with it, and the next one asks afresh', async () => {
  const first = later<unknown>();
  const second = later<unknown>();
  const queue = [first, second];
  serve(() => queue.shift()!.promise);
  let tree!: TestRenderer.ReactTestRenderer;
  const panel = <FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} />;
  await act(async () => {
    tree = mounted(TestRenderer.create(panel));
  });
  // Shut before it answers, and raised again on another frame.
  await act(async () =>
    tree.update(<FrameInfoPanel memoryId="m1" item={frame} onFilm={() => {}} />),
  );
  await act(async () => tree.update(null as never));
  await act(async () => tree.update(panel));
  await act(async () => second.settle(told({ file_name: 'B.JPG', size_bytes: '1000000' })));
  expect(tree.root.findAllByType(RowSummary).map((one) => one.props.value)[0]).toBe('B.JPG · 1 МБ');
  await act(async () => first.settle(told({ file_name: 'A.JPG' })));
  expect(tree.root.findAllByType(RowSummary).map((one) => one.props.value)[0]).toBe('B.JPG · 1 МБ');
});
