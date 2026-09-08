import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { IconButton } from '@/kit/bars';
import { setTheme } from '@/theme';

/**
 * The appbar's icon button, and the one state of it that outlives the finger: pressed *in* rather
 * than pressed. The frames' corner icon is a switch — «нажали — вошли, он залит; нажали ещё —
 * вышли» (kit, «Экраны» 4) — and a switch whose only difference is a fill is a switch nobody using a
 * screen reader can find, so it has to be a different kind of control and not only a different
 * colour.
 *
 * Rendered through `react-native-web` (the alias lives in `vitest.config.mjs`), the way every other
 * kit test here renders. What that renderer shows is the role and the classes; `accessibilityState`
 * it drops on the floor, so what a phone speaks is beyond anything node can see — the same blind
 * spot `tile.test.tsx` works around, and the reason these read the role instead.
 */

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

// The action bar in this file asks the phone how far up its own chin reaches; nothing here draws
// one, and node has no phone to ask.
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The real glyphs are Lucide over `react-native-svg`, which is native and will not import in node.
// What the button says of itself does not depend on which glyph it holds.
const Glyph = () => null;

const draw = (props: { on?: boolean }) =>
  renderToStaticMarkup(
    <IconButton icon={Glyph} label="Выбрать кадры" onPress={() => {}} {...props} />,
  );

test('a button that toggles is a different control from one that fires', async () => {
  await setTheme('dark');
  // Passing `on` at all is what makes it a switch, either way round.
  for (const on of [true, false]) expect(draw({ on })).toContain('role="togglebutton"');
  // And leaving it off keeps every other icon button in the app a plain button: a state of «not
  // pressed» on something that does not toggle is read out as an unticked box.
  expect(draw({})).toContain('role="button"');
  expect(draw({})).toContain('aria-label="Выбрать кадры"');
});

test('the state that is on is drawn, not only spoken', async () => {
  await setTheme('dark');
  // The kit's `.iconbtn[aria-pressed="true"]{background:var(--raise)}` — a fill where the resting
  // button has none. `react-native-web` names its generated classes after the property they came
  // from, which is how `tile.test.tsx` reads a style off the markup too.
  expect(draw({ on: true })).toMatch(/\br-backgroundColor-/);
  expect(draw({ on: false })).not.toMatch(/\br-backgroundColor-/);
});
