import { Pencil, Trash2 } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { IconButton } from '@/kit/button';
import { LabelMark, RowLabel } from '@/kit/label';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.7 and 10.8.1 — a label: a colour, a name, who sees it, and whether it holds this. */

const AMBER = '#FFB547';

beforeAll(async () => {
  await setTheme('dark');
});

test('the coloured square is drawn at the three sizes a label is known by', () => {
  allDifferent({
    row: <LabelMark tint={AMBER} />,
    confirm: <LabelMark tint={AMBER} size={64} />,
    chip: <LabelMark tint={AMBER} size={18} />,
  });
  expect(story(<LabelMark tint={AMBER} size={64} />)).toContain('width:64px');
  // The glyph inside it is read in `ink`: the eight label colours are all light, and this is the
  // one place the product puts dark on colour.
  expect(story(<LabelMark tint={AMBER} />)).toContain('stroke="#0B0B12"');
  // Two labels of different colours are two different marks, which is the whole point of them.
  expect(story(<LabelMark tint="#4FB3FF" />)).not.toBe(story(<LabelMark tint={AMBER} />));
});

test('a label row says whose it is and whether what is chosen is in it', () => {
  allDifferent({
    sharedOut: (
      <RowLabel tint={AMBER} name="Лучшее" count="23 кадра" scope="shared" scopeLabel="видят все" onPress={() => {}} />
    ),
    sharedIn: (
      <RowLabel tint={AMBER} name="Лучшее" count="23 кадра" scope="shared" scopeLabel="видят все" inside onPress={() => {}} />
    ),
    own: (
      <RowLabel tint="#8A7CFF" name="Любимые" count="9 кадров" scope="own" scopeLabel="только вы" onPress={() => {}} />
    ),
  });
  const row = story(
    <RowLabel tint={AMBER} name="Лучшее" count="23 кадра" scope="shared" scopeLabel="видят все" onPress={() => {}} />,
  );
  expect(row).toContain('Лучшее');
  expect(row).toContain('23 кадра');
  expect(row).toContain('видят все');
  // The whole row is the button: putting something in a box is the whole gesture, and there is no
  // second «apply» anywhere.
  expect(row).toContain('role="button"');
  expect(row).toContain('aria-label="Лучшее"');
});

test('the edit mode puts the pair of buttons where the circle was, and stops the row filing', () => {
  // Spec 10.8.1 — the sheet changes exactly one thing, and a label somebody else owns keeps none
  // of it: that row goes on filing.
  const editing = (
    <RowLabel
      tint={AMBER}
      name="Лучшее"
      count="23 кадра"
      scope="shared"
      scopeLabel="видят все"
      onPress={() => {}}
      actions={
        <>
          <IconButton size={36} icon={Pencil} label="Переименовать «Лучшее»" />
          <IconButton size={36} icon={Trash2} tone="danger" label="Удалить «Лучшее»" />
        </>
      }
    />
  );
  const filing = (
    <RowLabel tint={AMBER} name="Лучшее" count="23 кадра" scope="shared" scopeLabel="видят все" onPress={() => {}} />
  );
  allDifferent({ editing, filing });
  const markup = story(editing);
  expect(markup).toContain('Переименовать «Лучшее»');
  expect(markup).toContain('Удалить «Лучшее»');
  // The name, the colour and the meta do not move — only the right edge does.
  expect(markup).toContain('Лучшее');
  expect(markup).toContain('видят все');
  // And the row itself no longer files anything: `aria-label="Лучшее"` is the filing button.
  expect(markup).not.toContain('aria-label="Лучшее"');
});

test('a row nobody can press is not a button, and wears no circle either', () => {
  // Where the server says «нельзя класть», the row keeps the colour, the name and the meta and
  // loses the one thing that promised a press.
  const shut = story(<RowLabel tint={AMBER} name="Лучшее" scope="own" scopeLabel="только вы" />);
  expect(shut).not.toContain('role="button"');
  expect(shut).toContain('Лучшее');
  allDifferent({
    shut: <RowLabel tint={AMBER} name="Лучшее" scope="own" scopeLabel="только вы" />,
    filing: (
      <RowLabel tint={AMBER} name="Лучшее" scope="own" scopeLabel="только вы" onPress={() => {}} />
    ),
  });
});

test('the hairline belongs to the list, not to the row', () => {
  allDifferent({
    first: <RowLabel tint={AMBER} name="Лучшее" scope="own" scopeLabel="только вы" />,
    rest: <RowLabel tint={AMBER} name="Лучшее" scope="own" scopeLabel="только вы" divider />,
  });
});
