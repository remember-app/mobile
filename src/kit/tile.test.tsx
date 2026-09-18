import { Copy } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { allDifferent, story } from '@/kit/story';
import { FrameMark, GRID_GAP, PickCircle, Tile, type PickKind } from '@/kit/tile';
import { setTheme } from '@/theme';

/** Spec 7.7 and 7.4 — one frame of the grid, and the marks that can stand on it. */

const A = 'https://bucket.example/a.jpg?X-Amz-Signature=aaa';

beforeAll(async () => {
  await setTheme('dark');
});

test('the eight states of a frame are eight different frames', () => {
  allDifferent({
    ready: <Tile state="ready" uri={A} label="Фото" />,
    video: <Tile state="ready" uri={A} length="0:24" label="Видео" />,
    developing: <Tile state="processing" caption="Проявляем…" label="Кадр" />,
    picked: <Tile state="ready" uri={A} pick="send" label="Фото" />,
    droppedByPass: (
      <Tile state="ready" uri={A} pick="auto" reason={{ icon: Copy, label: 'Дубль' }} label="Фото" />
    ),
    droppedByHand: <Tile state="ready" uri={A} pick="hand" label="Фото" />,
    taken: <Tile state="ready" uri={A} pick="keep" label="Фото" />,
    broken: <Tile state="failed" caption="Не загрузилось" label="Кадр" />,
  });
});

test('a picked frame is ringed over the picture, never bordered out of it', () => {
  // A border comes out of the tile's own box, which in the grid would make a picked frame narrower
  // than its neighbours — the bug TASK-79 was about. The ring is a layer.
  const picked = story(<Tile state="ready" uri={A} pick="send" label="Фото" />);
  expect(picked).toContain('tile-ring');
  expect(story(<Tile state="ready" uri={A} pick="off" label="Фото" />)).not.toContain('tile-ring');
});

test('the colour of the pick says which way the frame is going', () => {
  // Spec 1.7: `accent` — this one is leaving for the server; `spark` — this one is already ours.
  const send = story(<Tile state="ready" uri={A} pick="send" label="Фото" />);
  const keep = story(<Tile state="ready" uri={A} pick="keep" label="Фото" />);
  expect(send).toContain('rgba(75,91,255,1.00)');
  expect(keep).toContain('rgba(228,255,79,1.00)');
});

test('a frame carrying a pick is a checkbox, and one that does not is a button', () => {
  // `checked` is spoken only when it is true, so on a screen whose whole job is picking, a frame
  // with no `pick` at all would announce neither that it toggles nor that it is off.
  expect(story(<Tile state="ready" uri={A} label="Фото" onPress={() => {}} />)).toContain(
    'role="button"',
  );
  expect(
    story(<Tile state="ready" uri={A} pick="off" label="Фото" onPress={() => {}} />),
  ).toContain('role="checkbox"');
  // A frame still developing is not a button at all.
  expect(story(<Tile state="processing" caption="Проявляем…" label="Кадр" />)).toContain(
    'role="img"',
  );
});

test('a frame the pass dropped stays visible and says why', () => {
  const dropped = story(
    <Tile state="ready" uri={A} pick="auto" reason={{ icon: Copy, label: 'Дубль' }} label="Фото" />,
  );
  expect(dropped).toContain('Дубль');
  // Down to 32% — out of the montage, and still there to be put back with one tap. The picture
  // itself is dimmed and nothing else is, which is what keeps the reason readable over it.
  expect(dropped).not.toBe(story(<Tile state="ready" uri={A} reason={{ icon: Copy, label: 'Дубль' }} label="Фото" />));
  // No circle on it: the reason stands where the circle would.
  expect(dropped).not.toContain('tile-ring');
});

test('the five pick circles are five circles, and only two of them are filled', () => {
  const kinds: Exclude<PickKind, 'auto'>[] = ['send', 'keep', 'off', 'hand'];
  allDifferent(Object.fromEntries(kinds.map((kind) => [kind, <PickCircle kind={kind} />])));
  expect(story(<PickCircle kind="off" />)).not.toContain('data-glyph');
  expect(story(<PickCircle kind="hand" />)).toContain('data-glyph');
});

test('the mark in the corner is a running time or a reason, never both', () => {
  const length = story(<FrameMark length="0:24" />);
  expect(length).toContain('0:24');
  const reason = story(<FrameMark icon={Copy} label="Размыто" />);
  expect(reason).toContain('Размыто');
  expect(length).not.toBe(reason);
  // Both lie on a photograph, so the glyph on them is white whichever theme the app is in.
  expect(length).toContain('stroke="#FFFFFF"');
});

test('the gutter of the grid is one number, and both screens that draw a grid read it', () => {
  // A gutter of two minds would tell the two screens two different column widths.
  expect(GRID_GAP).toBe(3);
});
