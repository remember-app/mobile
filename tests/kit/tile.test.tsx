import { rule } from '@tests/helpers/css';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
// What the picture is filed under is the whole of what this file's last test is about. The stand-in
// `vitest.setup.ts` puts in for `expo-image` carries `source` through for every test in the repo, so
// there is nothing to stand over here — a private mock of the module here is how that got missed
// once: a stub that dropped `source` made every claim about the key it holds green.
import { Image } from 'expo-image';
import { Copy } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Text as RNText, StyleSheet, type TextStyle, View, type ViewStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test } from 'vitest';
import { Icon } from '@/kit/icon';
import { allDifferent, story } from '@/kit/story';
import { FEED_GAP, FrameMark, GRID_GAP, PickCircle, type PickKind, Tile } from '@/kit/tile';
import { setTheme } from '@/theme';

/** Spec 7.8 and 7.4 — one frame of the grid, and the marks that can stand on it. */

const A = 'https://bucket.example/a.jpg?X-Amz-Signature=aaa';

mountsTrees();

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
      <Tile
        state="ready"
        uri={A}
        pick="auto"
        reason={{ icon: Copy, label: 'Дубль' }}
        label="Фото"
      />
    ),
    droppedByHand: <Tile state="ready" uri={A} pick="hand" label="Фото" />,
    taken: <Tile state="ready" uri={A} pick="keep" label="Фото" />,
    broken: <Tile state="failed" caption="Не загрузилось" label="Кадр" />,
  });
});

test('each state draws what it is: a picture, a spinner and its words, or a glyph and its words — and nothing else does', () => {
  const ready = story(<Tile state="ready" uri={A} caption="Проявляем…" label="Фото" />);
  const developing = story(<Tile state="processing" uri={A} caption="Проявляем…" label="Кадр" />);
  const broken = story(<Tile state="failed" uri={A} caption="Не загрузилось" label="Кадр" />);
  const bare = story(<Tile state="ready" caption="Проявляем…" label="Кадр" />);
  // The picture is there only for a ready frame that has one, whatever else it was handed.
  expect(ready).toContain('data-testid="image"');
  for (const other of [developing, broken, bare])
    expect(other).not.toContain('data-testid="image"');
  // The words are for the two frames that are not there yet, never for one that is.
  expect(ready).not.toContain('Проявляем…');
  expect(developing).toContain('Проявляем…');
  expect(broken).toContain('Не загрузилось');
  expect(broken).not.toContain('Проявляем…');
  // A fallen frame carries the frame glyph, and the other three have none of it.
  expect(broken).toContain('data-glyph');
  for (const other of [ready, developing, bare]) expect(other).not.toContain('data-glyph');
  // A developing frame turns; a fallen one is still.
  const spinner = 'width:16px;height:16px';
  expect(developing).toContain(spinner);
  expect(broken).not.toContain(spinner);
  // A ready frame that lost its picture is a bare square and says nothing — the feed never draws
  // one, because it reads that frame as a fallen one first.
  expect(bare).not.toContain(spinner);
  expect(bare).not.toContain('Проявляем…');
});

test('a running time stands on a ready frame only, and a circle only where a frame is in a picking mode', () => {
  expect(story(<Tile state="ready" uri={A} length="0:24" label="Видео" />)).toContain('0:24');
  for (const state of ['processing', 'failed'] as const) {
    expect(story(<Tile state={state} length="0:24" label="Видео" />)).not.toContain('0:24');
  }
  // With a reason the mark is the reason and the time goes.
  expect(
    story(
      <Tile
        state="ready"
        uri={A}
        length="0:24"
        reason={{ icon: Copy, label: 'Дубль' }}
        label="Видео"
      />,
    ),
  ).not.toContain('0:24');
  // No `pick` at all: not in a picking mode, so no circle — the same frame with «off» is the empty
  // circle in its corner, 22 in the wizard and 24 in the feed. A frame the pass dropped has its
  // reason where the circle would be, and no circle either.
  const none = story(<Tile state="ready" uri={A} label="Фото" />);
  expect(none).not.toContain('width:22px');
  expect(none).not.toContain('width:24px');
  expect(story(<Tile state="ready" uri={A} pick="off" label="Фото" />)).toContain('width:22px');
  expect(story(<Tile state="ready" uri={A} lane="feed" pick="off" label="Фото" />)).toContain(
    'width:24px',
  );
  const dropped = story(
    <Tile state="ready" uri={A} pick="auto" reason={{ icon: Copy, label: 'Дубль' }} label="Фото" />,
  );
  expect(dropped).not.toContain('width:22px');
});

