import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { FieldShell } from '@/kit/field';
import { setTheme } from '@/theme';

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

/**
 * `FieldShell` is the field's own box (label, border, background, hint) without a `TextInput` in
 * it — `create.tsx`'s date picker is the first thing standing on it, and the kit's own shape for
 * whatever the next screen presses instead of types. What has to survive a screen reusing it: the
 * label and hint still reach the person who cannot see (`Field` carries the same two props to its
 * `TextInput` the same way), and a disabled shell still reads as disabled rather than as a plain
 * field nobody can tell isn't taking a tap.
 */

test('the label and hint reach the shell the same way they reach a typed field', () => {
  const html = renderToStaticMarkup(
    <FieldShell label="Дата события" hint="День, когда всё случится">
      <span>12 сентября</span>
    </FieldShell>,
  );

  expect(html).toContain('Дата события');
  expect(html).toContain('День, когда всё случится');
  expect(html).toContain('aria-label="Дата события"');
  expect(html).toContain('role="button"');
  expect(html).toContain('12 сентября');
});

test('a disabled shell is coloured off, the way a disabled field is', async () => {
  await setTheme('dark');
  const on = renderToStaticMarkup(
    <FieldShell label="Дата события">
      <span>12 сентября</span>
    </FieldShell>,
  );
  const off = renderToStaticMarkup(
    <FieldShell label="Дата события" disabled>
      <span>12 сентября</span>
    </FieldShell>,
  );

  // `.input:disabled` — `boxOff`, the same class `Field`'s own disabled `TextInput` wears, over
  // `color.ink`. react-native-web hashes a style object to the same class name every render, so
  // its presence here is as stable a signal as the colour itself would be.
  expect(off).toContain('r-backgroundColor-scl3zj');
  expect(on).not.toContain('r-backgroundColor-scl3zj');
  expect(off).toContain('disabled=""');
  expect(off).toContain('aria-disabled="true"');
  expect(on).not.toContain('disabled=""');
});
