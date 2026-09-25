import { rule } from '@tests/helpers/css';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { ScrollView } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { expect, test, vi } from 'vitest';

import { Button } from '@/kit/button';
import { pinnable, SCRIM_DEAF_MS, Sheet, type SheetProps, useScrimTap } from '@/kit/sheet';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';

/** Spec 7.1 — the sheet, and the five bottom blocks that are its five kinds. */

mountsTrees();

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

test('the handle is 40 wide and 4 tall, on every kind of sheet', () => {
  // Spec 4 (`[правлено]`): «Ручка 40 × 4» — the layout's own files squeezed it to 3.94 and to nothing.
  const handle = (markup: string) =>
    /class="([^"]*)" data-testid="sheet-handle"/.exec(markup)?.[1] ?? '';
  for (const markup of [
    story(<Sheet visible onCancel={() => {}} title="Фильтры" />),
    story(<Sheet visible onCancel={() => {}} title="Фильтры" height={560} rhythm="tuning" />),
    story(<Sheet visible onCancel={() => {}} head={<Text>Кадр</Text>} rhythm="list" />),
  ]) {
    expect(handle(markup)).toContain(rule('width:40px'));
    expect(handle(markup)).toContain(rule('height:4px'));
  }
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

test('a header row replaces the heading outright', () => {
  allDifferent({
    plain: <Sheet visible onCancel={() => {}} title="Фильтры" />,
    head: (
      <Sheet
        visible
        onCancel={() => {}}
        head={<Text role="sheetTitleSm">Фото Марка Ковалёва</Text>}
      />
    ),
  });
});

const drawn = ({
  height,
  rhythm,
  lines = 1,
}: Pick<SheetProps, 'height' | 'rhythm'> & { lines?: number } = {}) =>
  story(
    <Sheet
      visible
      onCancel={() => {}}
      title="Сортировка"
      height={height}
      rhythm={rhythm}
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
  // The body scrolls, and keeps the same rhythm inside the scroll.
  expect(drawn({ rhythm: 'tuning' })).toContain('<div class="css-view-g5y9jx" style="gap:20px">');
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
  const sheet = drawn({ lines: 40 });
  const scroller = sheet.indexOf('r-overflowY-');
  expect(sheet.indexOf('data-testid="sheet-handle"')).toBeLessThan(scroller);
  expect(sheet.indexOf('Сортировка')).toBeLessThan(scroller);
  expect(sheet.indexOf('Строка 1<')).toBeGreaterThan(scroller);
  expect(sheet.indexOf('aria-label="Готово"')).toBeGreaterThan(sheet.indexOf('Строка 40<'));
});

test('every kind of sheet holds its body in a scroll, under a ceiling of nine tenths of the window', () => {
  // TASK-358: a sheet whose body could not scroll left its buttons under the edge of a small phone
  // at the largest system type, with no way to reach them. There is no sheet without the scroll now
  // — no prop to leave it out — so this walks every shape a sheet comes in.
  const body = <Text>Тело листа</Text>;
  const buttons = (
    <>
      <Button variant="danger" label="Удалить" />
      <Button variant="secondary" size="md" label="Оставить" />
    </>
  );
  for (const markup of [
    story(
      <Sheet visible onCancel={() => {}} title="Сортировка" footer={buttons}>
        {body}
      </Sheet>,
    ),
    story(
      <Sheet visible onCancel={() => {}} head={<Text>Кадр</Text>} footer={buttons} height={380}>
        {body}
      </Sheet>,
    ),
    story(
      <Sheet visible onCancel={() => {}} title="Фильтры" height={560} rhythm="tuning">
        {body}
      </Sheet>,
    ),
    story(
      <Sheet visible onCancel={() => {}} rhythm="list">
        {body}
      </Sheet>,
    ),
  ]) {
    const scroller = markup.indexOf('r-overflowY-');
    expect(scroller).toBeGreaterThan(markup.indexOf('data-testid="sheet-handle"'));
    expect(markup.indexOf('Тело листа')).toBeGreaterThan(scroller);
    expect(markup).toContain(rule('max-height:90%'));
  }
});

test('the heading and the buttons stay put while they, the handle and a line of the body fit', () => {
  // The sort sheet as drawn, 381 on a 390 × 844 phone at the default type: all of it stands still.
  expect(pinnable({ sheet: 381, line: 23, gap: 20, bottom: 34, top: 26, foot: 56 })).toBe(true);
  // A memory's confirmation on the smallest phone the app installs on (375 × 667) at the largest
  // type iOS offers (× 3.571), the sheet at its ceiling of 600: the heading and the two buttons
  // alone overrun it.
  expect(pinnable({ sheet: 600, line: 23 * 3.571, gap: 18, bottom: 30, top: 520, foot: 190 })).toBe(
    false,
  );
  // The edge, counted: 2 + 12 of the sheet's own, then handle 4, heading 100, a line 23, spacer,
  // buttons, four gaps of 18 and the 30 under them — 360 in a sheet of 360 still fits.
  expect(pinnable({ sheet: 360, line: 23, gap: 18, bottom: 30, top: 100, foot: 117 })).toBe(true);
  expect(pinnable({ sheet: 360, line: 23, gap: 18, bottom: 30, top: 100, foot: 118 })).toBe(false);
  // No heading and no buttons — the journal's file — leave nothing to pin but the handle.
  expect(pinnable({ sheet: 150, line: 82, gap: 14, bottom: 30, top: null, foot: null })).toBe(true);
});

