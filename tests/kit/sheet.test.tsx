import { rule } from '@tests/helpers/css';
import { beforeAll, expect, test, vi } from 'vitest';

import { Button } from '@/kit/button';
import { SCRIM_DEAF_MS, Sheet, type SheetProps, useScrimTap } from '@/kit/sheet';
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
      <Sheet
        visible
        onCancel={() => {}}
        title="Сортировка"
        footer={<Button variant="primary" label="Готово" />}
      >
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
      <Sheet
        visible
        onCancel={() => {}}
        footer={<Button variant="secondary" size="md" label="Закрыть" />}
      >
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
      <Sheet
        visible
        onCancel={() => {}}
        head={<Text role="sheetTitleSm">Фото Марка Ковалёва</Text>}
      />
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

const drawn = ({
  height,
  rhythm,
  scroll,
  lines = 1,
}: Pick<SheetProps, 'height' | 'rhythm' | 'scroll'> & { lines?: number } = {}) =>
  story(
    <Sheet
      visible
      onCancel={() => {}}
      title="Сортировка"
      height={height}
      rhythm={rhythm}
      scroll={scroll}
      footer={
        <>
          <Button variant="primary" label="Готово" />
          <Button variant="quiet" label="Позже" />
        </>
      }
    >
      {Array.from({ length: lines }, (_, at) => (
        <Text key={at}>{`Строка ${at + 1}`}</Text>
      ))}
    </Sheet>,
  );

/** The sheet itself: the one element that carries the rhythm, and the floor when it has one. */
const sheetStyle = (markup: string) => /style="(gap:[^"]*padding-bottom:[^"]*)"/.exec(markup)?.[1];

test('one gap runs down the whole sheet — 18 on a question, 20 on the tuning sheets, 14 on a list', () => {
  // Spec 8: `SheetConfirm*`, `SheetAskAll`, `SheetTooLittle` stand 18 apart, `SheetSort` and
  // `SheetFilter` 20, `SheetFrameInfo` 14 — between the handle and the first block too, which is why
  // the handle keeps no margin of its own.
  expect(sheetStyle(drawn())).toMatch(/^gap:18px;/);
  expect(sheetStyle(drawn({ rhythm: 'tuning' }))).toMatch(/^gap:20px;/);
  expect(sheetStyle(drawn({ rhythm: 'list' }))).toMatch(/^gap:14px;/);
  expect(drawn()).toMatch(/class="[^"]*r-width-[a-z0-9]+" data-testid="sheet-handle"/);
  expect(drawn()).not.toMatch(/r-margin[A-Za-z]*-[a-z0-9]+[^"]*" data-testid="sheet-handle"/);
  // A body that scrolls keeps the same rhythm inside it.
  expect(drawn({ scroll: true, rhythm: 'tuning' })).toContain(
    '<div class="css-view-g5y9jx" style="gap:20px">',
  );
});

test('the buttons at the foot stand 8 apart, under a spacer that takes a gap on either side', () => {
  const sheet = drawn();
  // Spec 7.1, detail 8: 8 between «Удалить» and «Оставить», «Больше ничего» and «Ещё будет».
  expect(sheet).toContain(`<div class="css-view-g5y9jx ${rule('gap:8px')}"><button`);
  // The spacer stands right over the buttons whether or not the sheet has a floor to fill: it is a
  // block of the column, so the buttons are never nearer the last block than two gaps — the measure
  // spec 4 took `SheetSort` 381 and `SheetConfirmMemory` 434 by.
  const spacer = `<div class="css-view-g5y9jx ${rule('flex-grow:1')}"></div><div class="css-view-g5y9jx ${rule('gap:8px')}">`;
  expect(sheet).toContain(spacer);
  expect(drawn({ height: 381 })).toContain(spacer);
  // Nothing to push down, nothing to push it with.
  expect(story(<Sheet visible onCancel={() => {}} title="Сведения" />)).not.toContain(
    rule('flex-grow:1'),
  );
});

test('the drawn height is a floor: a sheet holding more grows, and the handle, heading and buttons never give', () => {
  // Spec 4 and detail 7 `[правлено]`: `min-height` and never `height` — the layout's own
  // `SheetSort` at a fixed 380 squeezed its handle to 3.94 and «Готово» to 55.06.
  for (const markup of [drawn({ height: 381 }), drawn({ height: 381, lines: 40 })]) {
    expect(sheetStyle(markup)).toContain('min-height:381px');
    expect(markup).not.toMatch(/[^-]height:\s*381px/);
    expect(markup).toContain('data-testid="sheet-handle"');
    expect(markup).toContain('Сортировка');
    expect(markup).toContain('min-height:56px');
  }
  expect(drawn({ height: 381, lines: 40 })).toContain('Строка 40');
  // No floor, no `min-height` of the sheet's own: it is as tall as what it holds.
  expect(sheetStyle(drawn())).not.toContain('min-height');
});

test('a long body scrolls under the handle and the heading, over the buttons', () => {
  // Spec 7.1 `[дописано]`: past the top of the screen the content scrolls inside, and the handle,
  // the heading and the main button stay where they are — so the heading is not in the scroll.
  const sheet = drawn({ scroll: true, lines: 40 });
  const scroller = sheet.indexOf('r-overflowY-');
  expect(sheet.indexOf('data-testid="sheet-handle"')).toBeLessThan(scroller);
  expect(sheet.indexOf('Сортировка')).toBeLessThan(scroller);
  expect(sheet.indexOf('Строка 1<')).toBeGreaterThan(scroller);
  expect(sheet.indexOf('aria-label="Готово"')).toBeGreaterThan(sheet.indexOf('Строка 40<'));
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
