import { expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { touch } from '@tests/helpers/gesture';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import TestRenderer, { act } from 'react-test-renderer';
import { VideoTrack } from '@/kit/bits';
import { LengthSlider } from '@/kit/slider';

/**
 * The two bars a finger drags, driven through the handlers a real render hangs on them. `bits.test.tsx`
 * and `slider.test.tsx` have what each draws and the arithmetic of the slider's grab; what a story
 * cannot say is what the film or the length does when the bar is pressed, dragged and stepped: it goes
 * to the point the finger is at, held inside the bar at either end, and by a fixed step for whoever
 * has no finger to drag it with.
 */

mountsTrees();

async function scrubber(value: number, seek?: (to: number) => void) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <VideoTrack at="0:24" of="1:08" value={value} label="Просмотрено" onSeek={seek} />,
      ),
    );
  });
  const pad = () => tree.root.findByProps({ accessibilityLabel: 'Просмотрено' });
  return {
    pad,
    /** The bar measured, the way the row lays it out. */
    lay: (width: number) =>
      act(async () => pad().props.onLayout({ nativeEvent: { layout: { width } } })),
    finger: (name: 'onResponderGrant' | 'onResponderMove' | 'onResponderRelease', x: number) =>
      act(async () => pad().props[name](touch({ x }))),
    step: (name: 'increment' | 'decrement') =>
      act(async () => pad().props.onAccessibilityAction({ nativeEvent: { actionName: name } })),
    now: () => pad().props.accessibilityValue.now as number,
  };
}

test('a press anywhere on the line seeks to that point, and a drag carries on from it', async () => {
  const seeks: number[] = [];
  const bar = await scrubber(0.1, (to) => seeks.push(to));
  await bar.lay(200);
  await bar.finger('onResponderGrant', 100);
  await bar.finger('onResponderMove', 150);
  await bar.finger('onResponderRelease', 50);
  expect(seeks).toEqual([0.5, 0.75, 0.25]);
});

test('a finger past either end is held at that end, and before the line has been measured it is the start', async () => {
  const seeks: number[] = [];
  const bar = await scrubber(0.1, (to) => seeks.push(to));
  // Not measured yet: nowhere to say the finger is, so the start.
  await bar.finger('onResponderGrant', 90);
  await bar.lay(200);
  await bar.finger('onResponderMove', -30);
  await bar.finger('onResponderMove', 260);
  expect(seeks).toEqual([0, 0, 1]);
});

test('what is drawn while the finger is down is the finger’s own place, and the film’s again once it lifts', async () => {
  const bar = await scrubber(0.1, () => {});
  await bar.lay(200);
  expect(bar.now()).toBe(10);
  await bar.finger('onResponderGrant', 150);
  // The film answers four times a second at best; the handle does not wait for it.
  expect(bar.now()).toBe(75);
  await bar.finger('onResponderRelease', 150);
  expect(bar.now()).toBe(10);
});

test('to a screen reader the bar is a control that steps five percent either way and stops at the ends', async () => {
  const seeks: number[] = [];
  const at = async (value: number) => scrubber(value, (to) => seeks.push(to));
  // What a screen reader is told it may do to the bar, and how far along it is — on a scale from nought.
  const bar = await at(0.35);
  expect(bar.pad().props.accessibilityActions).toEqual([
    { name: 'increment' },
    { name: 'decrement' },
  ]);
  expect(bar.pad().props.accessibilityValue).toEqual({ min: 0, max: 100, now: 35 });
  await (await at(0.5)).step('increment');
  await (await at(0.5)).step('decrement');
  await (await at(0.98)).step('increment');
  await (await at(0.02)).step('decrement');
  expect(seeks[0]).toBeCloseTo(0.55);
  expect(seeks[1]).toBeCloseTo(0.45);
  expect(seeks.slice(2)).toEqual([1, 0]);
});

test('a bar with nowhere to send the finger takes none: it reports the point and offers no step', async () => {
  const bar = await scrubber(0.35);
  expect(bar.pad().props.accessibilityRole).toBe('progressbar');
  expect(bar.pad().props.accessibilityActions).toBeUndefined();
  expect(bar.pad().props.onAccessibilityAction).toBeUndefined();
  expect(bar.pad().props.onResponderGrant).toBeUndefined();
  expect(bar.now()).toBe(35);
});

/** 540 seconds on a line 540 wide — a second to a point — with the figure at 2:32, a template’s. */
async function length(over: Partial<React.ComponentProps<typeof LengthSlider>> = {}) {
  const said: number[] = [];
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <LengthSlider
          value={152}
          onChange={(seconds) => said.push(seconds)}
          min={10}
          max={550}
          valueLabel="2:32"
          minLabel="0:10"
          maxLabel="9:10"
          label="Длина"
          shorterLabel="Короче"
          longerLabel="Длиннее"
          {...over}
        />,
      ),
    );
  });
  const pad = () => tree.root.findByProps({ accessibilityRole: 'adjustable' });
  await act(async () => pad().props.onLayout({ nativeEvent: { layout: { width: 540 } } }));
  return {
    said,
    pad,
    /** Where the handle is drawn along the line, in percent. */
    handle: () => {
      const style = tree.root
        .findAll(
          (one) =>
            typeof one.props.style === 'object' &&
            JSON.stringify(one.props.style).includes('"left":"'),
        )
        .map((one) => JSON.stringify(one.props.style))
        .at(-1)!;
      return Number(/"left":"([\d.]+)%"/.exec(style)![1]);
    },
    finger: (name: 'onResponderGrant' | 'onResponderMove' | 'onResponderRelease', x: number) =>
      act(async () => pad().props[name](touch({ x }))),
  };
}

test('the length follows the finger by the second: a press elsewhere on the line puts the figure under it, a drag carries on', async () => {
  const bar = await length();
  await bar.finger('onResponderGrant', 401);
  await bar.finger('onResponderMove', 405);
  await bar.finger('onResponderMove', 405);
  await bar.finger('onResponderRelease', 300);
  // A finger that has not moved the figure has nothing to say, so the repeat of 405 is not sent twice.
  expect(bar.said).toEqual([411, 415, 310]);
});

test('a finger that lands on the handle leaves the figure where it stands until it moves', async () => {
  const bar = await length();
  await bar.finger('onResponderGrant', 146);
  expect(bar.said).toEqual([]);
  await bar.finger('onResponderMove', 147);
  expect(bar.said).toEqual([153]);
});

test('the figure stops at the walls however far the finger goes', async () => {
  const bar = await length();
  await bar.finger('onResponderGrant', 300);
  await bar.finger('onResponderMove', -90);
  await bar.finger('onResponderMove', 700);
  expect(bar.said.at(-2)).toBe(10);
  expect(bar.said.at(-1)).toBe(550);
});

test('the handle follows the finger while it is down, and stands on the figure again once it lifts', async () => {
  const bar = await length();
  // The figure is 152 on a line from 10 to 550: a little over a quarter of the way.
  expect(bar.handle()).toBeCloseTo(((152 - 10) / 540) * 100);
  await bar.finger('onResponderGrant', 401);
  // 411 seconds is where the finger is, and the handle is under it whatever the screen still holds.
  expect(bar.handle()).toBeCloseTo(((411 - 10) / 540) * 100);
  await bar.finger('onResponderMove', 270);
  expect(bar.handle()).toBeCloseTo(((280 - 10) / 540) * 100);
  await bar.finger('onResponderRelease', 270);
  expect(bar.handle()).toBeCloseTo(((152 - 10) / 540) * 100);
});
