import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

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

import { SCRIM_DEAF_MS, useScrimTap } from '@/kit/sheet';

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
