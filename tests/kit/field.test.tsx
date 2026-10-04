import { rule, shorthand } from '@tests/helpers/css';
import { fontFile, naturalLine } from '@tests/helpers/font';
import { Pencil, Search } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';
import { IconButton } from '@/kit/button';
import { AreaRoom, CodeField, Field, type FieldVariant, Hint, TextArea } from '@/kit/field';
import { allDifferent, compiled, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { font, setTheme, type } from '@/theme';

/** Spec 7.3 — every field of the layout, in every state it can be in. */

beforeAll(async () => {
  await setTheme('dark');
});

const VARIANTS: FieldVariant[] = [
  'name',
  'email',
  'username',
  'handle',
  'search',
  'labelName',
  'wish',
  'comment',
];

test('the eight fields differ by height and by the face they are typed in', () => {
  allDifferent(
    Object.fromEntries(
      VARIANTS.map((variant) => [variant, <Field label="Название" variant={variant} value="" />]),
    ),
  );
  // The memory's name is typed in the face it will be printed in on its cover — which is the one
  // difference between these two that is not a number.
  expect(type.subtitleDisplay.fontFamily).toMatch(/^Unbounded/);
  expect(type.subtitle.fontFamily).toMatch(/^Onest/);
});

test('the memory’s name is 56 tall and 18 round, and the e-mail is 60 and 20', () => {
  // Spec 7.3, «Название 56 / 18» and «Почта 60 / 20», and `Create` draws the first with an 18 radius.
  expect(story(<Field label="Название" variant="name" value="" />)).toContain(
    'border-top-left-radius:18px',
  );
  expect(story(<Field label="Почта" variant="email" value="" />)).toContain(
    'border-top-left-radius:20px',
  );
  expect(story(<Field label="Поиск" variant="search" value="" />)).toContain(
    'border-top-left-radius:16px',
  );
});

test('what is typed is set at the layout’s sizes, and the magnifier is 18 at 1.9, 15 from the edge', () => {
  // Spec 7.3, detail 12 and 10.11: the address 17 / 500 (`LoginEmail.json` e10), the handle in
  // `SheetInvite` and the search 16 / 500 (e5…e6, `Contacts.json` e8…e9) — they were 600 and 400.
  // The magnifier: 18 at 1.9, 15 in from the box, the `@` and the words 10 after it (e7…e9).
  const input = (variant: FieldVariant) =>
    /<input[^>]*style="([^"]*)"/.exec(
      story(<Field label="Поле" variant={variant} value="" />),
    )?.[1];
  expect(input('email')).toContain(`font-family:${font.medium}`);
  expect(input('email')).toContain('font-size:17px');
  for (const variant of ['handle', 'search'] as const) {
    expect(input(variant), variant).toContain(`font-family:${font.medium}`);
    expect(input(variant), variant).toContain('font-size:16px');
  }
  const search = story(
    <Field label="Поиск" labelHidden variant="search" icon={Search} prefix="@" value="" />,
  );
  expect(search).toContain('<svg data-glyph="Search" width="18"');
  expect(search).toContain('stroke-width="1.9"');
  expect(search).toContain(rule('padding-left:14px'));
  expect(search).toContain(rule('gap:10px'));
});

test('the long-text box keeps 16 over and under its words and 18 beside them, on a line of 24', () => {
  // Spec 7.3, detail 14 and 10.11 (answer 7): «textarea — поля 16 сверху и снизу, 18 по бокам,
  // интерлиньяж 24» — `MontageStory.json` e15, Onest 16 / 400 / 24; it was 16 all round on 23.
  const box = story(<TextArea label="История" value="" onChangeText={() => {}} />);
  expect(box).toContain(rule('line-height:24px'));
  expect(box).toContain(rule('padding-left:18px;padding-right:18px'));
  expect(box).toContain(rule('padding-bottom:16px;padding-top:16px'));
});

test('the long-text box is 280 tall, and no taller than what the board says the keyboard left of the body', () => {
  // TASK-401: the box scrolls inside itself and keeps its caret in its own frame, so a box taller
  // than the body's sight kept the caret behind the keyboard on the smallest phone at large type.
  const area = <TextArea label="История" value="" onChangeText={() => {}} />;
  expect(story(area)).toContain('height:280px');
  expect(story(<AreaRoom.Provider value={205}>{area}</AreaRoom.Provider>)).toContain(
    'height:205px',
  );
  expect(story(<AreaRoom.Provider value={400}>{area}</AreaRoom.Provider>)).toContain(
    'height:280px',
  );
});

