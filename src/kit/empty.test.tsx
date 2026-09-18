import { Camera, ImageIcon, Link2Off, Play } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { Button } from '@/kit/button';
import { Empty, Spinner, Waiting, type SpinnerSize } from '@/kit/empty';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.8 — a screen with nothing on it yet, and a screen still waiting for something. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the signs an empty state can wear are each their own sign', () => {
  allDifferent({
    dashed: <Empty icon={ImageIcon} title="Ни одного кадра" text="Всё, что добавит любой участник, появится здесь." />,
    line: <Empty sign="line" icon={Link2Off} title="Приглашение не действует" text="Эту ссылку отозвали или заменили новой." />,
    spark: <Empty sign="spark" icon={Camera} title="Здесь пока пусто" text="Заведите воспоминание." />,
    poster: (
      <Empty
        sign="poster"
        icon={Play}
        photos={['https://b/1.jpg', 'https://b/2.jpg']}
        title="Ролика пока нет"
        text="Ролик — короткое видео из всего, что есть в воспоминании."
      />
    ),
  });
});

test('the heading names what is missing and the paragraph says what to do', () => {
  const empty = story(
    <Empty
      icon={ImageIcon}
      title="Ни одного кадра"
      text="Всё, что добавит любой участник, появится здесь. Начните со своих."
    />,
  );
  expect(empty).toContain('Ни одного кадра');
  expect(empty).toContain('Начните со своих');
  expect(empty).toContain('role="heading"');
});

test('the sign only repeats the words, so it says nothing of its own', () => {
  expect(story(<Empty icon={ImageIcon} text="Пусто" />)).not.toContain('aria-label');
});

test('waiting holds the place of the list instead of blinking over it', () => {
  allDifferent({
    empty: <Empty icon={ImageIcon} text="Пока никого" />,
    waiting: <Empty busy text="Собираем ваши воспоминания…" />,
  });
  // No sign at all while it waits — the spinner is what stands there.
  expect(story(<Empty busy icon={ImageIcon} text="Собираем…" />)).not.toContain('data-glyph');
});

test('the action belongs to the bottom layer, and anything else handed over stands under the words', () => {
  const withButton = story(
    <Empty icon={ImageIcon} title="Ни одного кадра" text="Начните со своих.">
      <Button variant="secondary" label="Добавить кадры" />
    </Empty>,
  );
  expect(withButton).toContain('Добавить кадры');
});

test('the spinner turns at the four sizes the layout uses', () => {
  const sizes: SpinnerSize[] = [16, 26, 34, 38];
  allDifferent(Object.fromEntries(sizes.map((size) => [String(size), <Spinner size={size} />])));
  expect(story(<Spinner size={34} />)).toContain('width:34px');
  // The lit arc is `spark` over `raise` — #E4FF4F on #22222E.
  expect(story(<Spinner size={34} />)).toContain('rgba(228,255,79,1.00)');
  expect(story(<Spinner size={34} />)).toContain('rgba(34,34,46,1.00)');
  // A button waiting borrows it in its own colours.
  expect(story(<Spinner size={16} track="#FFFFFF" head="transparent" />)).toContain(
    'rgba(255,255,255,1.00)',
  );
});

test('waiting says what is being waited for', () => {
  const waiting = story(<Waiting text="Присоединяем…" size={34} />);
  expect(waiting).toContain('Присоединяем…');
  expect(waiting).toContain('width:34px');
});
