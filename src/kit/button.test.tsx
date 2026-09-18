import { Plus } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { Button, IconButton, type ButtonVariant } from '@/kit/button';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Every state of every button of spec 7.2, drawn once each. */

beforeAll(async () => {
  await setTheme('dark');
});

const VARIANTS: ButtonVariant[] = [
  'primary',
  'paper',
  'secondary',
  'small',
  'quiet',
  'danger',
  'danger-outline',
];

test('the seven buttons are seven different buttons', () => {
  allDifferent(
    Object.fromEntries(
      VARIANTS.map((variant) => [variant, <Button variant={variant} label="Смонтировать" />]),
    ),
  );
});

test('the main button is the only one carrying the accent and the shadow with it', () => {
  const primary = story(<Button variant="primary" label="Создать" />);
  // #4B5BFF, and the shadow spec 4 gives it — together, because a shadow without the fill would
  // make some other button look like the main one.
  expect(primary).toContain('rgba(75,91,255,1.00)');
  expect(primary).toContain('12px 32px');

  for (const variant of VARIANTS.filter((v) => v !== 'primary')) {
    expect(story(<Button variant={variant} label="Создать" />)).not.toContain('12px 32px');
  }
});

test('the dangerous button is filled and shadowless, and the outlined one is neither', () => {
  const solid = story(<Button variant="danger" label="Удалить" />);
  // #CE3028 under white — the fill of an irreversible action.
  expect(solid).toContain('rgba(206,48,40,1.00)');
  expect(solid).not.toContain('px 28px');
  expect(solid).not.toContain('px 32px');

  const outline = story(<Button variant="danger-outline" label="Удалить" />);
  expect(outline).not.toContain('rgba(206,48,40,1.00)');
  // #FF8D8D — danger read as text, which is what the base danger cannot be.
  expect(outline).toContain('rgba(255,141,141,1.00)');
});

test('a button that cannot be pressed says so, loses its fill and keeps its words', () => {
  for (const variant of VARIANTS) {
    const off = story(<Button variant={variant} label="Отправить" disabled />);
    expect(off).toContain('aria-disabled="true"');
    // `raise` and `faint` — spec 7.2 for every unavailable button, whatever it was before.
    expect(off).toContain('rgba(34,34,46,1.00)');
    expect(off).toContain('rgba(110,107,125,1.00)');
    expect(off).toContain('Отправить');
  }
});

test('a button waiting on the server swallows the press and says the action in the continuous', () => {
  const busy = story(<Button variant="primary" label="Отправить" busyLabel="Отправляем" busy />);
  expect(busy).toContain('Отправляем');
  expect(busy).not.toContain('>Отправить<');
  // It reads as disabled while it waits: React Native only speaks `busy` on Android, so on iOS the
  // button would otherwise announce itself live while it is swallowing every tap.
  expect(busy).toContain('aria-disabled="true"');
  // Without a continuous form the label simply stays — a word is the screen's to write.
  expect(story(<Button variant="primary" label="Отправить" busy />)).toContain('Отправить');
});

test('the five heights are five heights, and each variant starts at its own', () => {
  allDifferent({
    // 60, and only «Выйти из аккаунта» stands at it.
    xl: <Button label="Дальше" size="xl" />,
    lg: <Button label="Дальше" size="lg" />,
    md: <Button label="Дальше" size="md" />,
    sm: <Button label="Дальше" size="sm" />,
    xs: <Button label="Дальше" size="xs" />,
  });
  // The main action stands at 56 and the small row button at 44 without being told.
  expect(story(<Button variant="primary" label="Дальше" />)).toBe(
    story(<Button variant="primary" label="Дальше" size="lg" />),
  );
  expect(story(<Button variant="small" label="Вернуть" />)).toBe(
    story(<Button variant="small" label="Вернуть" size="sm" />),
  );
});

test('the loud buttons run the width they are given and the quiet ones are as wide as their words', () => {
  expect(story(<Button variant="primary" label="Создать" />)).not.toBe(
    story(<Button variant="primary" label="Создать" wide={false} />),
  );
  expect(story(<Button variant="small" label="Вернуть" />)).not.toBe(
    story(<Button variant="small" label="Вернуть" wide />),
  );
});

test('a glyph can stand before the words or after them, and never instead of them', () => {
  allDifferent({
    bare: <Button variant="primary" label="Новое воспоминание" />,
    leading: <Button variant="primary" label="Новое воспоминание" icon={Plus} />,
    trailing: <Button variant="primary" label="Дальше" trailingIcon={Plus} />,
  });
  expect(story(<Button variant="primary" label="Новое воспоминание" icon={Plus} />)).toContain(
    'Новое воспоминание',
  );
});

test('the round button is drawn at the five diameters the layout uses', () => {
  allDifferent(
    Object.fromEntries(
      [56, 48, 44, 36, 32].map((size) => [
        String(size),
        <IconButton icon={Plus} label="Фильтры" size={size} />,
      ]),
    ),
  );
  expect(story(<IconButton icon={Plus} label="Фильтры" size={48} />)).toContain('width:48px');
});

test('every round tone is its own fill, and none of them is a word', () => {
  allDifferent({
    surface: <IconButton icon={Plus} label="Аккаунт" tone="surface" />,
    ghost: <IconButton icon={Plus} label="Назад" tone="ghost" />,
    glass: <IconButton icon={Plus} label="Закрыть" tone="glass" />,
    paper: <IconButton icon={Plus} label="Послушать" tone="paper" />,
    spark: <IconButton icon={Plus} label="Выбрать" tone="spark" />,
    danger: <IconButton icon={Plus} label="Удалить" tone="danger" />,
  });
  // The label is the only thing a screen reader has: a glyph says nothing on its own.
  expect(story(<IconButton icon={Plus} label="Фильтры" />)).toContain('aria-label="Фильтры"');
});

test('a round button that stays in is a switch, and one that fires is not', () => {
  const plain = story(<IconButton icon={Plus} label="Выбрать" />);
  expect(plain).toContain('role="button"');

  // Passing `on` at all is what makes it a switch — a button that does not toggle must not read as
  // an unticked box.
  const off = story(<IconButton icon={Plus} label="Выбрать" on={false} />);
  const held = story(<IconButton icon={Plus} label="Выбрать" on />);
  expect(off).toContain('role="togglebutton"');
  expect(held).toContain('role="togglebutton"');
  expect(off).not.toBe(held);
  // Held in, it is filled with `spark` and read in `sparkInk`.
  expect(held).toContain('rgba(228,255,79,1.00)');
  expect(off).not.toContain('rgba(228,255,79,1.00)');
});

test('the spark dot says a setting has moved off its default, and is not a state of its own', () => {
  allDifferent({
    plain: <IconButton icon={Plus} label="Фильтры" tone="surface" />,
    dotted: <IconButton icon={Plus} label="Фильтры" tone="surface" dot />,
  });
  const off = story(<IconButton icon={Plus} label="Фильтры" disabled />);
  expect(off).toContain('aria-disabled="true"');
});