/** What the phone reports once it has laid a view out. */
const laidOut = (node: ReactTestInstance, height: number) =>
  act(() => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 375, height } } }));

test('when they do not fit, the heading and the buttons scroll with the body and the handle stays', async () => {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <Sheet
          visible
          onCancel={() => {}}
          title="Удалить воспоминание?"
          footer={
            <>
              <Button variant="danger" label="Удалить навсегда" />
              <Button variant="secondary" size="md" label="Оставить" />
            </>
          }
        >
          <Text>Оно исчезнет у всех</Text>
        </Sheet>,
      ),
    );
  });
  const root = (tree as TestRenderer.ReactTestRenderer).root;
  const scroll = () => root.findByType(ScrollView);
  const inScroll = (words: string) => scroll().findAll((node) => node.props.children === words);
  // The block the sheet measures around a node: the nearest one it listens to the layout of.
  const block = (node: ReactTestInstance) => {
    let up = node.parent;
    while (up && typeof up.props.onLayout !== 'function') up = up.parent;
    return up as ReactTestInstance;
  };
  const heading = () =>
    block(
      root.find((node) => node.type === Text && node.props.children === 'Удалить воспоминание?'),
    );
  const buttons = () => block(root.findAllByType(Button)[0]);
  const [sheet] = root.findAll(
    (node) =>
      node.props.accessibilityViewIsModal === true && typeof node.props.onLayout === 'function',
  );

  // Until the sheet is laid out, and wherever it fits, it stands as drawn.
  expect(inScroll('Оно исчезнет у всех')).not.toHaveLength(0);
  expect(inScroll('Удалить воспоминание?')).toHaveLength(0);
  await laidOut(sheet, 400);
  await laidOut(heading(), 60);
  await laidOut(buttons(), 120);
  expect(inScroll('Удалить воспоминание?')).toHaveLength(0);
  expect(scroll().findAllByType(Button)).toHaveLength(0);

  // The largest type: the heading and the buttons alone are taller than the sheet at its ceiling.
  await laidOut(heading(), 600);
  await laidOut(buttons(), 200);
  await laidOut(sheet, 760);
  expect(inScroll('Удалить воспоминание?')).not.toHaveLength(0);
  expect(scroll().findAllByType(Button)).toHaveLength(2);
  expect(scroll().findAll((node) => node.props.testID === 'sheet-handle')).toHaveLength(0);
  expect(root.findAll((node) => node.props.testID === 'sheet-handle')).not.toHaveLength(0);
  // A button in the scroll — these, or the nick form's own — is pressed by the first tap with the
  // keyboard up; without this that tap only puts the keyboard away.
  expect(scroll().props.keyboardShouldPersistTaps).toBe('handled');
});

/**
 * Every sheet the app raises, found by sweeping the sources rather than named one by one: a sheet
 * that is the kit's scrolls (above), so the one to catch is a sheet that is not — a `Modal` of its
 * own with a column of buttons in it, which scrolls only if its author remembered to.
 */
const sources = Object.entries(
  import.meta.glob<string>('@/{app,screens,kit}/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).map(([path, source]) => [path.replace(/^.*\/src\//, ''), source] as const);

test('every sheet in the app is the kit’s sheet, and no other modal is one', () => {
  // The only other modals are not sheets: the whole-screen frame, film and phone-gallery views, and
  // the glass menu that drops from «⋯». A new one here is a sheet built past the kit.
  // One entry per `<Modal`, so a second one beside a file's first is a new entry too.
  expect(
    sources.flatMap(([path, source]) => source.match(/<Modal\b/g)?.map(() => path) ?? []).sort(),
  ).toEqual([
    'app/memory/[id]/upload.tsx',
    'kit/menu.tsx',
    'kit/sheet.tsx',
    'screens/memory/film-player.tsx',
    'screens/memory/frame-viewer.tsx',
  ]);
  const raising = sources.filter(([, source]) => /<(Sheet|ConfirmSheet)\b/.test(source));
  // Confirmations, sort, filter, frame info, labels, a new label, the invite, the cover, the
  // journal's file, «Это всё?», «Материала мало», what the pass dropped, the agreement, the nick.
  expect(raising.length).toBeGreaterThanOrEqual(14);
  for (const [path, source] of raising) {
    expect(source, path).toMatch(
      /import \{[^}]*\b(Sheet|ConfirmSheet)\b[^}]*\} from '(@\/kit|\.\/sheet)'/,
    );
  }
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
