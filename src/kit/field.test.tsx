import { Pencil, Search } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { CodeField, Field, Hint, TextArea, type FieldVariant } from '@/kit/field';
import { allDifferent, story } from '@/kit/story';
import { setTheme, type } from '@/theme';

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
];

test('the seven fields differ by height and by the face they are typed in', () => {
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
  expect(story(<Field label="Название" variant="name" value="" />)).toContain('border-top-left-radius:18px');
  expect(story(<Field label="Почта" variant="email" value="" />)).toContain('border-top-left-radius:20px');
  expect(story(<Field label="Поиск" variant="search" value="" />)).toContain('border-top-left-radius:16px');
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
  expect(story(<Field label="Ник" variant="handle" value="" onSurface editable={false} />)).toContain(
    'background-color:rgba(34,34,46,1.00)',
  );
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

test('the wish line is the one field that lives inside another block', () => {
  const wish = story(
    <Field
      label="Как использовать треки"
      labelHidden
      variant="wish"
      icon={Pencil}
      value=""
      placeholder="Спокойное начало, потом ритм"
    />,
  );
  // On `ink` without being told: it stands inside a block that is already a surface.
  expect(wish).toContain('background-color:rgba(11,11,18,1.00)');
  expect(wish).toContain('min-height:44px');
  // No visible label, and still a name to a screen reader — a placeholder is not a label.
  expect(wish).not.toContain('КАК ИСПОЛЬЗОВАТЬ ТРЕКИ');
  expect(wish).toContain('aria-label="Как использовать треки"');
});

test('the code is one value behind six boxes, not six values', () => {
  const half = story(<CodeField label="Код из письма" value="1234" onChangeText={() => {}} />);
  expect(half).toContain('aria-label="Код из письма"');
  // Four filled, two empty — the same field in two states.
  allDifferent({
    empty: <CodeField label="Код" value="" onChangeText={() => {}} />,
    half: <CodeField label="Код" value="1234" onChangeText={() => {}} />,
    full: <CodeField label="Код" value="123456" onChangeText={() => {}} />,
    error: (
      <CodeField
        label="Код"
        value=""
        onChangeText={() => {}}
        state="error"
        hint="Код не подошёл — наберите ещё раз"
      />
    ),
  });
  // All six take the error at once, because a code is one value: #FF8D8D.
  expect(
    story(<CodeField label="Код" value="" onChangeText={() => {}} state="error" />),
  ).toContain('rgba(255,141,141,1.00)');
});

test('the long-text box holds the limit silently and counts nothing out loud', () => {
  const room = story(
    <TextArea label="История" limit={600} value={'а'.repeat(100)} onChangeText={() => {}} />,
  );
  // Spec 7.3: no counter under it. A story told to a director is not a form with a quota, and the
  // limit is the api's business — `maxLength` still holds it.
  expect(room).not.toContain('>100<');
  expect(room).toContain('maxLength="600"');
  // And the box wears the accent border at rest, not only under the caret.
  expect(room).toContain('rgba(75,91,255,1.00)');
});

test('the long-text box carries a line saying what it is for, never how full it is', () => {
  const noted = story(
    <TextArea label="История" hint="Своими словами" value="" onChangeText={() => {}} />,
  );
  expect(noted).toContain('Своими словами');
  expect(noted).not.toBe(story(<TextArea label="История" value="" onChangeText={() => {}} />));
});

test('the hint under a control has the four voices it is ever said in', () => {
  allDifferent({
    muted: <Hint>Меняется сразу</Hint>,
    faint: <Hint tone="faint">Чем точнее, тем меньше сюрпризов</Hint>,
    danger: <Hint tone="danger">Такой ник уже занят</Hint>,
    spark: <Hint tone="spark">Ник свободен.</Hint>,
  });
});
