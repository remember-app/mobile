import { expect, test, vi } from 'vitest';

const { screen } = vi.hoisted(() => ({ screen: { width: 390 } }));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
// A phone's width, changed by the test: the grid in the sheet is worked out of it.
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: screen.width, height: 844, scale: 3, fontScale: 1 }),
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});

import { developing, photo } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import TestRenderer, { act } from 'react-test-renderer';
import type { MediaItem } from '@/api';
import { Button, GRID_GAP, Tile } from '@/kit';
import { CoverSheet } from '@/screens/memory/cover';
import { ru } from '@/strings';
import { space } from '@/theme';

/**
 * The sheet a memory's cover is picked in (spec 10.8.3), drawn here off the tree a real render
 * leaves — the grid and the one pick — where the edit screen's own tests only hold that the sheet is
 * raised and answered. The slot that shows the cover is the kit's (`tests/kit/cover.test.tsx`).
 */

mountsTrees();

const draw = async (node: React.ReactElement) => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(node));
  });
  return tree;
};

const at = (day: number, hour = 12) => new Date(2026, 8, day, hour).toISOString();

const frames = (): MediaItem[] => [
  photo('old', 'me', at(11), { thumbnail_url: 'https://r2.example/old' }),
  photo('new', 'me', at(13), { thumbnail_url: 'https://r2.example/new' }),
  { ...developing('busy', 'me', at(14)), thumbnail_url: null },
  photo('mid', 'me', at(12), { thumbnail_url: 'https://r2.example/mid' }),
];

const sheet = (over: Partial<React.ComponentProps<typeof CoverSheet>> = {}) => (
  <CoverSheet
    visible
    onCancel={() => {}}
    media={frames()}
    chosen={null}
    onChoose={() => {}}
    {...over}
  />
);

test('the grid is the memory’s frames newest first, three across, with the pick on the ones that can be taken', async () => {
  const root = (await draw(sheet())).root;
  const tiles = root.findAllByType(Tile);
  // The one still developing was shot last, so it heads the grid — with no circle and nothing to press.
  expect(tiles.map((one) => one.props.uri)).toEqual([
    undefined,
    'https://r2.example/new',
    'https://r2.example/mid',
    'https://r2.example/old',
  ]);
  expect(tiles.map((one) => one.props.pick)).toEqual([undefined, 'off', 'off', 'off']);
  expect(tiles[0].props.onPress).toBeUndefined();
  expect(tiles[0].props.caption).toBe(ru.gallery.waiting.processing);
  expect(tiles[1].props.caption).toBeUndefined();
});

test('the cell is a third of what the sheet leaves of the phone’s width, and the sheet never grows past 420', async () => {
  const cell = async (width: number) => {
    screen.width = width;
    const root = (await draw(sheet())).root;
    return (root.findAllByType(Tile)[1].parent!.parent!.props.style as { width: number }).width;
  };
  expect(await cell(390)).toBeCloseTo((390 - space.s4 * 2 - GRID_GAP * 2) / 3);
  expect(await cell(320)).toBeCloseTo((320 - space.s4 * 2 - GRID_GAP * 2) / 3);
  // A tablet or a landscape phone: the sheet stops growing, and so does the cell.
  expect(await cell(900)).toBeCloseTo((420 - space.s4 * 2 - GRID_GAP * 2) / 3);
  screen.width = 390;
});

test('one frame is picked and no more: a tap moves the pick, and the button hands over the one it stands on', async () => {
  const chosen: string[] = [];
  const root = (await draw(sheet({ chosen: 'old', onChoose: (id) => chosen.push(id) }))).root;
  const pick = () => root.findAllByType(Tile).map((one) => one.props.pick);
  // It opens on what the screen holds.
  expect(pick()).toEqual([undefined, 'off', 'off', 'send']);
  await act(async () => root.findAllByType(Tile)[1].props.onPress());
  expect(pick()).toEqual([undefined, 'send', 'off', 'off']);
  await act(async () => root.findAllByType(Tile)[2].props.onPress());
  expect(pick()).toEqual([undefined, 'off', 'send', 'off']);
  const put = () => root.findAllByType(Button).find((one) => one.props.label === ru.edit.coverDo)!;
  expect(put().props.disabled).toBe(false);
  await act(async () => put().props.onPress());
  expect(chosen).toEqual(['mid']);
});

test('with nothing picked the button is off and presses nothing', async () => {
  const chosen: string[] = [];
  const root = (await draw(sheet({ chosen: null, onChoose: (id) => chosen.push(id) }))).root;
  const put = () => root.findAllByType(Button).find((one) => one.props.label === ru.edit.coverDo)!;
  expect(put().props.disabled).toBe(true);
  await act(async () => put().props.onPress());
  expect(chosen).toEqual([]);
});

test('each opening starts from what the screen holds — a pick abandoned by closing is not the one the next open shows', async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(sheet({ chosen: 'old' })));
  });
  const pick = () => tree.root.findAllByType(Tile).map((one) => one.props.pick);
  await act(async () => tree.root.findAllByType(Tile)[1].props.onPress());
  expect(pick()).toEqual([undefined, 'send', 'off', 'off']);
  await act(async () => tree.update(sheet({ chosen: 'old', visible: false })));
  await act(async () => tree.update(sheet({ chosen: 'old', visible: true })));
  expect(pick()).toEqual([undefined, 'off', 'off', 'send']);
  // And a cover changed on the screen underneath is what it opens on next.
  await act(async () => tree.update(sheet({ chosen: 'mid' })));
  expect(pick()).toEqual([undefined, 'off', 'send', 'off']);
});

test('a memory with frames none of which can be taken has a grid and nothing to choose', async () => {
  const root = (await draw(sheet({ media: [developing('a', 'me', at(13))] }))).root;
  expect(root.findAllByType(Tile).map((one) => one.props.pick)).toEqual([undefined]);
  expect(
    root.findAllByType(Button).find((one) => one.props.label === ru.edit.coverDo)!.props.disabled,
  ).toBe(true);
});
