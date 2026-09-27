import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { EyeOff, Trash2 } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test, vi } from 'vitest';

import { Divider } from '@/kit/bits';
import { Spinner } from '@/kit/empty';
import { RowCard, RowDo, RowProp } from '@/kit/row-card';
import { allDifferent } from '@/kit/story';
import { Text } from '@/kit/text';
import { setTheme, themes } from '@/theme';

/** Spec 7.7, detail 77 — the card of rows in a sheet (`SheetMyFrame`). */

mountsTrees();

beforeAll(async () => {
  await setTheme('dark');
});

test('a property says its value, or «Не указано» in `muted`, and leads somewhere only when it is pressed', () => {
  allDifferent({
    set: <RowProp label="Снято" value="13 сентября, 18:42" empty="Не указано" onPress={() => {}} />,
    empty: <RowProp label="Место" empty="Не указано" onPress={() => {}} />,
    look: <RowProp label="Место" value="Москва" empty="Не указано" />,
    busy: <RowProp label="Место" value="Москва" empty="Не указано" busy onPress={() => {}} />,
  });
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(
      TestRenderer.create(<RowProp label="Место" empty="Не указано" onPress={() => {}} />),
    );
  });
  const value = tree.root.findAllByType(Text).find((one) => one.props.children === 'Не указано')!;
  expect(value.props.tone).toBe('muted');
  expect(tree.root.findByProps({ accessibilityRole: 'button' }).props.accessibilityLabel).toBe(
    'Место: Не указано',
  );
});

test('an action with a switch is a switch, and the dangerous one is red and last', () => {
  const onPress = vi.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(
      TestRenderer.create(
        <RowCard>
          <RowDo
            icon={EyeOff}
            label="Скрыть из ленты"
            note="Останется у вас, в ролик не попадёт"
            on={false}
            onPress={onPress}
          />
          <RowDo icon={Trash2} label="Удалить у всех" danger onPress={() => {}} />
        </RowCard>,
      ),
    );
  });
  const hide = tree.root.findByProps({ accessibilityRole: 'switch' });
  expect(hide.props.accessibilityState).toMatchObject({ checked: false });
  expect(hide.props.accessibilityHint).toBe('Останется у вас, в ролик не попадёт');
  act(() => hide.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  const remove = tree.root
    .findAllByType(Text)
    .find((one) => one.props.children === 'Удалить у всех')!;
  expect(StyleSheet.flatten(remove.props.style).color).toBe(themes.dark.color.dangerText);
  // A hairline between the two rows, and none over the first.
  expect(tree.root.findAllByType(Divider)).toHaveLength(1);
  allDifferent({
    off: <RowDo icon={EyeOff} label="Скрыть из ленты" on={false} onPress={() => {}} />,
    on: <RowDo icon={EyeOff} label="Скрыть из ленты" on onPress={() => {}} />,
    busy: <RowDo icon={EyeOff} label="Скрыть из ленты" on busy onPress={() => {}} />,
  });
  let busy!: TestRenderer.ReactTestRenderer;
  act(() => {
    busy = mounted(
      TestRenderer.create(<RowDo icon={EyeOff} label="Скрыть" busy on onPress={() => {}} />),
    );
  });
  expect(busy.root.findAllByType(Spinner)).toHaveLength(1);
});
