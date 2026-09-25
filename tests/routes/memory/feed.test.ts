/**
 * How the wall of frames is actually measured out, and the two sheets that tune it: the columns, the
 * top it starts at under the glass, the filter held back as a draft and the sort that takes effect
 * as it is pressed.
 *
 * Their text and not their rendered output, because this file has no renderer: every test here runs
 * pure logic, and a screen would need `react-native` transformed and `expo-router`, `expo-video` and
 * the safe area all faked before its first line ran. What is worth pinning about a reorganisation is
 * the shape of it — that much the text answers. What these screens *do* is read in the flow tests
 * (`tests/screens/`), where there is a renderer; what stays here is what only the text can say:
 * where a thing stands, and what is no longer in the file.
 */

import { flat } from '@tests/helpers/source';
import { expect, test } from 'vitest';
import upload from '@/app/memory/[id]/upload.tsx?raw';
// The kit files read here: the sheet's offset from the header is the appbar's own padding, and the
// montage card is where the poster a face hands over actually lands.
import bars from '@/kit/bars.tsx?raw';
// Where both gutters of spec 7.8 are named, so a screen that measures a column out of one of them
// is measuring it out of the library rather than out of a number it chose.
import tile from '@/kit/tile.tsx?raw';
import viewer from '@/screens/memory/frame-viewer.tsx?raw';
import frames from '@/screens/memory/frames.tsx?raw';
import sheets from '@/screens/memory/frames-sheets.tsx?raw';
import { ru } from '@/strings';

test('every column of a contact sheet is the same width, the last row included', () => {
  for (const sheet of [frames, upload]) {
    // `flex: 1/3` divides what a row has left after its gaps, so a last row with one frame in it —
    // no gaps in it to leave — handed that frame a third of the whole row instead of a column.
    expect(sheet).not.toContain('flex: 1 / 3');
    // A column worked out from the width the sheet spans, and re-read when the phone turns. Which
    // gutter it is worked out of belongs to the lane the frames stand in (spec 7.8): the memory's
    // feed and the upload screen both run edge to edge, the wizard and the queue stand in 16.
    expect(sheet).toMatch(/(GRID_GAP|FEED_GAP) \* 2\) \/ 3/);
    // Both sheets of frames run edge to edge now (spec 7.8): the memory's feed and the phone's own
    // roll are the same wall of photographs, gutter 2 and no margins at all.
    expect(sheet).toContain('const cell = { width: (width - FEED_GAP * 2) / 3 };');
    expect(sheet).toContain('feed: { flexGrow: 1, gap: FEED_GAP }');
    expect(sheet).toContain('lane="feed"');
  }
  // And the other lane still exists for the wizard to stand in: inside the screen's 16, a hair
  // more air and a 4 radius, because there a frame is a thing being picked out of a list. Which
  // screens use it is their own business — the two gutters are the kit's, and it holds both.
  expect(tile).toContain('export const GRID_GAP = 3;');
  expect(tile).toContain('export const FEED_GAP = 2;');
});

test('the feed starts far enough down to clear the glass floating over it', () => {
  // 52 of status line (measured, not assumed), the bar's own 48 and 16 — which is the 116 the
  // layout draws the «Ролики» block at. Nothing is subtracted for the bar: it floats, so the feed
  // passes under it rather than starting below it.
  expect(frames).toContain('{ paddingTop: insets.top + height.roundViewer + space.s4 }');
  // And it runs under the bottom layer as well, with room left for that layer's own gradient.
  expect(frames).toContain('{ paddingBottom: board.footerGallery }');
  expect(bars).toContain('gallery: { height: board.footerGallery');
  // Spec 8: 22 between the films and the heading over the material, 10 down to the first row.
  expect(frames).toContain('framesHead: { marginTop: 22, marginBottom: 10 }');
});

/**
 * The two sheets the gallery is tuned from (TASK-144, `SheetFilter` and `SheetSort`): what is shown
 * and in what order. Their own file, because they are a second surface over this face and the face
 * already holds the open frame.
 */

test('the filter is a draft until it is applied, and it is applied by a button that counts', () => {
  // «Показать 486 кадров» — the number is worked out from the draft on the spot, so nobody applies
  // a filter without being told first what it comes to. The face owns the material and answers the
  // question; the sheet only asks it.
  expect(frames).toContain('count={(draft) => framesMatching(items ?? [], draft).length}');
  expect(sheets).toContain('const shown = count(draft);');
  expect(flat(sheets)).toContain(
    'shown === 0 ? s.gallery.nothingMatched : chosen ? s.gallery.show(shown) : s.gallery.showAll',
  );
  // A filter that would leave nothing cannot be applied at all, and the button says why rather than
  // offering «Показать 0 кадров»; nothing held back at all has no count to promise (spec 8).
  expect(sheets).toContain('disabled={shown === 0}');
  expect(ru.gallery.show(486)).toBe('Показать 486 кадров');
  expect(ru.gallery.showAll).toBe('Показать все');
  expect(ru.gallery.nothingMatched).toBe('Ни одного кадра под эти условия');
  // Seeded by being mounted: both sheets are drawn only while open, so the draft starts at whatever
  // is applied right now and a sheet closed any other way leaves the gallery as it was.
  expect(frames).toContain("{tuning === 'filter' ? (");
  expect(frames).toContain("{tuning === 'sort' ? (");
  expect(sheets).toContain('useState<Filter>(value)');
});

