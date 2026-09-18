import { ChevronLeft, User } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { ActionBar, AppBar, Board, ViewerBar, WizardBar } from '@/kit/bars';
import { Button, IconButton } from '@/kit/button';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { height, setTheme } from '@/theme';

/** Spec 7.1 — the frame of a screen: the board, the bar at the top, the layer at the bottom. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the board is the screen’s own ink, with the device’s status line left empty', async () => {
  const board = (
    <Board>
      <Text>Тело</Text>
    </Board>
  );
  const dark = story(board);
  expect(dark).toContain('Тело');
  // The background is the one thing the board itself draws, and it is the theme's — so the same
  // board in daylight is a different board. A board dark by itself is the silent way this breaks.
  await setTheme('light');
  expect(story(board)).not.toBe(dark);
  await setTheme('dark');
});

test('the four bars that carry words are four bars', () => {
  allDifferent({
    root: (
      <AppBar
        title="Воспоминания"
        variant="root"
        right={<IconButton icon={User} label="Аккаунт" tone="surface" />}
      />
    ),
    inner: (
      <AppBar title="Свадьба Лизы и Марка" left={<IconButton icon={ChevronLeft} label="Назад" />} />
    ),
    withSubtitle: (
      <AppBar
        title="Ваши кадры"
        subtitle="Свадьба Лизы и Марка · 12–14 сентября"
        left={<IconButton icon={ChevronLeft} label="Назад" />}
      />
    ),
    withAction: (
      <AppBar
        title="Свадьба Лизы и Марка"
        left={<IconButton icon={ChevronLeft} label="Назад" />}
        right={<IconButton icon={User} label="Выбрать" />}
      />
    ),
  });
});

test('the name at the top of a screen is its heading, and a long one is cut rather than wrapped', () => {
  const bar = story(<AppBar title="Свадьба Лизы и Марка в Карелии" />);
  expect(bar).toContain('role="heading"');
  // Cut with an ellipsis: the button on the right of the bar must not be pushed off the screen by
  // a long memory name.
  expect(bar).toContain('r-textOverflow');
});

test('an inner bar closes to 8 and hangs its round buttons outside the screen’s margin', () => {
  const inner = story(
    <AppBar
      title="Свадьба Лизы и Марка"
      left={<IconButton icon={ChevronLeft} label="Назад" />}
      right={<IconButton icon={User} label="Выбрать" />}
    />,
  );
  // Spec 7.1: −10 on each side, so the glyph in the button lines up with the words of the body
  // rather than the button's own edge.
  expect(inner).toContain('r-marginLeft-');
  expect(inner).toContain('r-marginRight-');

  // The root bar keeps 12 and its one button inside the margin: that one is filled, and a filled
  // button hung over the edge reads as falling off the screen.
  const root = story(
    <AppBar
      variant="root"
      title="Воспоминания"
      right={<IconButton icon={User} label="Аккаунт" tone="surface" />}
    />,
  );
  expect(root).not.toContain('r-marginRight-');
  // Two rhythms and not one — 8 in the inner bar, 12 in the root one.
  const gap = (markup: string) => markup.match(/r-gap-\w+/)?.[0];
  expect(gap(inner)).not.toBe(gap(root));
});

test('the second line under a name is there only when a screen has one', () => {
  const plain = story(<AppBar title="Ваши кадры" />);
  const withSub = story(<AppBar title="Ваши кадры" subtitle="Свадьба · 12–14 сентября" />);
  expect(plain).not.toContain('Свадьба · 12–14 сентября');
  expect(withSub).toContain('Свадьба · 12–14 сентября');
});

test('the wizard’s counter sits dead centre whatever stands on either side of it', () => {
  const wizard = story(
    <WizardBar
      step={2}
      steps={4}
      label="Шаг 2 из 4"
      back={<IconButton icon={ChevronLeft} label="Назад" />}
      cancel={<Button variant="quiet" label="Отмена" />}
    />,
  );
  expect(wizard).toContain('Шаг 2 из 4');
  expect(wizard).toContain('Отмена');
  // The scale under it says the same thing to a screen reader as the words above it.
  expect(wizard).toContain('role="progressbar"');
  allDifferent({
    first: <WizardBar step={1} steps={4} label="Шаг 1 из 4" />,
    last: <WizardBar step={4} steps={4} label="Шаг 4 из 4" />,
  });
});

test('the viewer’s bar floats on glass, because a photograph is the only surface under it', () => {
  const viewer = story(
    <ViewerBar
      date="13 сентября"
      meta="21:47 · Марк Ковалёв"
      left={<IconButton icon={ChevronLeft} label="Закрыть" tone="glass" size={48} />}
    />,
  );
  expect(viewer).toContain('13 сентября');
  expect(viewer).toContain('21:47 · Марк Ковалёв');
  expect(viewer).toContain('Закрыть');
});

test('the bottom layer fades up into the screen and grows when a count stands over its button', () => {
  const one = story(
    <ActionBar>
      <Button variant="primary" label="Новое воспоминание" />
    </ActionBar>,
  );
  // The spec's own CSS, handed to React Native as the string it takes.
  expect(one).toContain('linear-gradient(to top, #0B0B12 58%, transparent)');
  expect(one).toContain('height:132px');

  const counted = story(
    <ActionBar above={<Text role="meta">Выбрано 12 из 61</Text>}>
      <Button variant="primary" label="Отправить 12 файлов" />
    </ActionBar>,
  );
  expect(counted).toContain('Выбрано 12 из 61');
  expect(counted).toContain('height:176px');
  expect(counted).toContain('62%');
});

test('the gradient never catches a press, and the buttons over it do', () => {
  const layer = story(
    <ActionBar>
      <Button variant="primary" label="Создать" />
    </ActionBar>,
  );
  expect(layer).toContain('Создать');
  expect(layer).toContain('r-pointerEvents');
});

test('the header line is one height, and it is the spec’s', () => {
  expect(height.bar).toBe(44);
});
