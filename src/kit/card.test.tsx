import { ImageIcon, UserPlus } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { Button, IconButton } from '@/kit/button';
import { Banner, CardMessage, HintNote } from '@/kit/card';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.6 — the three surfaces that carry a sentence rather than a thing. */

beforeAll(async () => {
  await setTheme('dark');
});

test('a message card carries the paragraph and the answer to it', () => {
  const card = story(
    <CardMessage
      icon={ImageIcon}
      text="Remember не видит вашу галерею, пока вы не разрешите, — а выбранное остаётся на телефоне, пока вы не отправите его"
    >
      <Button variant="primary" size="md" label="Разрешить доступ" />
    </CardMessage>,
  );
  expect(card).toContain('Remember не видит вашу галерею');
  expect(card).toContain('Разрешить доступ');
  expect(card).toContain('data-glyph');
});

test('a hint is spark when it is about people and muted when it is about anything else', () => {
  allDifferent({
    people: <HintNote icon={UserPlus} tone="spark" text="Позвать участников можно сразу" />,
    neutral: <HintNote icon={ImageIcon} text="Доступ ограничен" />,
    withAction: (
      <HintNote icon={ImageIcon} text="Доступ ограничен">
        <Button variant="small" size="xs" label="Отдать ещё" />
      </HintNote>
    ),
  });
  // #E4FF4F on the glyph, and spec 1.2 is what keeps it off the neutral one.
  expect(
    story(<HintNote icon={UserPlus} tone="spark" text="Позвать участников можно сразу" />),
  ).toContain('stroke="#E4FF4F"');
  expect(story(<HintNote icon={ImageIcon} text="Доступ ограничен" />)).not.toContain(
    'stroke="#E4FF4F"',
  );
});

test('the two connection banners are two banners, and only one of them can be put away', () => {
  allDifferent({
    offline: (
      <Banner text="Нет связи с сервером. Показываем то, что уже загружено.">
        <IconButton icon={ImageIcon} label="Скрыть сообщение" size={32} />
      </Banner>
    ),
    online: <Banner tone="done" text="Соединение установлено" />,
  });

  // The `done` one leaves by itself after three seconds, so a button on it is a button nobody
  // reaches — it is dropped even when a caller hands one over.
  const online = story(
    <Banner tone="done" text="Соединение установлено">
      <IconButton icon={ImageIcon} label="Скрыть сообщение" size={32} />
    </Banner>,
  );
  expect(online).not.toContain('aria-label="Скрыть сообщение"');
  expect(online).toContain('Соединение установлено');
});

test('a banner says it is a banner, and the offline one is read in the dangerous voice', () => {
  const offline = story(<Banner text="Нет связи с сервером" />);
  expect(offline).toContain('role="alert"');
  // #FF8D8D on the glyph — dangerous read as a colour that can actually be read.
  expect(offline).toContain('stroke="#FF8D8D"');
});