test('the day block opens with the absence of a choice, and the people row does not', () => {
  // «Все дни» is an empty set and not a value of its own, which is the whole reason a set is what
  // the filter holds. The people row has no such chip in the layout: a face is pressed off again,
  // and «Сбросить» is what clears the lot.
  expect(sheets).toContain('selected={draft.days.size === 0}');
  expect(sheets).toContain('onPress={() => setDraft((have) => ({ ...have, days: new Set() }))}');
  expect(sheets).not.toContain('people: new Set() }))}');
  expect(ru.gallery.anyDay).toBe('Все дни');
  // «Сбросить» stands small beside the heading and not under the main button (spec 8), and says by
  // being off that there is nothing to clear.
  expect(sheets).toContain('disabled={!chosen}');
  expect(sheets).toContain('onPress={() => setDraft(FILTER_NONE)}');
  expect(ru.gallery.reset).toBe('Сбросить');
  // Only people who actually brought something are offered, and only days the gallery holds —
  // each counted and weighed over the whole memory, which is what its tile carries.
  expect(frames).toContain('people={brought}');
  expect(frames).toContain('days={days}');
  expect(frames).toContain('filterDays(items ?? [])');
  expect(sheets).toContain('dayTiles(days)');
  // Faces and tiles, not chips (spec 7.0.1): no name under a face, no chip per day.
  expect(sheets).toContain('<FaceToggle');
  expect(sheets).toContain('<DayTile');
  expect(sheets).not.toContain('avatar={person.name}');
  expect(sheets).not.toContain('formatDayTiny');
});

test('a day the tiles are not offering is reached by the calendar, and can be taken off again', () => {
  // The round calendar beside «Все дни» (spec 8) opens the kit's own calendar under the tiles; a
  // day picked there joins the same set every tile toggles.
  expect(sheets).toContain('label={s.gallery.otherDay}');
  expect(sheets).toContain('icon={CalendarDays}');
  expect(sheets).toContain("tone={calendar ? 'paper' : 'outline'}");
  expect(sheets).toContain('toggleDay(startOfDay(day).getTime())');
  expect(ru.gallery.otherDay).toBe('Выбрать другую дату');
  // No sideways scrolling anywhere in the block (spec 1, rule 5): one row of at most three tiles.
  expect(sheets).not.toMatch(/horizontal/);
});

test('nothing the filter or the sort was set to is remembered between runs', () => {
  // Both are this screen's own state and nothing else: a memory opened afresh opens on the whole
  // of itself, in the order it stands in by default (spec 8).
  expect(frames).toContain('useState<Filter>(FILTER_NONE)');
  expect(frames).toContain('useState<Sort>(SORT_DEFAULT)');
  for (const part of [frames, sheets]) expect(part).not.toMatch(/SecureStore|AsyncStorage/);
});

test('the sort takes effect as it is pressed, and «Готово» is only the way out', () => {
  // Nothing to preview here — the sheet stands over the sheet it is rearranging — so the answer
  // goes straight up and the button at the bottom closes and nothing else.
  expect(frames).toContain(
    '<SortSheet value={sort} onChange={setSort} onDone={() => setTuning(null)} />',
  );
  expect(sheets).toContain('onChange={(by: GroupBy) => onChange({ ...value, by })}');
  expect(sheets).toContain('onChange={(order: Order) => onChange({ ...value, order })}');
  expect(sheets).toContain('label={s.action.done}');
  // The three cuts of the layout, and the days are none of them: whether a date stands between the
  // strips is the account's «Даты между днями», read by the feed and not decided on this sheet.
  expect(ru.gallery.groups.none).toBe('Не собирать');
  expect(ru.gallery.groups.person).toBe('По людям');
  expect(ru.gallery.order).toBe('Порядок');
  expect(ru.gallery.orders.newest).toBe('Сначала новые');
  expect(sheets).not.toContain('RowToggle');
  expect(frames).toContain('const { token, user, datesBetweenDays } = useAuth();');
  // Spec 4: 380 tall, and the button at its foot.
  expect(sheets).toContain('height={height.sheetSort}');
});

test('each of the two sheets glows exactly once', () => {
  // The rule the faces keep, kept by their sheets too: one ember per surface.
  expect(sheets.match(/variant="primary"/g)).toHaveLength(2);
});

test('the delete sheet shows the frame it is about and names the price', () => {
  // `SheetConfirmDelete`: a 64 thumbnail, who brought it and when, and the whole of what is lost —
  // «Оно уйдёт из воспоминания навсегда. В уже собранном ролике останется».
  const confirm = viewer.slice(viewer.indexOf('<ConfirmSheet'));
  expect(confirm).toContain('thumb={item.thumbnail_url ?? undefined}');
  expect(confirm).toContain('meta={shotBy(item, roster, memory)}');
  expect(confirm).toContain('title={s.gallery.deleteAsk(item.kind)}');
  expect(ru.gallery.deleteAsk('photo')).toBe('Удалить это фото?');
  expect(ru.gallery.deleteText).toBe(
    'Оно уйдёт из воспоминания навсегда. В уже собранном ролике останется.',
  );
});

// The invite sheet's own bugs, found in review of TASK-131 and not yet pinned anywhere: a name
// already on the roster went unanswered behind the scrim, a second «Позвать» under the first raced
// the api, and the «В контакты» chip was a flag that could land on the wrong row.
