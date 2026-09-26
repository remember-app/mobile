import { rule } from '@tests/helpers/css';
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

test('a frame, a memory, a person, a label and a bare question are five headers', () => {
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
    // `SheetConfirmMemory` — the memory's cover, by the chain it is shown by everywhere.
    memory: (
      <ConfirmSheet
        {...base}
        title="Удалить воспоминание?"
        cover={{ uri: 'https://bucket.example/cover.jpg' }}
        meta="Свадьба Лизы и Марка · 486 кадров"
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

test('a memory is asked about under its cover at 64 — the dashed one too, when it has no frames yet', () => {
  for (const cover of [
    { uri: 'https://bucket.example/cover.jpg' },
    { thumbs: ['https://b/t1'] },
    {},
  ]) {
    const sheet = story(
      <ConfirmSheet
        {...base}
        title="Удалить воспоминание?"
        cover={cover}
        meta="Свадьба Лизы и Марка · 486 кадров"
      />,
    );
    expect(sheet).toContain('width:64px');
    // The question stands beside the cover, not over the paragraph as a bare sheet's title would.
    expect(sheet).not.toBe(
      story(<ConfirmSheet {...base} title="Удалить воспоминание?" meta="Свадьба Лизы и Марка" />),
    );
  }
});

test('the line under the question is whole wherever it stands — under a memory and under a frame', () => {
  // TASK-400: under a memory it is which memory goes and how many frames with it — the price of the
  // one step nobody can take back; cut, «Свадьба Лизы и Марка · 340 кадр…» hid the price.
  expect(
    story(
      <ConfirmSheet
        {...base}
        cover={{}}
        meta="Свадьба Лизы и Марка в Карелии на берегу Онежского озера · 486 кадров"
      />,
    ),
  ).not.toContain('r-textOverflow');
  expect(
    story(
      <ConfirmSheet
        {...base}
        thumb="https://bucket.example/a.jpg"
        meta="Only the organizer can delete what somebody else brought."
      />,
    ),
  ).not.toContain('r-textOverflow');
});

test('the line under the question stands with no picture beside it — a frame whose thumbnail is not made yet', () => {
  // Decided by chief 25 September: «Удалять чужое может только организатор.» under an armful stays,
  // and the first frame of the armful may have no thumbnail yet.
  const sheet = story(
    <ConfirmSheet
      {...base}
      title="Удалить 2 кадра?"
      meta="Удалять чужое может только организатор."
    />,
  );
  expect(sheet).toContain('Удалять чужое может только организатор.');
  expect(sheet.indexOf('Удалить 2 кадра?')).toBeLessThan(sheet.indexOf('Удалять чужое'));
  expect(sheet).not.toContain('<img');
});

test('the price plate on `ink` is another plate than the red one, with the same red sign and words', () => {
  const plate = (priceOn?: 'danger' | 'ink') => (
    <ConfirmSheet
      {...base}
      title="Удалить воспоминание?"
      cover={{}}
      price="358 кадров сюда принесли другие"
      priceOn={priceOn}
    />
  );
  allDifferent({ red: plate(), ink: plate('ink') });
  expect(story(plate('ink'))).toContain('358 кадров сюда принесли другие');
  expect(story(plate('ink'))).toContain('stroke="#FF8D8D"');
});

test('while the request is in the air the dangerous button waits and «Оставить» is out', () => {
  allDifferent({
    idle: <ConfirmSheet {...base} cover={{}} />,
    busy: <ConfirmSheet {...base} cover={{}} busy />,
  });
  const busy = story(<ConfirmSheet {...base} busy />);
  expect(busy).toContain('aria-disabled="true" disabled="" aria-label="Удалить"');
  expect(busy).toContain('aria-disabled="true" disabled="" aria-label="Оставить"');
  expect(story(<ConfirmSheet {...base} />)).not.toContain('aria-disabled="true"');
});

/** The sheet's own style: its rhythm, and its floor when it has one. */
const sheetStyle = (markup: string) => /style="(gap:[^"]*padding-bottom:[^"]*)"/.exec(markup)?.[1];

test('each confirmation is as tall as the layout draws it — by what it is about', () => {
  // Spec 4, «Высоты листов»: `SheetConfirmDelete` 380 — a frame, an armful of frames, a label
  // (10.8.1) — `SheetConfirmMember` 420, `SheetConfirmMemory` 434. The screens hand over the
  // subject and nothing else; the height is the kit's.
  const floor = (props: Partial<Parameters<typeof ConfirmSheet>[0]>) =>
    /min-height:(\d+)px/.exec(sheetStyle(story(<ConfirmSheet {...base} {...props} />)) ?? '')?.[1];
  expect(floor({ thumb: 'https://bucket.example/a.jpg' })).toBe('380');
  expect(floor({})).toBe('380');
  expect(floor({ tint: '#FFB547' })).toBe('380');
  expect(floor({ who: 'Аня Петрова', price: '54 кадра исчезнут из воспоминания' })).toBe('420');
  // A viewer has no price, and the sheet is still the one drawn for a person.
  expect(floor({ who: 'Аня Петрова' })).toBe('420');
  expect(floor({ cover: {}, priceOn: 'ink', price: '358 кадров сюда принесли другие' })).toBe(
    '434',
  );
  // The gentle kind is nobody's drawing — leaving the account, unsaved edits: it fits its words.
  expect(floor({ variant: 'gentle', title: 'Выйти из аккаунта?' })).toBeUndefined();
});

test('the confirmation keeps the layout’s rhythm: 18 between blocks, 8 between the buttons', () => {
  const sheet = story(<ConfirmSheet {...base} thumb="https://bucket.example/a.jpg" />);
  expect(sheetStyle(sheet)).toMatch(/^gap:18px;/);
  expect(sheet).toContain(`<div class="css-view-g5y9jx ${rule('gap:8px')}"><button`);
  // Spec 8, every confirmation as drawn: 14 between the mark and the words, 7 between the question
  // and the line under it — and the question is the first thing after the mark, on every kind.
  for (const [what, mark] of [
    ['a frame', { thumb: 'https://bucket.example/a.jpg' }],
    ['a person', { who: 'Аня Петрова' }],
    ['a memory', { cover: {} }],
  ] as const) {
    const drawn = story(<ConfirmSheet {...base} {...mark} meta="Марк Ковалёв · 13 сентября" />);
    const head = drawn.slice(drawn.indexOf('sheet-handle'), drawn.indexOf('<h1'));
    expect(head, what).toContain(rule('gap:14px'));
    const words = /<div class="([^"]*)"><h1[^>]*>Удалить это фото\?<\/h1>/.exec(drawn);
    expect(words?.[1], what).toContain(rule('gap:7px'));
  }
  // Spec 7.1, detail 8: the paragraph is 15 / 22.
  expect(sheet).toMatch(
    new RegExp(
      `class="[^"]*${rule('font-size:15px')}[^"]*${rule('line-height:22px')}"[^>]*>Оно уйдёт`,
    ),
  );
});

/** The classes of the price plate, and of the words on it. */
const plate = (markup: string) => ({
  box: /<div class="([^"]+)"><svg data-glyph="TriangleAlert"/.exec(markup)?.[1] ?? '',
  words:
    /data-glyph="TriangleAlert"[^>]*><\/svg><div dir="auto" class="([^"]+)"/.exec(markup)?.[1] ??
    '',
});