test('a picked frame goes down under a scrim, and the queue’s frame is ringed over the picture', () => {
  // Spec 7.4 — a picked frame darkens so the circle on it stays the brightest thing in the square.
  const picked = story(<Tile state="ready" uri={A} pick="send" label="Фото" />);
  expect(picked).toContain('tile-scrim');
  expect(story(<Tile state="ready" uri={A} pick="off" label="Фото" />)).not.toContain('tile-scrim');

  // And only the send queue adds the frame — a border comes out of the tile's own box, which in
  // the grid would make a picked frame narrower than its neighbours (TASK-79), so it is a layer.
  expect(story(<Tile state="ready" uri={A} pick="send" ring label="Фото" />)).toContain(
    'tile-ring',
  );
  expect(picked).not.toContain('tile-ring');
});

/** The pick circle a frame draws in its corner, found by its size — none at all if it draws none. */
function circleOf(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(TestRenderer.create(element));
  });
  return tree.root
    .findAll((node) => node.props.style !== undefined && typeof node.props.style !== 'function')
    .map((node) => StyleSheet.flatten(node.props.style) as ViewStyle)
    .find((box) => box.width === 24 || box.width === 22);
}

test('in the 117 grid a frame not picked is a clean frame, and still a checkbox a tap picks', () => {
  // Spec detail 26 and 10.11: «не выбран — кружка нет вовсе» (`UploadLimited.json` e16, e17 and
  // `UploadQueue.json` e29–e31 carry none) — the app drew the empty 22 on every one of them. The
  // feed's and the wizard's empty circles stay.
  expect(circleOf(<Tile state="ready" uri={A} pick="off" ring label="Фото" />)).toBeUndefined();
  expect(
    story(<Tile state="ready" uri={A} pick="off" ring label="Фото" onPress={() => {}} />),
  ).toContain('role="checkbox"');
  expect(circleOf(<Tile state="ready" uri={A} pick="send" ring label="Фото" />)).toBeDefined();
  expect(circleOf(<Tile state="ready" uri={A} pick="off" label="Фото" />)).toBeDefined();
  expect(
    circleOf(<Tile state="ready" uri={A} lane="feed" pick="off" label="Фото" />),
  ).toBeDefined();
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
  expect(dropped).not.toBe(
    story(<Tile state="ready" uri={A} reason={{ icon: Copy, label: 'Дубль' }} label="Фото" />),
  );
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

test('the running time in the feed stands 7 from the right edge and 6 from the foot, behind a 4 × 5 triangle', () => {
  // `MemoryFrames` (design/screens/MemoryFrames.html, measured in MemoryFrames.json): the span is
  // `right: 7px; bottom: 6px`, the triangle a 9 box drawn `M8 5.2v13.6L19 12z` — 4.1 × 5.1 — and 3
  // from the words, which puts it 4.9 ahead of them.
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(TestRenderer.create(<FrameMark length="0:24" lane="feed" />));
  });
  const mark = StyleSheet.flatten(tree.root.findAllByType(View)[0].props.style) as ViewStyle;
  // React Native reads an edge before the pair before the whole, whatever order they were written
  // in — which is how `padding: 0` once left the plate's 7 and 3 standing under a bare time.
  const edge = (side: 'Right' | 'Bottom', pair: 'paddingHorizontal' | 'paddingVertical') =>
    Number(mark[`padding${side}`] ?? mark[pair] ?? mark.padding ?? 0);
  expect(Number(mark.right) + edge('Right', 'paddingHorizontal')).toBe(7);
  expect(Number(mark.bottom) + edge('Bottom', 'paddingVertical')).toBe(6);
  // Lucide's `play` spans 15 × 18 of its 24 and a 2.1 stroke round it: at 6 that is 4.3 × 5.0, and
  // its tip 0.7 short of the box, so a gap of 4 stands it 4.7 ahead of the words.
  const glyph = tree.root.findByType(Icon).props;
  expect(glyph.size).toBe(6);
  expect(mark.gap).toBe(4);
  // The wizard's mark keeps its plate and its own glyph.
  expect(story(<FrameMark length="0:24" />)).toContain('width="9"');
});

