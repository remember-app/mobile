import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

// The sheet asks expo-router when the screen under it loses focus, and outside a navigator that
// hook has nobody to ask. Standing in for it hands the test the two moments the sheet cares about:
// what runs on focus, and the cleanup that runs on blur — the same two react-navigation runs.
const { focus } = vi.hoisted(() => ({ focus: [] as (() => void | (() => void))[] }));
vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focus.push(effect);
  },
}));

// `@/theme` reads the stored pick on import and `expo-secure-store` is native; nothing below asks
// it anything, so the store only has to be there.
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

// The safe area is Flow source node cannot parse, and the sheet imports it for the inset it pads
// its own bottom with. Nothing here draws the sheet, so an empty inset is enough to get the file in.
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import { SCRIM_DEAF_MS, useScrimTap, useShutOnBlur } from '@/kit/sheet';
import source from '@/kit/sheet.tsx?raw';

/**
 * The sheet closes when you tap beside it, and that is exactly how the button that opens one looked
 * dead: two quick taps on «Make a montage», and the second one lands where the button was a moment
 * ago — on the scrim of the sheet the first tap raised (TASK-95). So the scrim is deaf for its
 * first {@link SCRIM_DEAF_MS} and hears everything after.
 *
 * The hook and not the `Pressable`, because this project has no render harness: what the scrim does
 * with a finger is native, and the only thing standing between the finger and `onCancel` is this
 * handler. It is taken here the way the sheet takes it — through a render, on a real ref — and then
 * tapped on a clock that can be moved.
 */

afterEach(() => {
  vi.restoreAllMocks();
  focus.length = 0;
});

/** The sheet's scrim, mounted at a known moment. Tap it at whatever moment the case is about. */
function scrim(onCancel: () => void): (at: number) => void {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
  let tap = (): void => {};
  function Scrim() {
    tap = useScrimTap(onCancel);
    return null;
  }
  renderToStaticMarkup(<Scrim />);

  return (at) => {
    clock.mockReturnValue(at);
    tap();
  };
}

test('the tap that arrives while the sheet is still coming up leaves it standing', () => {
  const onCancel = vi.fn();
  const tapAt = scrim(onCancel);

  // The second tap of a double tap: a phone calls two taps one gesture within some 250-300ms, and
  // both ends of that window land on a sheet that is still rising.
  tapAt(0);
  tapAt(SCRIM_DEAF_MS - 1);

  expect(onCancel).not.toHaveBeenCalled();
});

test('a tap beside a sheet that is up is still the same as declining', () => {
  const onCancel = vi.fn();

  scrim(onCancel)(SCRIM_DEAF_MS);

  expect(onCancel).toHaveBeenCalledOnce();
});

/**
 * And the way out nobody takes on purpose (TASK-129): the screen under the sheet going behind
 * something else. A `Modal` is not drawn inside the screen that raised it, so a `router.push` off a
 * tapped notification used to leave the sheet standing over whatever came next — three faces had
 * grown their own hand-written copy of the fix before it moved in here.
 *
 * Taken the same way as the scrim above: through a render, on a real ref, with what expo-router
 * would call on the way out called by hand.
 */

/** A sheet on a screen, raised or not. Returns what that screen runs when it loses focus. */
function sheet(visible: boolean, onCancel: () => void): () => void {
  function Standing() {
    useShutOnBlur(visible, onCancel);
    return null;
  }
  renderToStaticMarkup(<Standing />);

  const onFocus = focus.pop();
  if (onFocus === undefined) throw new Error('the sheet asked nothing about focus');
  const blur = onFocus();
  if (blur === undefined) throw new Error('the sheet does nothing when the screen goes');
  return blur;
}

test('a sheet still up when the screen goes is shut the way its own cross shuts it', () => {
  const onCancel = vi.fn();

  sheet(true, onCancel)();

  expect(onCancel).toHaveBeenCalledOnce();
});

test('a screen with no sheet up is left alone on the way out', () => {
  const onCancel = vi.fn();

  sheet(false, onCancel)();

  expect(onCancel).not.toHaveBeenCalled();
});

test('what is shut is the sheet as the last render left it, not as the first one found it', () => {
  // Read off the source, because a sheet is raised after it is mounted and there is no renderer here
  // to render one twice. The callback expo-router is given is memoised on nothing — a subscription
  // torn down and built again on every render is not what this wants — so reading `visible` off its
  // own closure would read the `false` every sheet mounts with, and no sheet would ever be shut.
  expect(source).toContain('now.current = { visible, onCancel };');
  expect(source).toContain('if (now.current.visible) now.current.onCancel();');
});