test('the label’s colour square in its field carries the night’s dark glyph in daylight too', async () => {
  await setTheme('light');
  const field = story(<Field label="Имя" variant="labelName" swatch="#FFB547" value="" />);
  expect(field).toContain('stroke="#0B0B12"');
  expect(field).not.toContain('stroke="#F2EFE7"');
  await setTheme('dark');
});

test('every state of a field is its own state, and none of them is the placeholder', () => {
  allDifferent({
    empty: <Field label="Ник" value="" placeholder="ваш-ник" />,
    filled: <Field label="Ник" value="liza" />,
    ok: <Field label="Ник" value="liza" state="ok" hint="Ник свободен." />,
    error: <Field label="Ник" value="liza" state="error" hint="Такой ник уже занят" />,
    off: <Field label="Ник" value="liza" editable={false} />,
  });
});

test('a field inside a sheet stands on ink, because the sheet under it is already surface', () => {
  // Spec 7.3, the same answer the segments there give: #0B0B12 in a sheet, #16161F on a screen.
  const inSheet = story(<Field label="Ник" variant="handle" prefix="@" value="" onSurface />);
  expect(inSheet).toContain('background-color:rgba(11,11,18,1.00)');
  expect(story(<Field label="Ник" variant="handle" prefix="@" value="" />)).toContain(
    'background-color:rgba(22,22,31,1.00)',
  );
  // Unavailable still wins over the place it stands in: `raise` and nothing else (#22222E).
  expect(
    story(<Field label="Ник" variant="handle" value="" onSurface editable={false} />),
  ).toContain('background-color:rgba(34,34,46,1.00)');
});

test('an error says what is wrong and what to do, and keeps saying it while it is fixed', () => {
  const wrong = story(
    <Field label="Ник" value="liza" state="error" hint="Такой ник уже занят — придумайте другой" />,
  );
  expect(wrong).toContain('Такой ник уже занят — придумайте другой');
  // #FF8D8D on the border: the answer stands above the focus, so the border stays the error's
  // while the field is being corrected.
  expect(wrong).toContain('rgba(255,141,141,1.00)');
});

test('a name the server has approved is ringed in spark and carries the tick', () => {
  const ok = story(<Field label="Ник" value="liza" state="ok" hint="Ник свободен." />);
  // #E4FF4F on the border, and the 22 circle inside the field.
  expect(ok).toContain('rgba(228,255,79,1.00)');
  expect(ok).toContain('data-glyph');
});

test('an unavailable field is raise and faint, and is still readable', () => {
  const off = story(<Field label="Почта" value="liza@example.com" editable={false} />);
  expect(off).toContain('rgba(34,34,46,1.00)');
  expect(off).toContain('rgba(110,107,125,1.00)');
});

test('a label hidden from the eye is still the field’s name to a screen reader', () => {
  const shown = story(<Field label="Ник" value="" />);
  const hidden = story(<Field label="Ник" value="" labelHidden />);
  expect(shown).toContain('НИК');
  expect(hidden).not.toContain('НИК');
  expect(hidden).toContain('aria-label="Ник"');
});

test('the search field carries its magnifier and its @, and neither is typed', () => {
  const search = story(
    <Field label="Ник" labelHidden variant="search" icon={Search} prefix="@" value="mari" />,
  );
  expect(search).toContain('data-glyph');
  expect(search).toContain('@');
});

test('a label’s name is typed behind its own colour, and wears the accent before the caret arrives', () => {
  const label = story(
    <Field label="Название" variant="labelName" swatch="#FF7A9C" value="Для бабушки" onSurface />,
  );
  // The square is the colour being picked, drawn where it will be seen: #FF7A9C with a tag in it.
  expect(label).toContain('rgba(255,122,156,1.00)');
  expect(label).toContain('data-glyph');
  // Spec 7.3: the accent border stands whether or not the field is focused — the sheet was opened
  // to type in this one box.
  expect(label).toContain('rgba(75,91,255,1.00)');
  expect(story(<Field label="Почта" value="" />)).not.toContain('rgba(75,91,255,1.00)');
});

