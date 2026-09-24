import { Download, Lock, Share, Trash2, Users } from 'lucide-react-native';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { Pressable, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { ChoiceCard } from '@/kit/choice';
import { DayMark } from '@/kit/daymark';
import { ActionMenu } from '@/kit/menu';
import { Palette } from '@/kit/palette';
import { RowAction } from '@/kit/rows';
import { Segment } from '@/kit/segment';
import { LengthSlider } from '@/kit/slider';
import { labelColors, themes } from '@/theme';
import { mounted, mountsTrees } from '@/test-renderer';

/**
 * What the new parts of the kit do when they are pressed. Their states are stories (`*.test.tsx`
 * beside each) and that is all a story can be: it draws and never presses. So the wiring — which
 * value a press hands over, which of a row of controls answers to being the chosen one, what is not
 * a control at all — is read here, off the tree a real render leaves, with one prop each.
 */

mountsTrees();
afterEach(() => vi.useRealTimers());

const draw = async (node: React.ReactElement) => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(node));
  });
  return tree.root;
};

test('a colour of the palette hands its own colour over, and only the chosen one is a chosen radio', async () => {
  const colors = labelColors(themes.dark);
  const names = ['жёлтый', 'розовый', 'красный', 'зелёный', 'голубой', 'фиолетовый', 'кислотный', 'серый'];
  const said: string[] = [];
  const root = await draw(<Palette colors={colors} names={names} value={colors[2]} onChange={(c) => said.push(c)} label="Цвет" />);
  const swatch = (name: string) => root.findAllByType(Pressable).find((one) => one.props.accessibilityLabel === name)!;
  await act(async () => swatch('зелёный').props.onPress());
  await act(async () => swatch('жёлтый').props.onPress());
  // Each circle says which colour it is by the colour itself — not by its place in the row.
  expect(said).toEqual([colors[3], colors[0]]);
  const chosen = names.filter((name) => swatch(name).props.accessibilityState.selected);
  expect(chosen).toEqual(['красный']);
  expect(swatch('красный').props.accessibilityState.checked).toBe(true);
  expect(swatch('серый').props.accessibilityState.checked).toBe(false);
});

test('a choice card presses once for one thing, and a read-only one is not a control', async () => {
  let pressed = 0;
  const live = await draw(<ChoiceCard icon={Users} title="Общий" note="видят все участники" selected onPress={() => pressed++} />);
  await act(async () => live.findByType(Pressable).props.onPress());
  expect(pressed).toBe(1);
  expect(live.findByType(Pressable).props['aria-checked']).toBe(true);
  const other = await draw(<ChoiceCard icon={Lock} title="Личный" onPress={() => {}} />);
  expect(other.findByType(Pressable).props['aria-checked']).toBe(false);

  // Read-only: nothing in it to press, and nothing that could be read as chosen or not.
  const fixed = await draw(<ChoiceCard icon={Users} title="Общий" readOnly onPress={() => pressed++} />);
  expect(fixed.findAllByType(Pressable)).toHaveLength(0);
  expect(fixed.findByType(View).props.accessibilityRole).toBe('text');
});

test('a seam that picks is a checkbox that says whether its day is taken, and one that does not is not a control', async () => {
  let taken = 0;
  const open = await draw(<DayMark label="13 сентября" count="61" onPress={() => taken++} pressLabel="Выбрать все 61" />);
  const band = open.findByType(Pressable);
  expect(band.props.accessibilityRole).toBe('checkbox');
  expect(band.props.accessibilityLabel).toBe('Выбрать все 61');
  expect(band.props.accessibilityState.checked).toBe(false);
  await act(async () => band.props.onPress());
  expect(taken).toBe(1);
  const full = await draw(<DayMark label="13 сентября" count="61" picked onPress={() => {}} pressLabel="Выбрать все 61" />);
  expect(full.findByType(Pressable).props.accessibilityState.checked).toBe(true);
  // A caption has nothing to press — however it was drawn.
  const caption = await draw(<DayMark label="13 сентября" count="61" picked pressLabel="Выбрать все 61" />);
  expect(caption.findAllByType(Pressable)).toHaveLength(0);
});

const menu = (onCancel: () => void, rows: (() => void)[] = []) => (
  <ActionMenu visible onCancel={onCancel} top={66} gapBefore={2}>
    <RowAction icon={Share} label="Поделиться" onPress={rows[0]} />
    <RowAction icon={Download} label="Сохранить на телефон" onPress={rows[1]} />
    <RowAction icon={Trash2} label="Удалить" danger onPress={rows[2]} />
  </ActionMenu>
);

