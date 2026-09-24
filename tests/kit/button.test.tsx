import { Plus } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { Button, type ButtonVariant, IconButton } from '@/kit/button';
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
  'dashed',
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

test('the dangerous button is filled and shadowless', () => {
  const solid = story(<Button variant="danger" label="Удалить" />);
  // #CE3028 under white — the fill of an irreversible action. The way out beside it is the outlined
  // `secondary`, and there is no outlined red: red means «навсегда» and is spent on one thing.
  expect(solid).toContain('rgba(206,48,40,1.00)');
  expect(solid).not.toContain('px 28px');
  expect(solid).not.toContain('px 32px');
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

test('the dashed button is a hole rather than a thing, and it is square only where it is tall', () => {
  // Spec 7.2: 1px dashed `lineQuiet` (#3A3747) and no fill at all — «Новый лейбл» and «Свой трек».
  const big = story(<Button variant="dashed" label="Новый лейбл" />);
  expect(big).toContain('rgba(58,55,71,1.00)');
  expect(big).toContain('border-top-style:dashed');
  // 52 is a box with a 16 radius; 32 is a pill, like every chip in the row it stands in.
  expect(big).not.toBe(story(<Button variant="dashed" label="Свой трек" size="xxs" />));
  expect(story(<Button variant="primary" label="Создать" />)).not.toContain('dashed');
});

test('the six heights are six heights, and each variant starts at its own', () => {
  allDifferent({
    // 60, and only «Выйти из аккаунта» stands at it.
    xl: <Button label="Дальше" size="xl" />,
    lg: <Button label="Дальше" size="lg" />,
    md: <Button label="Дальше" size="md" />,
    sm: <Button label="Дальше" size="sm" />,
    xs: <Button label="Дальше" size="xs" />,
    xxs: <Button label="Дальше" size="xxs" />,
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

test('the round button is drawn at the six diameters the layout uses', () => {
  allDifferent(
    Object.fromEntries(
      [72, 56, 48, 44, 36, 32].map((size) => [
        String(size),
        <IconButton icon={Plus} label="Фильтры" size={size} />,
      ]),
    ),
  );
  expect(story(<IconButton icon={Plus} label="Фильтры" size={48} />)).toContain('width:48px');
  // The glyph grows with the circle. The viewer's 72 is the one that needs it: the layout draws a
  // 26 in it, and 22 there reads as a plate with something small lost in the middle (TASK-181).
  expect(story(<IconButton icon={Plus} label="Пауза" size={72} />)).toContain('width="26"');
  expect(story(<IconButton icon={Plus} label="Закрыть" size={48} />)).toContain('width="22"');
});

test('every round tone is its own fill, and none of them is a word', () => {
  allDifferent({
    surface: <IconButton icon={Plus} label="Аккаунт" tone="surface" />,
    raise: <IconButton icon={Plus} label="Короче на 5 секунд" tone="raise" />,
    ghost: <IconButton icon={Plus} label="Назад" tone="ghost" />,
    glass: <IconButton icon={Plus} label="Назад" tone="glass" />,
    viewer: <IconButton icon={Plus} label="Закрыть" tone="viewer" />,
    paper: <IconButton icon={Plus} label="Послушать" tone="paper" />,
    spark: <IconButton icon={Plus} label="Выбрать" tone="spark" />,
    danger: <IconButton icon={Plus} label="Удалить" tone="danger" />,
  });
  // The label is the only thing a screen reader has: a glyph says nothing on its own.
  expect(story(<IconButton icon={Plus} label="Фильтры" />)).toContain('aria-label="Фильтры"');
});

test('the two glasses are two glasses, and both read their glyph in full voice', () => {
  // Spec 7.2: the bar over the feed is `ink` at 62% with a hairline of its own; the viewer's pane is
  // paper-tinted and has none — what shows through it is the frame itself.
  const bar = story(<IconButton icon={Plus} label="Назад" tone="glass" size={48} />);
  expect(bar).toContain('rgba(22,22,31,0.62)');
  expect(bar).toContain('rgba(255,255,255,0.09)');
  expect(bar).toContain('stroke="#F5F3EE"');

  const viewer = story(<IconButton icon={Plus} label="Закрыть" tone="viewer" size={48} />);
  expect(viewer).toContain('rgba(245,243,238,0.10)');
  expect(viewer).not.toContain('rgba(255,255,255,0.09)');
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
  // Spec 7.2 — held in: `accent`, a white hairline and the shadow that no other round button has.
  expect(held).toContain('rgba(75,91,255,1.00)');
  expect(held).toContain('6px 18px');
  expect(off).not.toContain('6px 18px');
});

test('a round button standing on a fill of its own reads its glyph in full voice', () => {
  // Spec 7.2: `muted` belongs to the 36 and the 32 that stand on nothing; the account in the root
  // bar and the two at the foot of the gallery stand on `surface` and are read in `paper`.
  expect(story(<IconButton icon={Plus} label="Аккаунт" tone="surface" />)).toContain(
    'stroke="#F5F3EE"',
  );
  expect(story(<IconButton icon={Plus} label="Закрыть" size={36} />)).toContain('stroke="#A4A1B2"');
});

test('the spark dot says a setting has moved off its default, and is not a state of its own', () => {
  allDifferent({
    plain: <IconButton icon={Plus} label="Фильтры" tone="surface" />,
    dotted: <IconButton icon={Plus} label="Фильтры" tone="surface" dot />,
  });
  const off = story(<IconButton icon={Plus} label="Фильтры" disabled />);
  expect(off).toContain('aria-disabled="true"');
});

test('the spark dot is ringed in whatever it stands on, which is the button it sits inside', () => {
  // Spec 7.4. On the filled 56 at the foot of the gallery that is `surface` and nothing else — an
  // `ink` ring there is a hole cut in the button.
  const filled = story(<IconButton icon={Plus} label="Фильтры" size={56} tone="surface" dot />);
  expect(filled).not.toContain('rgba(11,11,18,1.00)');
  // With no fill under it the screen is what it stands on, and the screen is `ink`.
  expect(story(<IconButton icon={Plus} label="Фильтры" size={56} dot />)).toContain(
    'rgba(11,11,18,1.00)',
  );
});
