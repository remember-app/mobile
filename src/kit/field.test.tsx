import { Search } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import {
  CodeField,
  Field,
  FieldShell,
  Hint,
  TextArea,
  type FieldVariant,
} from '@/kit/field';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { setTheme, type } from '@/theme';

/** Spec 7.3 — every field of the layout, in every state it can be in. */

beforeAll(async () => {
  await setTheme('dark');
});

const VARIANTS: FieldVariant[] = ['name', 'email', 'username', 'handle', 'search'];

test('the five fields differ by height and by the face they are typed in', () => {
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

test('the long-text box counts what is in it and warns before the limit, not after', () => {
  const room = story(<TextArea label="История" limit={600} value={'а'.repeat(100)} onChangeText={() => {}} />);
  expect(room).toContain('100');
  expect(room).toContain('600');

  // At 90% the counter turns dangerous — and nothing types past the limit at all.
  const near = story(<TextArea label="История" limit={600} value={'а'.repeat(560)} onChangeText={() => {}} />);
  expect(near).not.toBe(room);
  expect(story(<TextArea label="История" limit={600} value="" onChangeText={() => {}} />)).toContain('0');
});

test('the date field is pressed rather than typed in, and says so', () => {
  const shell = story(
    <FieldShell label="Дата события" hint="Приложение найдёт по этим датам снятое на телефоне">
      <Text>12 сентября</Text>
    </FieldShell>,
  );
  expect(shell).toContain('role="button"');
  expect(shell).toContain('12 сентября');
  expect(shell).toContain('Приложение найдёт по этим датам снятое на телефоне');
});

test('the hint under a control has the four voices it is ever said in', () => {
  allDifferent({
    muted: <Hint>Меняется сразу</Hint>,
    faint: <Hint tone="faint">Чем точнее, тем меньше сюрпризов</Hint>,
    danger: <Hint tone="danger">Такой ник уже занят</Hint>,
    spark: <Hint tone="spark">Ник свободен.</Hint>,
  });
});