test('a tap beside the menu shuts it, but not in the first instants after it opened', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 13, 12, 0, 0));
  let shut = 0;
  const root = await draw(menu(() => shut++));
  const scrim = () => root.findAllByType(Pressable).find((one) => one.props.accessibilityElementsHidden)!;
  // The tap that opened the menu is still coming down: it must not be the one that shuts it.
  await act(async () => scrim().props.onPress());
  expect(shut).toBe(0);
  vi.setSystemTime(new Date(2026, 8, 13, 12, 0, 1));
  await act(async () => scrim().props.onPress());
  expect(shut).toBe(1);
});

test('every row of the menu answers with its own action, in the order it was given', async () => {
  const said: string[] = [];
  const root = await draw(menu(() => {}, [() => said.push('share'), () => said.push('save'), () => said.push('delete')]));
  for (const label of ['Удалить', 'Поделиться', 'Сохранить на телефон']) {
    await act(async () => root.findAllByType(RowAction).find((one) => one.props.label === label)!.props.onPress());
  }
  expect(said).toEqual(['delete', 'share', 'save']);
});

const PRESETS = [
  { label: '0:30', value: 30 },
  { label: '1:00', value: 60 },
  { label: '1:30', value: 90 },
  { label: '3:00', value: 180 },
  { label: 'Всё', value: 550 },
];

const length = (over: Partial<React.ComponentProps<typeof LengthSlider>> = {}) => (
  <LengthSlider
    value={152}
    onChange={() => {}}
    min={10}
    max={550}
    valueLabel="2:32"
    minLabel="0:10"
    maxLabel="9:10"
    label="Длина"
    shorterLabel="Короче"
    longerLabel="Длиннее"
    presets={PRESETS}
    {...over}
  />
);

test('exactly the ready length the figure stands on is the chosen one — and none when it stands between them', async () => {
  const chosen = async (value: number, max = 550) => {
    const root = await draw(length({ value, max }));
    return PRESETS.map((preset) => preset.label).filter(
      (label) => root.findAllByType(Pressable).find((one) => one.props.accessibilityLabel === label)?.props.accessibilityState.selected,
    );
  };
  expect(await chosen(152)).toEqual([]);
  expect(await chosen(60)).toEqual(['1:00']);
  expect(await chosen(180)).toEqual(['3:00']);
  // «Всё» is the ceiling itself: chosen when the figure is at it.
  expect(await chosen(550)).toEqual(['Всё']);
});

test('a ready length hands its own seconds over, and one there is no material for is out and does not press', async () => {
  const said: number[] = [];
  const root = await draw(length({ value: 40, max: 40, valueLabel: '0:40', onChange: (s) => said.push(s), presets: [...PRESETS.slice(0, 4), { label: 'Всё', value: 40 }] }));
  const pill = (label: string) => root.findAllByType(Pressable).find((one) => one.props.accessibilityLabel === label)!;
  expect(pill('0:30').props.disabled).toBe(false);
  expect(pill('3:00').props.disabled).toBe(true);
  expect(pill('1:00').props.disabled).toBe(true);
  await act(async () => pill('0:30').props.onPress());
  await act(async () => pill('Всё').props.onPress());
  expect(said).toEqual([30, 40]);
});

test('to a screen reader the figure is a control: «increment» and «decrement» move it five seconds, and stop at the walls', async () => {
  const said: number[] = [];
  const at = async (value: number) => {
    const root = await draw(length({ value, onChange: (s) => said.push(s) }));
    return (name: string) => act(async () => root.findByProps({ accessibilityRole: 'adjustable' }).props.onAccessibilityAction({ nativeEvent: { actionName: name } }));
  };
  await (await at(152))('increment');
  await (await at(152))('decrement');
  await (await at(548))('increment');
  await (await at(12))('decrement');
  expect(said).toEqual([157, 147, 550, 10]);
});

test('a segment says which of its values is the chosen one to a screen reader, and a press hands over the value it was on', async () => {
  const said: string[] = [];
  const root = await draw(
    <Segment
      label="Порядок"
      value="oldest"
      onChange={(value) => said.push(value)}
      options={[
        { value: 'newest', label: 'Сначала новые' },
        { value: 'oldest', label: 'Сначала старые' },
      ]}
    />,
  );
  const pill = (name: string) => root.findAllByType(Pressable).find((one) => one.props.accessibilityLabel === name)!;
  expect(pill('Сначала новые').props.accessibilityState.checked).toBe(false);
  expect(pill('Сначала старые').props.accessibilityState.checked).toBe(true);
  await act(async () => pill('Сначала новые').props.onPress());
  expect(said).toEqual(['newest']);
  expect(root.findByProps({ accessibilityRole: 'radiogroup' }).props.accessibilityLabel).toBe('Порядок');
});
