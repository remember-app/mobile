import { expect, test, vi } from 'vitest';

const { phone, motion, runs } = vi.hoisted(() => ({
  /** The phone's own screen, standing: 390 × 844 is the board every number below is measured on. */
  phone: { width: 390, height: 844, scale: 3, fontScale: 1 },
  motion: { tell: (_on: boolean) => {} },
  /**
   * Every animation the window started, ended by the test rather than by `react-native-web` (which
   * ends one the moment it starts). Held with the value it drives, so that a test can stop it
   * half-way and look at what the window has drawn there.
   */
  runs: [] as {
    to: number;
    ms: number;
    value: { setValue: (to: number) => void };
    end: () => void;
  }[],
}));

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session', user: { id: 'me' } }) }));
vi.mock('expo-router', () => ({
  useFocusEffect: () => {},
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), setParams: vi.fn() }),
}));
vi.mock('expo', () => ({ useEvent: () => undefined }));
vi.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));
vi.mock('@/lib/orientation', () => ({ useTurnsWithPhone: () => {} }));
vi.mock('@/lib/downloads', () => ({
  maySaveToPhone: async () => true,
  saveToPhone: async () => {},
  shareFile: async () => {},
}));

// Two things of the phone, turned by the test. «Reduce motion»: node has no media query to ask, and
// without one `react-native-web` answers «reduced» for good — which is the other half of what this
// file is about, so it has to be answerable both ways. And the animations themselves: the window's
// arrival is the subject, and `react-native-web` ends every animation the moment it starts, which
// leaves nothing to watch. This replaces the setup's stand-in for the module, so its `Modal` comes
// along (see `vitest.setup.ts`), and the screen's own size, which is how the window knows which way
// up the phone is.
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
    useWindowDimensions: () => phone,
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
      timing: (
        value: { setValue: (to: number) => void },
        config: { toValue: number; duration: number },
      ) => ({
        start: (ended?: (result: { finished: boolean }) => void) => {
          runs.push({
            to: config.toValue,
            ms: config.duration,
            value,
            end: () => {
              value.setValue(config.toValue);
              ended?.({ finished: true });
            },
          });
        },
        stop: () => {},
      }),
    },
  };
});

import { serve } from '@tests/helpers/api';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { StyleSheet } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import type { MediaItem } from '@/api';
import { Filmstrip, ViewerBar } from '@/kit';
import { setLanguage } from '@/lib/language';
import { FrameViewer, frameBox } from '@/screens/memory/frame-viewer';

/**
 * The frame's own screen arriving (TASK-540, spec 10.14.3, AC #4): «выезжает снизу, 260 мс, ease-out;
 * уход 200 мс. Кадр при этом ужимается кверху … Кадр и панель едут одним движением, а не двумя.»
 *
 * The claim is about a movement, so it is checked as one: what the panel has come up by, what room
 * the frame is left with and what box it is drawn in are all read off the tree while the animation
 * is *stopped half-way*, and they have to be in step. A window that shrank the frame first and slid
 * the panel after would pass every check that only looked at the two ends.
 */

mountsTrees();

const shots = (): MediaItem[] => [
  {
    id: 'a',
    kind: 'photo',
    status: 'ready',
    uploaded_by: 'me',
    hidden: false,
    size_bytes: '1000000',
    captured_at: new Date(2026, 8, 13, 21).toISOString(),
    width: null,
    height: null,
    orientation: null,
    duration_seconds: null,
    created_at: new Date(2026, 8, 13, 21).toISOString(),
    label_ids: [],
    thumbnail_url: 'https://r2.example/a',
    preview_url: null,
    screening_rejected: null,
    screening_reason: null,
  },
];

async function open() {
  serve(() => undefined);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    await setLanguage('ru');
  });
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <FrameViewer
          memoryId="m1"
          item={shots()[0]}
          frames={shots()}
          roster={null}
          memory={null}
          mayDelete={() => true}
          nameOf={(one) => one.id}
          onOpen={() => {}}
          onClose={() => {}}
          onRemoved={() => {}}
          onEdited={() => {}}
        />,
      ),
    );
  });
  const root = tree.root;
  return {
    root,
    panels: () => root.findAll((one) => one.props.rise !== undefined),
    /** The pill over the picture — the same press a finger coming down it makes (10.14.4). */
    press: () => act(async () => root.findByType(ViewerBar).props.onPress()),
  };
}

const numberOf = (one: unknown) => (one as { __getValue(): number }).__getValue();

/** The one animation run over `ms` — the window's own arrival, told apart from the rest by its time. */
const over = (ms: number) => runs.filter((one) => one.ms === ms);

/** The box the frame is drawn in: the nearest ancestor drawn at an animated size. */
function boxOf(node: ReactTestInstance) {
  for (let up = node.parent; up; up = up.parent) {
    const style = StyleSheet.flatten(up.props.style) as
      | { width?: unknown; height?: unknown }
      | undefined;
    if (typeof (style?.width as { __getValue?: unknown })?.__getValue === 'function')
      return style as { width: unknown; height: unknown };
  }
  throw new Error('nothing around the picture is drawn at a size of its own');
}

