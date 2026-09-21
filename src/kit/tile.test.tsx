import { Copy } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { allDifferent, story } from '@/kit/story';
import { FEED_GAP, FrameMark, GRID_GAP, PickCircle, Tile, type PickKind } from '@/kit/tile';
import { setTheme } from '@/theme';

/** Spec 7.8 and 7.4 — one frame of the grid, and the marks that can stand on it. */

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

test('a picked frame goes down under a scrim, and the queue’s frame is ringed over the picture', () => {
  // Spec 7.4 — a picked frame darkens so the circle on it stays the brightest thing in the square.
  const picked = story(<Tile state="ready" uri={A} pick="send" label="Фото" />);
  expect(picked).toContain('tile-scrim');
  expect(story(<Tile state="ready" uri={A} pick="off" label="Фото" />)).not.toContain('tile-scrim');

  // And only the send queue adds the frame — a border comes out of the tile's own box, which in
  // the grid would make a picked frame narrower than its neighbours (TASK-79), so it is a layer.
  expect(story(<Tile state="ready" uri={A} pick="send" ring label="Фото" />)).toContain('tile-ring');
  expect(picked).not.toContain('tile-ring');
});

test('the feed and the wizard are two grids, and a frame knows which one it is in', () => {
  // Spec 7.8 — edge to edge with nothing rounded off in the feed, inside the screen's 16 with a
  // hair more air and a 4 radius in the wizard and the queue.
  allDifferent({
    feed: <Tile state="ready" uri={A} lane="feed" label="Фото" />,
    pick: <Tile state="ready" uri={A} label="Фото" />,
  });
  expect(FEED_GAP).toBe(2);
  expect(GRID_GAP).toBe(3);
  // The timecode carries no plate in the feed and gets one back in the wizard.
  allDifferent({
    feedVideo: <Tile state="ready" uri={A} lane="feed" length="0:24" label="Видео" />,
    pickVideo: <Tile state="ready" uri={A} length="0:24" label="Видео" />,
  });
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
  // No circle on it at all: the reason stands where the circle would, and nothing is darkened.
  expect(dropped).not.toContain('tile-scrim');
});

test('the four pick circles are four circles, and only two of them are filled', () => {
  const kinds: Exclude<PickKind, 'auto'>[] = ['send', 'keep', 'off', 'hand'];
  allDifferent(Object.fromEntries(kinds.map((kind) => [kind, <PickCircle kind={kind} />])));
  expect(story(<PickCircle kind="off" />)).not.toContain('data-glyph');
  expect(story(<PickCircle kind="hand" />)).toContain('data-glyph');
});

test('the circle is drawn at the three sizes the layout gives it', () => {
  // Spec 7.4 — 24 in the feed, 22 in the wizard and the queue, 13 inside a day gap.
  allDifferent({
    feed: <PickCircle kind="off" size={24} />,
    pick: <PickCircle kind="off" size={22} />,
    seam: <PickCircle kind="off" size={13} />,
  });
  expect(story(<PickCircle kind="send" size={24} />)).toContain('width:24px');
  // The 13 stands on the screen's own ink rather than on a photograph, so it wears no white collar
  // and its tick is smaller: `faint` for the empty one, `accent` for the taken day.
  expect(story(<PickCircle kind="off" size={13} />)).toContain('rgba(110,107,125,1.00)');
  expect(story(<PickCircle kind="send" size={13} />)).toContain('width="8"');
});

test('the mark in the corner is a running time or a reason, never both', () => {
  const length = story(<FrameMark length="0:24" />);
  expect(length).toContain('0:24');
  const reason = story(<FrameMark icon={Copy} label="Размыто" />);
  expect(reason).toContain('Размыто');
  expect(length).not.toBe(reason);
  // Both lie on a photograph, so the glyph on them is white whichever theme the app is in.
  expect(length).toContain('stroke="#FFFFFF"');
  // In the feed the timecode owns no plate at all — a shadow on the letters carries it.
  expect(story(<FrameMark length="0:24" lane="feed" />)).not.toBe(length);
});
