import { rule } from '@tests/helpers/css';
import { ImageIcon, Unlink, UserPlus } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { Button, IconButton } from '@/kit/button';
import { Banner, CardMessage, HintNote } from '@/kit/card';
import { allDifferent, story } from '@/kit/story';
import { font, setTheme, space, type } from '@/theme';

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

test('the banners are drawn to the layout’s measure: 62 for two lines of the lost one, 50 for the back one', () => {
  // TASK-383. `HomeOffline.json` e4/e6: 358 × 62 — a 1 edge, 12 above and below two lines of 13 / 18
  // at 500 (e6 h36), the cross 12 off the right edge (e7 x329 w32). `HomeOnline.json` e4/e7: 358 × 50
  // — 13 above and below the 22 circle, the words 13 / 18 at 600. At the old 13 / 16 and 12 all
  // round they were 58 and 48, the cross 4 further in.
  const offline = story(
    <Banner text="Нет связи с сервером. Показываем то, что уже загружено.">
      <IconButton icon={ImageIcon} label="Скрыть сообщение" size={32} />
    </Banner>,
  );
  const online = story(<Banner tone="done" text="Соединение установлено" />);
  expect([type.banner.fontSize, type.banner.lineHeight]).toEqual([13, 18]);
  expect(type.banner.fontFamily).toBe(font.medium);
  for (const banner of [offline, online]) {
    expect(banner).toContain(rule('line-height:18px'));
    expect(banner).toContain(rule(`padding-left:${space.s4}px`));
  }
  expect(offline).toContain(rule('padding-bottom:12px;padding-top:12px'));
  expect(offline).toContain(rule('padding-right:12px'));
  expect(online).toContain(rule('padding-bottom:13px;padding-top:13px'));
  // «Соединение установлено» is the one said at 600; the note under it stays 13 / 19 (spec 7.6,
  // detail 46), so the banner is a role of its own and not a changed note.
  expect(online).toContain(rule(`font-family:${font.semi}`));
  expect(offline).not.toContain(rule(`font-family:${font.semi}`));
  expect(type.note.lineHeight).toBe(19);
});

test('an error banner that is not about the connection draws its own glyph, in the same voice', () => {
  allDifferent({
    offline: <Banner text="Вас больше нет в этом воспоминании." />,
    gone: <Banner icon={Unlink} text="Вас больше нет в этом воспоминании." />,
  });
  expect(story(<Banner icon={Unlink} text="Вас больше нет" />)).toContain('stroke="#FF8D8D"');
});

test('a banner says it is a banner, and the offline one is read in the dangerous voice', () => {
  const offline = story(<Banner text="Нет связи с сервером" />);
  expect(offline).toContain('role="alert"');
  // #FF8D8D on the glyph — dangerous read as a colour that can actually be read.
  expect(offline).toContain('stroke="#FF8D8D"');
});