/** The room the frame is centred in — the stage, the one view sized so above the picture. */
function stageOf(screen: Awaited<ReturnType<typeof open>>) {
  const row = screen.root.findAll((one) =>
    Array.isArray(
      (StyleSheet.flatten(one.props.style) as { transform?: unknown[] } | undefined)?.transform,
    ),
  )[0];
  for (let up = row.parent; up; up = up.parent) {
    const style = StyleSheet.flatten(up.props.style) as { height?: unknown } | undefined;
    if (typeof (style?.height as { __getValue?: unknown })?.__getValue === 'function')
      return style?.height;
  }
  throw new Error('the picture stands in nothing drawn at a height of its own');
}

/** Where the panel's own box has come to: its `translateY`, which is zero once it has settled. */
function panelLift(screen: Awaited<ReturnType<typeof open>>) {
  const box = screen.root.findAll(
    (one) =>
      (
        StyleSheet.flatten(one.props.style) as
          | { transform?: { translateY?: unknown }[] }
          | undefined
      )?.transform?.[0]?.translateY !== undefined,
  )[0];
  return numberOf(
    (StyleSheet.flatten(box.props.style) as { transform: { translateY: unknown }[] }).transform[0]
      .translateY,
  );
}

const picture = (screen: Awaited<ReturnType<typeof open>>) =>
  screen.root.findAll((one) => one.props.contentFit === 'cover')[0];

test('the panel is raised over the layout’s 260 with the frame shrinking above it, one movement and not two', async () => {
  motion.tell(false);
  runs.length = 0;
  const screen = await open();
  const full = frameBox(null, null, phone.width, phone.height);
  // The panel's own height from the layout's 292 down to the foot of the window, and the room the
  // frame keeps above it: the layout's 289 upright.
  const panelTall = phone.height - 292;

  // Nothing has moved and nothing is moving: the picture has the whole of the window.
  expect(over(260)).toHaveLength(0);
  expect(numberOf(stageOf(screen))).toBe(phone.height);
  expect(numberOf(boxOf(picture(screen)).height)).toBe(full.height);

  await screen.press();
  // Mounted at once — the read behind it belongs to the opening — and still off the bottom of the
  // window, which is where the rise begins.
  expect(screen.panels()).toHaveLength(1);
  expect(panelLift(screen)).toBe(panelTall);
  expect(over(260)).toHaveLength(1);

  // Stopped half-way: the panel is half up and the frame is half shrunk. That is what «одним
  // движением» means — one value drives both, so a window that shrank the frame first and slid the
  // panel after would have them in two different places here.
  const rise = over(260)[0];
  await act(async () => rise.value.setValue(0.5));
  expect(panelLift(screen)).toBe(panelTall / 2);
  expect(numberOf(stageOf(screen))).toBe((phone.height + 289) / 2);
  expect(numberOf(boxOf(picture(screen)).height)).toBe((full.height + 289) / 2);

  // And settled: the panel at the foot of the window and the frame in the top 289 of it.
  await act(async () => rise.end());
  expect(panelLift(screen)).toBe(0);
  expect(numberOf(stageOf(screen))).toBe(289);
  expect(numberOf(boxOf(picture(screen)).height)).toBe(289);
});

test('the panel leaves over its own 200, and is put away only once it has arrived', async () => {
  motion.tell(false);
  runs.length = 0;
  const screen = await open();
  await screen.press();
  await act(async () => over(260)[0].end());
  runs.length = 0;

  await screen.press();
  expect(over(200)).toHaveLength(1);
  // Still standing while it comes down, and the strip is still away with it: the tools come back
  // when the panel is gone, not when it starts to leave.
  expect(screen.panels()).toHaveLength(1);
  expect(screen.root.findAllByType(Filmstrip)).toHaveLength(0);
  expect(numberOf(stageOf(screen))).toBe(289);

  await act(async () => over(200)[0].end());
  expect(screen.panels()).toHaveLength(0);
  expect(numberOf(stageOf(screen))).toBe(phone.height);
  expect(screen.root.findAllByType(Filmstrip)).toHaveLength(1);
});

test('under «reduce motion» there is no rise at all: the panel is simply there, and the frame already short', async () => {
  // Spec 6 and 10.14.3: «при системном „уменьшить движение“ панель появляется сразу в осевшем виде».
  motion.tell(true);
  runs.length = 0;
  const screen = await open();
  await screen.press();
  expect(over(260)).toHaveLength(0);
  expect(screen.panels()).toHaveLength(1);
  expect(panelLift(screen)).toBe(0);
  expect(numberOf(stageOf(screen))).toBe(289);

  // And it goes at once too.
  await screen.press();
  expect(over(200)).toHaveLength(0);
  expect(screen.panels()).toHaveLength(0);
  expect(numberOf(stageOf(screen))).toBe(phone.height);
});
