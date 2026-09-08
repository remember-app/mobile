import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { Chip, ChipAction, RowMember, Status } from '@/kit/member';
import { setTheme } from '@/theme';

/**
 * The roster line, rendered through `react-native-web` the way the button's own test is. What came
 * back from a live device is a shape — one row taller than the rest, the stack ragged (TASK-111) —
 * so the shape is what these hold: whatever goes into a row, the row is the same height.
 *
 * `react-native-web` writes a `StyleSheet` out as class names and only dynamic values as inline
 * styles, so heights are held here by two elements resolving to the *same* class rather than by a
 * pixel count. That is the invariant anyway: the pressed chip is as tall as the chip beside it, and
 * the second line of one row is floored like the second line of every other.
 */

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

/** The classes of the first element carrying the meta line's floor — the row's second line. */
const metaLine = (markup: string) => markup.match(/<div class="([^"]*r-minHeight[^"]*)"/)?.[1];

/** Whatever class stands for the height of the first thing drawn — a chip, on its own. */
const height = (markup: string) => markup.match(/r-height-\w+/)?.[0];

test('a row is the same shape whether its standing is a word or the chip that sets it', () => {
  const word = renderToStaticMarkup(
    <RowMember
      name="Марина"
      meta="@marina"
      status={<Status text="Планирует загрузить" />}
      count="12 кадров"
    />,
  );
  const chip = renderToStaticMarkup(
    <RowMember name="Аня" status={<ChipAction label="Мне нечего добавлять" />} count="0 кадров" />,
  );

  // The same floor under the second line of both — that line is what the row is read for, and it
  // does not deepen because what stands in it can be pressed.
  expect(metaLine(word)).toBeDefined();
  expect(metaLine(chip)).toBe(metaLine(word));
  // And the pressable chip is exactly as tall as the role chip the kit draws beside it, which is
  // the rule that keeps it from pushing its own row past the ones around it.
  const pressable = renderToStaticMarkup(<ChipAction label="Мне нечего добавлять" />);
  expect(height(pressable)).toBeDefined();
  expect(height(pressable)).toBe(height(renderToStaticMarkup(<Chip label="Добавление" />)));
  // Both rows say how much that person brought: the count is the whole reason for the second line.
  expect(word).toContain('12 кадров');
  expect(chip).toContain('0 кадров');
  expect(chip).toContain('Мне нечего добавлять');
});

test('the green dot is «all uploaded» and nothing else', async () => {
  await setTheme('dark');
  const done = renderToStaticMarkup(<Status text="Всё загрузил" ready />);
  const coming = renderToStaticMarkup(<Status text="Планирует загрузить" />);

  // #7BA05B, the kit's one green, and the organizer scans the column for it. Everybody still owed
  // is muted — dot and word alike, because a second colour there would say something it does not.
  expect(done).toContain('rgba(123,160,91');
  expect(coming).not.toContain('rgba(123,160,91');
});
