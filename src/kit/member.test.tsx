import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { MemberHead } from '@/kit/member';
import { setTheme } from '@/theme';

/**
 * `.row-member--head` — the row a person is shown themselves in, at the top of the profile. Rendered
 * through `react-native-web` for the reason `segment.test.tsx` gives.
 */

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

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
  // The hairline that ends «кто вы»: the row draws it itself, so no screen has to remember to.
  // react-native-web hashes a style into a class name, and the property is what is left readable.
  expect(html).toContain('r-borderBottomWidth');
  // Name over the two smaller lines, never beside them.
  expect(html.indexOf('Лёша')).toBeLessThan(html.indexOf('@lesha'));
});

test('and it turns with the theme, hairline and all', async () => {
  const head = <MemberHead name="Лёша" username="@lesha" email="lesha@почта.рф" />;

  await setTheme('light');
  const day = renderToStaticMarkup(head);
  await setTheme('dark');
  const night = renderToStaticMarkup(head);

  // Compared against the app's own two renders rather than against colours spelled out here, the
  // idiom `screen-theme.test.tsx` explains: react-native-web hashes a style into a class name, so
  // the hash is the value. A row built on a sheet made once would answer both switches the same.
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