test('the running time in the single-frame feed stands 12 from the corners', () => {
  // `MemorySingle` (spec 10.14.2, `MemorySingle.html`): the tile is the whole width of the phone,
  // and the timecode moves in to 12 from the corners (and reads at 13) rather than the grid's 7/6.
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(TestRenderer.create(<FrameMark length="0:24" lane="feed" single />));
  });
  const mark = StyleSheet.flatten(tree.root.findAllByType(View)[0].props.style) as ViewStyle;
  expect(mark.right).toBe(12);
  expect(mark.bottom).toBe(12);
  const words = StyleSheet.flatten(tree.root.findAllByType(RNText)[0].props.style) as TextStyle;
  expect(words.fontSize).toBe(13);
});

/** The flattened styles of every view a tree draws. */
const viewsOf = (tree: ReactElement) => {
  let drawn!: TestRenderer.ReactTestRenderer;
  act(() => {
    drawn = mounted(TestRenderer.create(tree));
  });
  return drawn.root
    .findAllByType(View)
    .map((one) => StyleSheet.flatten(one.props.style) as ViewStyle)
    .filter(Boolean);
};

test('a picked frame darkens .30 in the feed and .28 under the ring of the 117 grid', () => {
  // Spec 2, 7.4 detail 26 and 10.11: «затемнение выбранного `.30` в ленте, `.28` под рамкой в сетке
  // 117» (`FramesPicking.json` e10: rgba(11,11,18,0.3)).
  const scrim = (tree: ReactElement) =>
    viewsOf(tree).find((style) => style.position === 'absolute' && style.backgroundColor)
      ?.backgroundColor;
  expect(scrim(<Tile state="ready" uri={A} lane="feed" pick="send" label="Фото" />)).toBe(
    'rgba(11,11,18,0.30)',
  );
  expect(scrim(<Tile state="ready" uri={A} pick="send" ring label="Фото" />)).toBe(
    'rgba(11,11,18,0.28)',
  );
});

test('the circle stands 7 off the corner of a feed frame and 6 off a frame of the 117 grid', () => {
  // Spec 7.4, detail 26 and 10.11: «кружок выбора: отступы 7 (лента) и 6 (сетка 117)» —
  // `FramesPicking.json` e8 at 7 from the top and the right of its tile, `MontageSelect.json` e14 at 6.
  const corner = (size: 24 | 22) =>
    viewsOf(<PickCircle kind="off" size={size} />).find((style) => style.position === 'absolute');
  expect(corner(24)).toMatchObject({ top: 7, right: 7 });
  expect(corner(22)).toMatchObject({ top: 6, right: 6 });
  // And the 13 of a day gap is ringed 1, not 1.5 (spec 7.4, 10.11).
  expect(viewsOf(<PickCircle kind="off" size={13} />)[0]).toMatchObject({ borderWidth: 1 });
});

test('the wizard’s time stands 6 off the lower left on a 20 plate; a reason is a 21 pill 5 in', () => {
  // Spec 7.4, detail 25 and 10.11 (`MontageSelect.json`): «1:08» e39 is 51.6 × 20 at 6 from the left
  // and the foot of its tile; «Размыто» e21 is 107.3 × 21, 5 in from either side and the foot,
  // rounded as a pill — not the whole width of the tile.
  const [plate] = viewsOf(<FrameMark length="1:08" />);
  expect(plate).toMatchObject({ left: 6, bottom: 6, paddingVertical: 3 });
  const [reason] = viewsOf(<FrameMark icon={Copy} label="Размыто" />);
  expect(reason).toMatchObject({ left: 5, right: 5, bottom: 5, borderRadius: 999 });
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(TestRenderer.create(<FrameMark length="1:08" />));
  });
  // 3 + 14 + 3: the plate is 20 at the system's own type.
  expect(StyleSheet.flatten(tree.root.findByType(RNText).props.style).lineHeight).toBe(14);
});

test('a frame that did not open says so in `muted`: it is read', () => {
  // Spec 7.8, detail 63 and 10.1 — the glyph is the quiet part, the line under it is words.
  const failed = story(<Tile state="failed" caption="Кадр не открылся" label="Кадр" />);
  expect(failed).toContain('Кадр не открылся');
  expect(failed).toContain(rule('color:rgba(164,161,178,1.00)'));
});

test('what stands on a frame’s dark plates is drawn the same in daylight as at night', async () => {
  // The plate under a reason and the circle of a frame taken out by hand are dark in both themes
  // (spec 2), so the words and the cross on them are the night's. The day's `muted` is a mid grey
  // that falls to 3.6 : 1 on those plates, under what a 10px word needs.
  const marks = () => [
    story(<FrameMark icon={Copy} label="Дубль" lane="pick" />),
    story(<PickCircle kind="hand" size={22} />),
  ];
  const night = marks();
  await setTheme('light');
  expect(marks()).toEqual(night);
  await setTheme('dark');
});

