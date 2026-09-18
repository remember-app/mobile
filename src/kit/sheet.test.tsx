import { beforeAll, expect, test, vi } from 'vitest';

import { Button } from '@/kit/button';
import { SCRIM_DEAF_MS, Sheet, useScrimTap } from '@/kit/sheet';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { setTheme } from '@/theme';

/** Spec 7.1 — the sheet, and the five bottom blocks that are its five kinds. */

beforeAll(async () => {
  await setTheme('dark');
});

test('a sheet that is not up draws nothing at all', () => {
  expect(story(<Sheet visible={false} onCancel={() => {}} title="Фильтры" />)).toBe('');
});

test('the handle is the first thing in a sheet, whatever the sheet is', () => {
  const sheet = story(
    <Sheet visible onCancel={() => {}} title="Фильтры">
      <Text>Кто принёс</Text>
    </Sheet>,
  );
  expect(sheet).toContain('Фильтры');
  expect(sheet).toContain('Кто принёс');
  // 40 × 4 in `handle`, above everything else the sheet carries — including a sheet with no
  // heading at all, which is where it would be easiest to leave out.
  expect(sheet.indexOf('sheet-handle')).toBeLessThan(sheet.indexOf('Фильтры'));
  expect(story(<Sheet visible onCancel={() => {}} />)).toContain('sheet-handle');
});

test('the five kinds of sheet differ only in the block at the bottom', () => {
  const body = <Text>Тело листа</Text>;
  allDifferent({
    onePrimary: (
      <Sheet visible onCancel={() => {}} title="Сортировка" footer={<Button variant="primary" label="Готово" />}>
        {body}
      </Sheet>
    ),
    primaryAndQuiet: (
      <Sheet
        visible
        onCancel={() => {}}
        title="Фильтры"
        footer={
          <>
            <Button variant="primary" label="Показать 486 кадров" />
            <Button variant="quiet" label="Сбросить фильтры" />
          </>
        }
      >
        {body}
      </Sheet>
    ),
    dangerAndOutline: (
      <Sheet
        visible
        onCancel={() => {}}
        title="Удалить это фото?"
        narrow
        footer={
          <>
            <Button variant="danger" label="Удалить" />
            <Button variant="secondary" size="md" label="Оставить" />
          </>
        }
      >
        {body}
      </Sheet>
    ),
    twoEqual: (
      <Sheet
        visible
        onCancel={() => {}}
        title="Это всё?"
        footer={
          <>
            <Button variant="paper" label="Больше ничего" />
            <Button variant="secondary" label="Ещё будет" />
          </>
        }
      >
        {body}
      </Sheet>
    ),
    oneOutline: (
      <Sheet visible onCancel={() => {}} footer={<Button variant="secondary" size="md" label="Закрыть" />}>
        {body}
      </Sheet>
    ),
  });
});

test('a confirmation’s heading is the narrower one, and a header row replaces it outright', () => {
  allDifferent({
    plain: <Sheet visible onCancel={() => {}} title="Фильтры" />,
    narrow: <Sheet visible onCancel={() => {}} title="Фильтры" narrow />,
    head: (
      <Sheet visible onCancel={() => {}} head={<Text role="sheetTitleSm">Фото Марка Ковалёва</Text>} />
    ),
  });
});

test('a long body scrolls while the heading and the bottom block stay put', () => {
  allDifferent({
    still: (
      <Sheet visible onCancel={() => {}} title="Позвать человека">
        <Text>Из контактов</Text>
      </Sheet>
    ),
    scrolling: (
      <Sheet visible onCancel={() => {}} title="Позвать человека" scroll>
        <Text>Из контактов</Text>
      </Sheet>
    ),
  });
});

/**
 * The darkness is deaf for its first moments. The second tap of a double tap on the button that
 * opened the sheet lands where that button was — which is now the darkness — and closes what has
 * only just opened, so from the outside the button reads as dead (TASK-95).
 */
test('a tap beside the sheet does nothing for the first moment, and closes it after', () => {
  vi.useFakeTimers();
  try {
    let closed = 0;
    let tap = () => {};
    // The hook holds the moment it mounted, so it has to be born inside a render to hold anything.
    function Probe() {
      tap = useScrimTap(() => {
        closed += 1;
      });
      return null;
    }
    story(<Probe />);

    tap();
    expect(closed).toBe(0);
    vi.advanceTimersByTime(SCRIM_DEAF_MS);
    tap();
    expect(closed).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});
