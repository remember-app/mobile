import { rule } from '@tests/helpers/css';
import { Download, Share, Trash2 } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { ActionMenu } from '@/kit/menu';
import { RowAction } from '@/kit/rows';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.1, detail 9 — the action menu that falls out of the «⋯» button. */

beforeAll(async () => {
  await setTheme('dark');
});

function menu(props: { gapBefore?: number } = {}) {
  return (
    <ActionMenu visible onCancel={() => {}} top={66} {...props}>
      <RowAction icon={Share} label="Поделиться" onPress={() => {}} />
      <RowAction icon={Download} label="Сохранить на телефон" onPress={() => {}} />
      <RowAction icon={Trash2} label="Удалить из воспоминания" danger onPress={() => {}} />
    </ActionMenu>
  );
}

test('the menu stands where the button it fell out of is, and carries the rows it is given', () => {
  const open = story(menu());
  expect(open).toContain('Поделиться');
  expect(open).toContain('Сохранить на телефон');
  expect(open).toContain('Удалить из воспоминания');
  // Spec 7.1: hung under the button it fell out of, rather than raised from the bottom of the
  // screen. Where it hangs is the one thing about it that is not a fixed shape.
  expect(open).toContain('top:66px');
  expect(open).toContain('right:12px');
});

test('the darkness before the dangerous row is a cut and not a rule', () => {
  allDifferent({
    plain: menu(),
    cut: menu({ gapBefore: 2 }),
  });
  // The cut replaces the hairline rather than standing beside it: three rows, two things between
  // them either way, and only one of the two arrangements has the darkness in it.
  expect(story(menu({ gapBefore: 2 }))).not.toBe(story(menu()));
});

test('the menu is glass over a photograph in both themes, and reads the same in daylight', async () => {
  // Its glass is `rgba(30,30,40,.86)` whatever the app is in (spec 2), so a row read in the day's
  // `paper` — near black — would stand on a dark pane in a colour nobody can see. The menu holds
  // its rows in the night's ink itself; the viewer that raises it happens to hold the same pin.
  const night = story(menu());
  await setTheme('light');
  expect(story(menu())).toBe(night);
  await setTheme('dark');
});

test('the menu is 278 by its outer edge: rows of 276 inside a hairline', () => {
  // Spec 7.1, detail 9 and 10.11: «меню действий 276 → 278 по внешнему краю (строки 276)».
  const open = story(
    <ActionMenu visible onCancel={() => {}} top={66}>
      <RowAction icon={Share} label="Поделиться" onPress={() => {}} />
    </ActionMenu>,
  );
  expect(open).toContain(rule('width:278px'));
});

test('a menu nobody opened draws nothing at all', () => {
  const shut = story(
    <ActionMenu visible={false} onCancel={() => {}} top={66}>
      <RowAction icon={Share} label="Поделиться" onPress={() => {}} />
    </ActionMenu>,
  );
  expect(shut).not.toContain('Поделиться');
});