test('one’s own frame says by itself what became of it: on its way with how much has gone, stuck, or hidden', () => {
  // Spec detail 63, `MyFrames`: three darkenings (.62, .50, .68) and one sign to a tile — the ring
  // turning and the percent, «!» on `dangerFill` with the red edge inside, the struck-out eye.
  allDifferent({
    plain: <Tile state="ready" uri={A} lane="feed" label="Фото" />,
    flying: <Tile state="ready" uri={A} lane="feed" own="flying" percent="62%" label="Фото" />,
    stuck: <Tile state="ready" uri={A} lane="feed" own="stuck" label="Фото" />,
    hidden: <Tile state="ready" uri={A} lane="feed" own="hidden" label="Фото" />,
  });
  const layer = (own: 'flying' | 'stuck' | 'hidden') => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = mounted(
        TestRenderer.create(
          <Tile
            state="ready"
            uri={A}
            lane="feed"
            own={own}
            percent="62%"
            length="0:24"
            label="Видео"
          />,
        ),
      );
    });
    return tree;
  };
  const scrim = (own: 'flying' | 'stuck' | 'hidden') =>
    StyleSheet.flatten(layer(own).root.findByProps({ testID: 'tile-own' }).props.style);
  expect(
    [scrim('flying'), scrim('stuck'), scrim('hidden')].map((one) => one.backgroundColor),
  ).toEqual(['rgba(11,11,18,0.62)', 'rgba(11,11,18,0.50)', 'rgba(11,11,18,0.68)']);
  expect(scrim('stuck')).toMatchObject({ borderWidth: 2 });
  // The percent only on the one on its way, and the length of a video stays over any of them.
  const words = (own: 'flying' | 'stuck' | 'hidden') =>
    layer(own)
      .root.findAllByType(RNText)
      .map((one) => one.props.children);
  expect(words('flying')).toEqual(['62%', '0:24']);
  expect(words('stuck')).toEqual(['!', '0:24']);
  expect(words('hidden')).toEqual(['0:24']);
});

/** The source the tile handed `expo-image`, which is where the cache key has to arrive. */
const sourceOf = (tree: ReactElement) => {
  let drawn!: TestRenderer.ReactTestRenderer;
  act(() => {
    drawn = mounted(TestRenderer.create(tree));
  });
  // A tile drawing no picture at all is a real answer here, not a failure to find one — hence `?`
  // rather than `findByType`, which throws on the frame that is still being made.
  return drawn.root.findAllByType(Image)[0]?.props.source;
};

test('a tile is filed under the record it came from, not under the link it was handed', () => {
  // The api signs a fresh url for the same bytes on every read of the gallery, each good for a
  // quarter of an hour, and `expo-image`'s own default key is that url. A tile keyed by it therefore
  // downloaded the whole visible sheet again on every quiet three-second re-read. The record's id is
  // what does not move, so it is what the key is made of.
  const signed = 'https://bucket.example/a.jpg?X-Amz-Signature=bbb';
  expect(sourceOf(<Tile state="ready" uri={signed} cacheKey="a:thumb" label="Фото" />)).toEqual({
    uri: signed,
    cacheKey: 'a:thumb',
  });

  // The same record one read later, under a different signature and the same key — which is the
  // whole of what is being bought: the bytes are already on the phone and the second look is free.
  const resigned = 'https://bucket.example/a.jpg?X-Amz-Signature=ccc';
  expect(sourceOf(<Tile state="ready" uri={resigned} cacheKey="a:thumb" label="Фото" />)).toEqual({
    uri: resigned,
    cacheKey: 'a:thumb',
  });

  // A frame the worker is still making has no picture and so nothing to file; the tile draws none,
  // and there is nothing here for a key to name.
  expect(
    sourceOf(<Tile state="processing" caption="Проявляем…" cacheKey="a:thumb" label="Кадр" />),
  ).toBeUndefined();
});

test('a tile handed no key caches by its link — and that is what every record must avoid', () => {
  // Pinned so the way out is deliberate rather than silent: it is right for a frame picked out of
  // the phone's own gallery, which `expo-image` reaches through `ph://` and which has no record to
  // be filed under. It is wrong for a record off the server, and every screen drawing one passes it.
  expect(sourceOf(<Tile state="ready" uri={A} label="Фото" />)).toEqual({ uri: A });
});
