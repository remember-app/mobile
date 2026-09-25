import { mountsTrees } from '@tests/helpers/renderer';

import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test, vi } from 'vitest';
import { grabLength, LengthSlider } from '@/kit/slider';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.3, detail 19 — how long the film should be. */

// The harness draws and never presses, so the two round buttons are the kit's own with what they
// would do on a press noted on the way through, by the word they are read out as.
const { presses } = vi.hoisted(() => ({ presses: new Map<string, () => void>() }));

vi.mock('@/kit/button', async (importOriginal) => {
  const { createElement } = await import('react');
  const kit = await importOriginal<typeof import('@/kit/button')>();
  return {
    ...kit,
    IconButton: (props: Parameters<typeof kit.IconButton>[0]) => {
      if (props.onPress) presses.set(props.label, props.onPress);
      return createElement(kit.IconButton, props);
    },
  };
});

beforeAll(async () => {
  await setTheme('dark');
});
mountsTrees();

const PRESETS = [
  { label: '0:30', value: 30 },
  { label: '1:00', value: 60 },
  { label: '1:30', value: 90 },
  { label: '3:00', value: 180 },
  { label: 'Всё', value: 550 },
];

function slider(props: Partial<Parameters<typeof LengthSlider>[0]> = {}) {
  return (
    <LengthSlider
      value={152}
      onChange={() => {}}
      min={10}
      max={550}
      valueLabel="2:32"
      note="из шаблона «Для родителей»"
      minLabel="0:10"
      maxLabel="9:10 · всё, что есть"
      label="Длина"
      shorterLabel="Короче на 5 секунд"
      longerLabel="Длиннее на 5 секунд"
      presets={PRESETS}
      {...props}
    />
  );
}

test('the card carries the figure, the two buttons, the line and the five ready answers', () => {
  const card = story(slider());
  expect(card).toContain('2:32');
  expect(card).toContain('из шаблона «Для родителей»');
  expect(card).toContain('0:10');
  expect(card).toContain('9:10 · всё, что есть');
  expect(card).toContain('aria-label="Короче на 5 секунд"');
  for (const preset of PRESETS) expect(card).toContain(`>${preset.label}<`);
});

test('the line is something a screen reader can take hold of, not a picture of a number', () => {
  const card = story(slider());
  // «adjustable» on a phone, which the web this harness renders through calls `slider`.
  expect(card).toContain('role="slider"');
  expect(card).toContain('aria-label="Длина"');
  expect(card).toContain('aria-valuemin="10"');
  expect(card).toContain('aria-valuemax="550"');
  expect(card).toContain('aria-valuenow="152"');
  // And it is read out as the figure on the card, not as a count of seconds.
  expect(card).toContain('aria-valuetext="2:32"');
});

/** 540 seconds on a line 540 wide: a second to a point, so every figure below reads off the finger. */
const LINE = { min: 10, max: 550 };
const WIDE = 540;

test('a finger landing on the handle leaves a template’s figure as it is until it moves', () => {
  // The template's 2:32 stands at 142, and the finger lands a few points off the handle's centre.
  const drag = grabLength(146, WIDE, { ...LINE, value: 152 });
  expect(drag(146)).toBeNull();
  // Once it moves, the figure follows it by the second — onto any of them, odd or not.
  expect(drag(147)).toBe(153);
  expect(drag(147)).toBeNull();
  expect(drag(141)).toBe(147);
});

test('a tap anywhere else on the line puts the figure under the finger, to the second', () => {
  const tap = grabLength(401, WIDE, { ...LINE, value: 152 });
  expect(tap(401)).toBe(411);
  expect(tap(401)).toBeNull();
});

test('dragged past either end of the line, the figure stops at the wall', () => {
  const drag = grabLength(150, WIDE, { ...LINE, value: 152 });
  expect(drag(-80)).toBe(10);
  // Taken off its centre, the handle still reaches the wall once the finger runs past the end.
  expect(drag(WIDE + 20)).toBe(550);
});

test('the buttons move it five seconds from wherever it stands, and stop at the walls', () => {
  const said: number[] = [];
  const press = (value: number, button: string) => {
    story(slider({ value, onChange: (seconds) => said.push(seconds) }));
    presses.get(button)?.();
  };
  // An odd figure stays odd: five either way, not onto the nearest multiple of five.
  press(157, 'Короче на 5 секунд');
  press(157, 'Длиннее на 5 секунд');
  // Closer to a wall than five, a press lands on the wall rather than past it.
  press(548, 'Длиннее на 5 секунд');
  press(12, 'Короче на 5 секунд');
  expect(said).toEqual([152, 162, 550, 10]);
});

test('at the walls the buttons stop offering what there is no material for', () => {
  const full = story(slider({ value: 550, valueLabel: '9:10' }));
  const empty = story(slider({ value: 10, valueLabel: '0:10' }));
  expect(full).toContain('aria-disabled="true"');
  expect(empty).toContain('aria-disabled="true"');
  expect(story(slider())).not.toContain('aria-disabled="true"');
});

