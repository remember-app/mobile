import { ImageIcon } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { IconButton } from '@/kit/button';
import { allDifferent, story } from '@/kit/story';
import { RowStuck, Upload } from '@/kit/upload';
import { setTheme } from '@/theme';

/** Spec 7.6 — sending: the block that counts it down, and the row for a file that will not go. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the sending block says what is going, how much is left, and that the phone can be put away', () => {
  const block = story(
    <Upload
      title="Отправляем"
      meta="Осталось 9 файлов"
      value={0.26}
      hint="Приложение можно свернуть — отправка продолжится"
    />,
  );
  expect(block).toContain('Отправляем');
  expect(block).toContain('Осталось 9 файлов');
  expect(block).toContain('Приложение можно свернуть — отправка продолжится');
  expect(block).toContain('width:26%');
});

test('going and paused are the same block saying two different things under the bar', () => {
  // Paused is not a state of its own: the bar stops where it is and the line says why. A bar that
  // went backwards, or a block that vanished when the signal did, would both lie about the disk.
  allDifferent({
    going: (
      <Upload
        title="Отправляем"
        meta="Осталось 9 файлов"
        value={0.26}
        hint="Приложение можно свернуть — отправка продолжится"
      />
    ),
    paused: (
      <Upload
        title="Отправляем"
        meta="Осталось 9 файлов"
        value={0.26}
        hint="Продолжим, когда появится связь"
      />
    ),
  });
});

test('a stuck file names the reason in technical words, because a person can act on them', () => {
  const stuck = story(
    <RowStuck
      name="IMG_4821.HEIC"
      reason="Хранилище отказало на части 3 (503)"
      uri="https://b/1.jpg"
    >
      <IconButton icon={ImageIcon} label="Убрать из очереди" size={36} />
    </RowStuck>,
  );
  expect(stuck).toContain('IMG_4821.HEIC');
  expect(stuck).toContain('Хранилище отказало на части 3 (503)');
  expect(stuck).toContain('aria-label="Убрать из очереди"');
});

test('a file the phone no longer has shows a glyph where its picture would be', () => {
  allDifferent({
    withThumb: <RowStuck name="IMG_4821.HEIC" reason="Хранилище отказало" uri="https://b/1.jpg" />,
    gone: (
      <RowStuck name="IMG_4821.HEIC" reason="Этого файла больше нет на телефоне" icon={ImageIcon} />
    ),
  });
  expect(
    story(<RowStuck name="IMG_4821.HEIC" reason="Файла больше нет" icon={ImageIcon} />),
  ).toContain('data-glyph');
});