test('a track’s wish is the one field that lives inside another block', () => {
  const wish = story(
    <Field
      label="Как использовать «Тёплая»"
      labelHidden
      variant="wish"
      icon={Pencil}
      value=""
      placeholder="Как использовать «Тёплая»"
    />,
  );
  // On `ink` without being told: it unfolds under a row of «Выбрано», which is already a surface.
  expect(wish).toContain('background-color:rgba(11,11,18,1.00)');
  expect(wish).toContain('min-height:44px');
  // No visible label, and still a name to a screen reader — a placeholder is not a label.
  expect(wish).not.toContain('КАК ИСПОЛЬЗОВАТЬ «ТЁПЛАЯ»');
  expect(wish).toContain('aria-label="Как использовать «Тёплая»"');
});

test('the code is one value behind six boxes, not six values', () => {
  const half = story(<CodeField label="Код из письма" value="1234" onChangeText={() => {}} />);
  expect(half).toContain('aria-label="Код из письма"');
  // Four filled, two empty — the same field in two states.
  allDifferent({
    empty: <CodeField label="Код" value="" onChangeText={() => {}} />,
    half: <CodeField label="Код" value="1234" onChangeText={() => {}} />,
    full: <CodeField label="Код" value="123456" onChangeText={() => {}} />,
    error: <CodeField label="КОД НЕ ПОДОШЁЛ" value="" onChangeText={() => {}} state="error" />,
  });
  // All six take the error at once, because a code is one value: #FF8D8D.
  expect(story(<CodeField label="Код" value="" onChangeText={() => {}} state="error" />)).toContain(
    'rgba(255,141,141,1.00)',
  );
});

test('the long-text box holds the limit silently and counts nothing out loud', () => {
  const room = story(
    <TextArea label="История" limit={1800} value={'а'.repeat(100)} onChangeText={() => {}} />,
  );
  // Spec 7.3: no counter under it. A story told to a director is not a form with a quota, and the
  // limit is the api's business — `maxLength` still holds it.
  expect(room).not.toContain('>100<');
  expect(room).toContain('maxLength="1800"');
  // And the box wears the accent border at rest, not only under the caret.
  expect(room).toContain('rgba(75,91,255,1.00)');
});

test('the long-text box says it is full in the same red every other field does', () => {
  // Nothing counts down to the limit, so the border is the one place the story can answer that it
  // has had enough — #FF8D8D on the border, exactly as a field in error wears it.
  expect(
    story(<TextArea label="История" state="error" value="" onChangeText={() => {}} />),
  ).toContain('rgba(255,141,141,1.00)');
  // And a story with room left keeps the accent, so the red means one thing only.
  expect(story(<TextArea label="История" value="" onChangeText={() => {}} />)).not.toContain(
    'rgba(255,141,141,1.00)',
  );
});

test('the long-text box carries a line saying what it is for, never how full it is', () => {
  const noted = story(
    <TextArea label="История" hint="Своими словами" value="" onChangeText={() => {}} />,
  );
  expect(noted).toContain('Своими словами');
  expect(noted).not.toBe(story(<TextArea label="История" value="" onChangeText={() => {}} />));
});

/** The class list of the element that holds exactly these words. */
const classOf = (markup: string, words: string) =>
  markup.match(new RegExp(`class="([^"]*)"[^>]*>${words}<`))?.[1] ?? '';

test('every label over a field reads in muted, as every eyebrow of the layout does', () => {
  // #A4A1B2 in the layout (TASK-378: `LoginEmail.json` e9, `LoginCode.json` e9, `Username.json` e8,
  // `Create.json`), never the paper of what is typed under it.
  const muted = rule('color:rgba(164,161,178,1.00)');
  const labels: [string, string][] = [
    ['ПОЧТА', story(<Field label="Почта" value="" />)],
    ['НИК', story(<Field label="Ник" variant="username" prefix="@" value="" />)],
    ['НАЗВАНИЕ', story(<Field label="Название" variant="name" value="" />)],
    [
      'КОД НА liza@example.com',
      story(<CodeField label="КОД НА liza@example.com" value="" onChangeText={() => {}} />),
    ],
    ['ИСТОРИЯ', story(<TextArea label="История" value="" onChangeText={() => {}} />)],
  ];
  for (const [words, markup] of labels) expect(classOf(markup, words), words).toContain(muted);
});