test('a preset the value stands on is the chosen one, and the others are not', () => {
  allDifferent({
    between: slider({ value: 152 }),
    onPreset: slider({ value: 60, valueLabel: '1:00' }),
  });
  // Chosen: filled with `paper` and read in `ink`, the same pair every chosen pill in the kit wears.
  expect(story(slider({ value: 60, valueLabel: '1:00' }))).toContain('rgba(11,11,18,1.00)');
});

test('a ready answer there is no material for stands there and does not press', () => {
  // Spec 7.3, «материала на 40 с»: over the ceiling the pill goes quiet and takes no finger.
  // Clamping it instead would make «3:00» quietly mean «0:40» — three pills, one length, two lies.
  // «Всё» is the ceiling itself and never goes dark; the numbers above it do, and stay readable.
  const little = story(
    slider({
      value: 40,
      max: 40,
      valueLabel: '0:40',
      presets: [...PRESETS.slice(0, 4), { label: 'Всё', value: 40 }],
    }),
  );
  expect(little).toContain('>3:00<');
  expect(little).toContain('aria-disabled="true"');
  // The same five answers under a ceiling that reaches them are not the same row of pills.
  allDifferent({
    reachable: slider({ value: 40, valueLabel: '0:40' }),
    beyond: slider({
      value: 40,
      max: 40,
      valueLabel: '0:40',
      presets: [...PRESETS.slice(0, 4), { label: 'Всё', value: 40 }],
    }),
  });
});

test('a card without ready answers is the same card, minus the row of them', () => {
  const bare = story(slider({ presets: undefined }));
  expect(bare).not.toContain('>0:30<');
  expect(bare).toContain('2:32');
});

test('on a line narrower than the range every position is still a whole second inside the walls', () => {
  // 540 seconds on 200 points: 2.7 seconds to a point, so any figure a finger works out is rounded.
  const drag = grabLength(0, 200, { ...LINE, value: 10 });
  const figures = Array.from({ length: 201 }, (_, x) => drag(x)).filter(
    (seconds) => seconds !== null,
  );
  expect(figures.length).toBeGreaterThan(50);
  for (const seconds of figures) {
    expect(Number.isInteger(seconds)).toBe(true);
    expect(seconds).toBeGreaterThanOrEqual(10);
    expect(seconds).toBeLessThanOrEqual(550);
  }
  // And before the line has been measured there is nothing to divide by, and no figure of NaN.
  const unmeasured = grabLength(30, 0, { ...LINE, value: 152 });
  expect(unmeasured(80)).toSatisfy(
    (seconds: number | null) => seconds === null || Number.isInteger(seconds),
  );
});

test('a material with exactly one length in it has no way to move the figure', () => {
  // Three photos are seven seconds: the api's band is 7…7, and the figure is stuck to both walls.
  const drag = grabLength(90, WIDE, { min: 7, max: 7, value: 7 });
  expect(drag(0)).toBeNull();
  expect(drag(WIDE)).toBeNull();
  const card = story(slider({ min: 7, max: 7, value: 7, valueLabel: '0:07', presets: undefined }));
  expect(card.match(/aria-disabled="true"/g)).toHaveLength(2);
});

test('a screen reader and the ready answers move the figure the way the buttons and the finger do', () => {
  const said: number[] = [];
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(slider({ value: 157, onChange: (seconds) => said.push(seconds) }));
  });
  const line = tree.root.findAll(
    (node) => typeof node.props.onAccessibilityAction === 'function',
  )[0]!;
  const action = (actionName: string) =>
    line.props.onAccessibilityAction({ nativeEvent: { actionName } });
  action('increment');
  action('decrement');
  const answer = (label: string) =>
    tree.root.findAll(
      (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
    )[0]!;
  act(() => answer('1:00').props.onPress());
  // «Всё» is the ceiling itself, whatever the material is.
  act(() => answer('Всё').props.onPress());
  expect(said).toEqual([162, 152, 60, 550]);
});

test('a ready length keeps its figures inside its own pill, however narrow the row comes out', () => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(slider());
  });
  const words = () =>
    tree.root.findAll(
      (node) => node.props.children === '0:30' && node.props.maxFontSizeMultiplier !== undefined,
    );
  // Unmeasured, nothing is held back.
  expect(words()).toHaveLength(0);
  // The zoomed iPhone SE (TASK-372): the card leaves 256 for five pills and four gaps of 6.
  const row = tree.root.findAll(
    (node) =>
      typeof node.props.onLayout === 'function' &&
      node.findAll((one) => one.props.accessibilityLabel === '0:30').length > 0,
  )[0]!;
  act(() =>
    row.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 256, height: 32 } } }),
  );
  const most = words()[0]?.props.maxFontSizeMultiplier ?? Number.POSITIVE_INFINITY;
  // «0:30» — the widest of them, 2.35 em at 13 — with 4 to spare, in a fifth of what is left.
  expect(13 * most * 2.35).toBeLessThanOrEqual((256 - 4 * 6) / 5 - 4 + 1e-9);
  act(() => tree.unmount());
});