test('the price plates stand as drawn: red 11 apart, `ink` 10 apart with 13 / 18 words, both 12 / 14 inside', () => {
  const red = plate(
    story(
      <ConfirmSheet
        {...base}
        title="Убрать Аню Петрову?"
        who="Аня Петрова"
        price="54 кадра исчезнут из воспоминания"
      />,
    ),
  );
  const ink = plate(
    story(
      <ConfirmSheet
        {...base}
        title="Удалить воспоминание?"
        cover={{}}
        price="358 кадров сюда принесли другие"
        priceOn="ink"
      />,
    ),
  );
  // `SheetConfirmMember`: 11 between the sign and the words; `SheetConfirmMemory`: 10.
  expect(red.box).toContain(rule('gap:11px'));
  expect(ink.box).toContain(rule('gap:10px'));
  for (const box of [red.box, ink.box]) {
    expect(box).toContain(rule('padding-bottom:12px;padding-top:12px'));
    expect(box).toContain(rule('padding-left:14px;padding-right:14px'));
  }
  expect(ink.words).toContain(rule('line-height:18px'));
  expect(red.words).not.toContain(rule('line-height:18px'));
});

test('a long question in English grows the sheet past its floor and squeezes nothing on it', () => {
  // Spec 10.10: the layout's own `SheetConfirmMemory` squeezed its handle to nothing once the
  // question took two lines. Here the floor is `min-height`, so however long the words run, the
  // handle, the question, the plate and both buttons are all there, in order, at their size.
  const sheet = story(
    <ConfirmSheet
      {...base}
      title="Delete this memory for everyone who was ever part of it?"
      meta="Lisa and Mark’s wedding by the lake, the whole weekend · 486 frames"
      cover={{}}
      text={'It disappears for all six people in it — frames, movies and montage logs. '.repeat(6)}
      price="358 frames here were brought by somebody else, and they go with it too"
      priceOn="ink"
      confirmLabel="Delete forever, for everyone"
      cancelLabel="Keep it"
    />,
  );
  expect(sheetStyle(sheet)).toContain('min-height:434px');
  expect(sheet).not.toMatch(/[^-]height:\s*434px/);
  const order = [
    'data-testid="sheet-handle"',
    'Delete this memory for everyone',
    'It disappears for all six',
    '358 frames here',
    rule('flex-grow:1'),
    'aria-label="Delete forever, for everyone"',
    'aria-label="Keep it"',
  ].map((part) => sheet.indexOf(part));
  expect(order.every((at) => at >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(sheet).toContain('min-height:56px');
  expect(sheet).toContain('min-height:52px');
});