test('the fields of the way in stand in its column, their words 4 in from its edge', () => {
  // Spec 8, measured off `LoginEmail`, `LoginCode` and `Username` (TASK-378): the label 4 in from the
  // box's edge (x 20 against the box's 16); what is typed starts 18 inside the box, and the `@`
  // stands 4 before the name (x 35 and 58.7). With a line under the box — the name on the account's
  // sheet — label, box and line are 12 apart, the line 4 in as well. `Create` and the sheets keep the
  // form's own 8 and its edge.
  const [twelve, eight, four] = ['gap:12px', 'gap:8px', 'padding-left:4px'].map(rule);
  /** The field's own column is the first thing drawn. */
  const column = (markup: string) => markup.split('class="')[1] ?? '';
  const wayIn: [string, string, string][] = [
    [story(<Field label="Почта" value="" hint="Проверьте адрес" />), 'ПОЧТА', 'Проверьте адрес'],
    [
      story(<Field label="Ник" variant="username" prefix="@" value="" hint="Ник занят" />),
      'НИК',
      'Ник занят',
    ],
  ];
  for (const [markup, label, hint] of wayIn) {
    expect(column(markup), label).toContain(twelve);
    expect(classOf(markup, label), label).toContain(four);
    expect(classOf(markup, hint), hint).toContain(four);
  }
  const typed = shorthand('paddingInline', 'padding-left:18px');
  expect(wayIn[0][0]).toContain(typed);
  expect(wayIn[1][0]).toContain(typed);
  expect(wayIn[1][0]).toContain(rule('gap:4px'));

  // 27 September (detail 12, 80): the answer is a word in the label's row, the row 4 in, the box 8
  // under it — and nothing under the box, where the keyboard comes up to the button.
  const above: [string, string][] = [
    [
      story(<Field label="Почта" value="" state="error" hint="Проверьте адрес" hintAbove />),
      'ПРОВЕРЬТЕ АДРЕС',
    ],
    [
      story(
        <Field
          label="Ник"
          variant="username"
          prefix="@"
          value="liza"
          state="ok"
          hint="Свободен"
          hintAbove
        />,
      ),
      'СВОБОДЕН',
    ],
    [
      story(
        <CodeField
          label="КОД НА liza@example.com"
          value=""
          onChangeText={() => {}}
          tail={<Text>Ещё раз</Text>}
        />,
      ),
      'Ещё раз',
    ],
  ];
  for (const [markup, said] of above) {
    expect(column(markup), said).toContain(eight);
    expect(markup, said).toContain(four);
    expect(markup.indexOf(`>${said}<`), said).toBeGreaterThan(0);
    expect(markup.indexOf(`>${said}<`), said).toBeLessThan(markup.indexOf('<input'));
  }

  const form = story(<Field label="Название" variant="name" value="" hint="Как в календаре" />);
  expect(column(form)).toContain(eight);
  expect(classOf(form, 'НАЗВАНИЕ')).not.toContain(four);
  expect(form).not.toContain(typed);
});

test('the @ in front of a name is faint, and muted only where it is the one hint of what to type', () => {
  // #6E6B7D in `Username` and `SheetInvite`, #A4A1B2 in the search of `Contacts` (TASK-378).
  const [faint, muted] = ['rgba(110,107,125,1.00)', 'rgba(164,161,178,1.00)'].map((c) =>
    rule(`color:${c}`),
  );
  const at = (variant: FieldVariant) =>
    classOf(story(<Field label="Ник" variant={variant} prefix="@" value="" />), '@');
  expect(at('username')).toContain(faint);
  expect(at('handle')).toContain(faint);
  expect(at('search')).toContain(muted);
});

test('a username is typed in Unbounded 19 at −0.02em, a hair looser than a card’s name', () => {
  // `Username.json` e11: 19 / 600 Unbounded at −0.38 — the role `title` it is set in runs −0.025em
  // (−0.475), which is what it was typed at.
  const typed = story(<Field label="Ник" variant="username" prefix="@" value="liza" />);
  expect(typed).toContain('letter-spacing:-0.38px');
  expect(typed).not.toContain('letter-spacing:-0.475px');
  expect(typed).toContain(`font-family:${font.headlineSemi}`);
});

