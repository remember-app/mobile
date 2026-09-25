import { expect, test, vi } from 'vitest';

const { motion, rises } = vi.hoisted(() => ({
  motion: { tell: (_on: boolean) => {} },
  /** Every rise started and not yet ended, ended by the test. */
  rises: [] as (() => void)[],
}));

// Two things of the phone, turned by the test. «Reduce motion»: node has no media query to ask, and
// without one `react-native-web` answers «reduced» for good, which leaves no rise to watch. And the
// rise itself: under a test `react-native-web` ends every animation the moment it starts, so here it
// ends when the test says. This replaces the setup's stand-in for the module, so its `Modal` comes
// along (see `vitest.setup.ts`).
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
    AccessibilityInfo: {
      ...rn.AccessibilityInfo,
      isReduceMotionEnabled: () => Promise.resolve(false),
      addEventListener: (_event: string, listen: (on: boolean) => void) => {
        motion.tell = listen;
        return { remove: () => {} };
      },
    },
    Animated: {
      ...rn.Animated,
      timing: (value: { setValue: (to: number) => void }, config: { toValue: number }) => ({
        start: (ended?: (result: { finished: boolean }) => void) => {
          rises.push(() => {
            value.setValue(config.toValue);
            ended?.({ finished: true });
          });
        },
        stop: () => {},
      }),
    },
  };
});

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { KeyboardAvoidingView } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { Sheet } from '@/kit/sheet';
import { Text } from '@/kit/text';

/**
 * TASK-386 — the sheet gives way to the keyboard only once it has risen. Giving way is a layout
 * animation, and one that catches the sheet mid-rise plays it out of the rise's starting values and
 * leaves it there: «Новый лейбл», whose field takes the keyboard on opening, came up as the darkness
 * and the keyboard with no sheet between them (measured in the iOS simulator: the sheet's own view
 * stood at opacity 0 and 24 lower, long after the rise had reported 1).
 */

mountsTrees();

async function open() {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <Sheet visible onCancel={() => {}} title="Новый лейбл">
          <Text>Название</Text>
        </Sheet>,
      ),
    );
  });
  return () =>
    (tree as TestRenderer.ReactTestRenderer).root.findByType(KeyboardAvoidingView).props.enabled;
}

test('while the sheet rises the keyboard is not given way to, and once it has risen it is', async () => {
  motion.tell(false);
  const givesWay = await open();
  expect(rises).toHaveLength(1);
  expect(givesWay()).toBe(false);

  await act(async () => {
    for (const end of rises.splice(0)) end();
  });
  expect(givesWay()).toBe(true);
});

test('with reduced motion there is no rise to wait for', async () => {
  motion.tell(true);
  rises.length = 0;
  const givesWay = await open();
  expect(rises).toHaveLength(0);
  expect(givesWay()).toBe(true);
});
