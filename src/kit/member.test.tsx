import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { Chip, ChipAction, MemberHead, RowMember, Status } from '@/kit/member';
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

/**
 * `.row-member--head` — the same row turned on the person reading it, at the top of the profile
 * (TASK-114). It shares the roster row's second line, so what is checked here is the half that is
 * its own: the larger circle, the name in full voice, and the hairline that ends «кто вы».
 */
test('the head says the name in full voice with the username and the address under it', async () => {
  await setTheme('dark');
  const html = renderToStaticMarkup(
    <MemberHead name="Лёша" username="@lesha" email="lesha@почта.рф" />,
  );

  expect(html).toContain('Лёша');
  expect(html).toContain('@lesha');
  expect(html).toContain('lesha@почта.рф');
  // The circle carries the first letter and nothing else — it repeats the name beside it, so it is
  // hidden from a screen reader rather than read out twice.
  expect(html).toContain('>Л<');
  // The hairline the row draws itself, so no screen has to remember to. Held by the property and
  // not by a pixel count, the reason this file gives at the top.
  expect(html).toContain('r-borderBottomWidth');
  // Name over the two smaller lines, never beside them.
  expect(html.indexOf('Лёша')).toBeLessThan(html.indexOf('@lesha'));
});

test('and the head turns with the theme, hairline and all', async () => {
  const head = <MemberHead name="Лёша" username="@lesha" email="lesha@почта.рф" />;

  await setTheme('light');
  const day = renderToStaticMarkup(head);
  await setTheme('dark');
  const night = renderToStaticMarkup(head);

  // Compared against the app's own two renders rather than against colours spelled out here, the
  // idiom `screen-theme.test.tsx` explains: a row built on a sheet made once would answer both
  // switches the same.
  expect(day).not.toBe(night);
});

test('and it holds its shape when the account is nothing but a username', async () => {
  await setTheme('dark');
  const html = renderToStaticMarkup(<MemberHead name="lesha" />);

  expect(html).toContain('lesha');
  // Whoever signed in by Apple with the address hidden has neither line to show. The row keeps the
  // circle and the name and puts nothing empty under them.
  expect(html).not.toContain('@');
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