test('a free name is answered and then told what it is for, in one line that breaks like a sentence', () => {
  // Spec 8, `Username`: «Ник свободен.» in spark at 600, then «По нему вас найдут в воспоминании.»
  // in muted and plain (`Username.json` e14, e15).
  const ok = story(
    <Field
      label="Ник"
      variant="username"
      prefix="@"
      value="liza"
      state="ok"
      hint="Ник свободен."
      hintAfter="По нему вас найдут в воспоминании."
    />,
  );
  const answer = ok.match(
    /class="([^"]*)"[^>]*>Ник свободен\.<span class="([^"]*)"[^>]*>\u2002По нему вас найдут в воспоминании\.</,
  );
  expect(answer, 'the second phrase is a span inside the answer').not.toBeNull();
  const [, loud = '', quiet = ''] = answer ?? [];
  expect(loud).toContain(rule('color:rgba(228,255,79,1.00)'));
  expect(loud).toContain(rule(`font-family:${font.semi}`));
  expect(quiet).toContain(rule('color:rgba(164,161,178,1.00)'));
  expect(quiet).toContain(rule(`font-family:${font.regular}`));
  // Nothing after a name that is only being asked about.
  expect(
    story(<Field label="Ник" variant="username" value="liza" hint="Проверяем…" />),
  ).not.toContain('\u2002');
});

test('a digit of the code sits in the middle of its cell, on a line no shorter than its face’s own', () => {
  // `LoginCode` drew its digits 3 above the layout's (glyphs from 644.3 against 647.3): on a line
  // shorter than the face's own — the body's 23 — iOS cuts the line from the top. Unbounded 600 at
  // 22 runs 27.3 from ascender to descender.
  const digit = classOf(story(<CodeField label="Код" value="3" onChangeText={() => {}} />), '3');
  const own = digit.split(' ').find((name) => name.startsWith('r-lineHeight-'));
  const line = Number(compiled().match(new RegExp(`\\.${own}\\{line-height:([0-9.]+)px;\\}`))?.[1]);
  const face = fontFile('@expo-google-fonts/unbounded/600SemiBold/Unbounded_600SemiBold.ttf');
  expect(line).toBeGreaterThanOrEqual(naturalLine(face, 22));
  expect(digit).toContain(rule('font-size:22px'));
});

test('the hint under a control has the four voices it is ever said in', () => {
  allDifferent({
    muted: <Hint>Меняется сразу</Hint>,
    faint: <Hint tone="faint">Чем точнее, тем меньше сюрпризов</Hint>,
    danger: <Hint tone="danger">Такой ник уже занят</Hint>,
    spark: <Hint tone="spark">Ник свободен.</Hint>,
  });
});

test('the comment pill is 48 and pill-shaped, writes at 14, and keeps the send button in its own edge', () => {
  // `FrameInfo.html` line 47: 48 tall, round as a pill, `ink` under a `line` ring, the words 16 in
  // and the button 6 from the right — so the round sits in the curve rather than 10 off it. It is
  // the only box padded unevenly, and the only one with a control inside it.
  const pill = story(
    <Field
      label="Написать про этот кадр…"
      labelHidden
      variant="comment"
      placeholder="Написать про этот кадр…"
      value=""
      trailing={<IconButton icon={Pencil} label="Отправить" size={36} tone="paper" />}
    />,
  );
  expect(pill).toContain('border-top-left-radius:999px');
  expect(pill).toContain(rule('padding-left:16px'));
  expect(pill).toContain(rule('padding-right:6px'));
  expect(pill).toContain('min-height:48px');
  // `ink` under a `line` ring — a `surface` box on the panel's own `surface` is a field nobody can
  // see the edges of, and the drawing gives the pill its own well (line 47).
  expect(pill).toContain('background-color:rgba(11,11,18,1.00)');
  expect(pill).toContain('border-top-color:rgba(44,44,58,1.00)');
  // 14 in the running face, not the 16 every other field on a screen takes.
  const input = /<input[^>]*style="([^"]*)"/.exec(pill)?.[1];
  expect(input).toContain(`font-family:${font.regular}`);
  expect(input).toContain('font-size:14px');
  // And the button is inside the box, drawn as a round of its own.
  expect(pill).toContain('data-glyph="Pencil"');
  expect(pill).toContain('background-color:rgba(245,243,238,1.00)');
});
