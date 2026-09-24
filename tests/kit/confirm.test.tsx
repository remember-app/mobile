import { beforeAll, expect, test } from 'vitest';

import { ConfirmSheet } from '@/kit/confirm';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec «Пусто и необратимое» — the question that names the cost before the press. */

beforeAll(async () => {
  await setTheme('dark');
});

const base = {
  visible: true as const,
  title: 'Удалить это фото?',
  text: 'Оно уйдёт из воспоминания навсегда. В уже собранном ролике останется',
  confirmLabel: 'Удалить',
  cancelLabel: 'Оставить',
  onConfirm: () => {},
  onCancel: () => {},
};

test('the question carries the verb from its own title, never «ОК»', () => {
  const sheet = story(<ConfirmSheet {...base} />);
  expect(sheet).toContain('Удалить это фото?');
  expect(sheet).toContain('Оно уйдёт из воспоминания навсегда');
  expect(sheet).toContain('Удалить');
  expect(sheet).toContain('Оставить');
  expect(sheet).not.toContain('ОК');
});

test('the way out is the outlined button and never the quiet one', () => {
  // «Оставить» has to be as easy to hit as «Удалить»: this is the one sheet where the second button
  // is not allowed to fade into the background.
  const sheet = story(<ConfirmSheet {...base} />);
  // #CE3028 on the first, and the second is a bordered 52 rather than a bare word.
  expect(sheet).toContain('rgba(206,48,40,1.00)');
  expect(sheet).toContain('min-height:52px');
});

test('a frame, a person, a label and a bare question are four headers', () => {
  allDifferent({
    bare: <ConfirmSheet {...base} />,
    frame: (
      <ConfirmSheet
        {...base}
        thumb="https://bucket.example/a.jpg"
        meta="Марк Ковалёв · 13 сентября"
      />
    ),
    person: (
      <ConfirmSheet
        {...base}
        title="Убрать Аню Петрову?"
        who="Аня Петрова"
        meta="@anya.p · принесла 54 кадра"
      />
    ),
    // Spec 10.8.1 — a label has no picture of its own: the 64 square of its colour stands in for one.
    label: <ConfirmSheet {...base} title="Удалить лейбл «Лучшее»?" tint="#FFB547" />,
  });
  expect(story(<ConfirmSheet {...base} who="Аня Петрова" />)).toContain('АП');
  const label = story(<ConfirmSheet {...base} title="Удалить лейбл «Лучшее»?" tint="#FFB547" />);
  expect(label).toContain('background-color:rgba(255,181,71,1.00)');
  expect(label).toContain('width:64px');
});

test('the price is a number on a plate of its own, said before the press', () => {
  const withPrice = story(
    <ConfirmSheet
      {...base}
      title="Убрать Аню Петрову?"
      who="Аня Петрова"
      price="54 кадра исчезнут из воспоминания"
    />,
  );
  expect(withPrice).toContain('54 кадра исчезнут из воспоминания');
  // #FF8D8D on the warning glyph beside it — the same dangerous voice as the words.
  expect(withPrice).toContain('stroke="#FF8D8D"');
  expect(story(<ConfirmSheet {...base} />)).not.toContain('stroke="#FF8D8D"');
});

test('the gentle kind asks about what costs nothing, and never in red', () => {
  // Spec 7.1, detail 8 `[дорисовано]` — leaving an account, walking away from unsaved edits: no
  // thumbnail, no avatar, a paper button and a quiet way out. The red never appears here, or it
  // stops meaning «навсегда» where it does.
  const gentle = story(
    <ConfirmSheet
      {...base}
      variant="gentle"
      title="Выйти из аккаунта?"
      text="Кадры останутся в воспоминаниях — их увидят все, кого вы звали."
      confirmLabel="Выйти"
      cancelLabel="Остаться"
      who="Аня Петрова"
    />,
  );
  expect(gentle).not.toContain('rgba(206,48,40,1.00)');
  // The thing at the top goes even when one is handed over: there is no object this is about.
  expect(gentle).not.toContain('АП');
  expect(gentle).toContain('Выйти из аккаунта?');
  expect(gentle).not.toBe(story(<ConfirmSheet {...base} title="Выйти из аккаунта?" />));
});
