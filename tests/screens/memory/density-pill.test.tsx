import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { expect, test, vi } from 'vitest';

/**
 * The pill of the feed's density (spec 10.14.1, TASK-545) has one thing of its own the screen tests
 * cannot see: it is not remounted between two pinches, because the glass bar shows it while either
 * of the two flags is up. A finger that comes down again during the 200ms fade therefore has to put
 * the pill back to full strength; without that it stays as faint as the interrupted fade left it.
 */

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
// `Animated.timing` in node is a frame loop that may not run inside one `act`: what is under test is
// the value the pill holds, so the timer is made to write its target and finish at once.
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    Animated: {
      ...rn.Animated,
      timing: (value: { setValue: (to: number) => void }, config: { toValue: number }) => ({
        start: (ended?: (result: { finished: boolean }) => void) => {
          value.setValue(config.toValue);
          ended?.({ finished: true });
        },
        stop: () => {},
      }),
    },
  };
});

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { DensityPill } from '@/screens/memory/frames-density';

mountsTrees();

/** What the pill is drawn at, off the one animated value it carries. */
const opacityOf = (tree: TestRenderer.ReactTestRenderer) => {
  const pill = tree.root.findAll((one) => one.props.accessibilityLiveRegion === 'polite')[0];
  const style = StyleSheet.flatten(pill.props.style) as {
    opacity: { __getValue(): number };
  };
  return style.opacity.__getValue();
};

test('a second pinch during the fade brings the pill back to full strength', async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<DensityPill value={3} leaving={false} />));
  });
  expect(opacityOf(tree)).toBe(1);

  await act(async () => {
    tree.update(<DensityPill value={3} leaving />);
  });
  expect(opacityOf(tree)).toBe(0);

  // Fingers down again before the bar has put the pill away: the same instance, brought back.
  await act(async () => {
    tree.update(<DensityPill value={3} leaving={false} />);
  });
  expect(opacityOf(tree)).toBe(1);
});
