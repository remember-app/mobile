import { expect, test } from 'vitest';

import create from './app/create.tsx?raw';
import { en, ru } from '@/strings';

/**
 * `src/app/create.tsx` has no renderer for the reason `home-screen.test.ts` gives: wired to
 * `expo-router` and auth. Read as text for the same reason, this pins the screen's own branches —
 * the ones a story could not tell apart from a typo two lines over. The calendar itself is drawn
 * and checked in `kit/calendar.test.tsx`; what is below is the screen handing it the right things.
 */

test('the button glows only once there is a title to send', () => {
  expect(create).toContain("disabled={title.trim() === ''}");
});

test('one tap is a day, the second closes the range, the third starts over', () => {
  // Spec 7.3, detail 15. The second tap only closes a range that runs forwards; anything else —
  // a third tap, a tap before the day already picked — is somebody starting again.
  expect(create).toContain('if (to === null && picked > from) setTo(picked);');
  expect(create).toContain('setFrom(picked);');
  expect(create).toContain('setTo(null);');
});

test('the switch for «больше дня» is gone, and so is the phone’s own picker', () => {
  // The whole point of the redraw: one gesture instead of a toggle and two field-buttons. A
  // `Toggle` or a `DateTimePicker` creeping back in is the old screen growing back over this one.
  expect(create).not.toContain('Toggle');
  expect(create).not.toContain('DateTimePicker');
  expect(create).not.toContain('FieldShell');
  expect(create).not.toContain('datetimepicker');
});

test('the four quick days are four whole answers, and each is a word from the dictionary', () => {
  for (const key of ['today', 'yesterday', 'weekend', 'week'] as const) {
    expect(create).toContain(`s.create.${key}`);
    // Written in both languages, and never left as the same word twice — «Неделя» and «Выходные»
    // are two different spans, and a copy-paste between them reads as one.
    for (const set of [en, ru]) expect(set.create[key].length).toBeGreaterThan(0);
  }
  expect(new Set([ru.create.today, ru.create.yesterday, ru.create.weekend, ru.create.week]).size).toBe(4);
  // Pressing one is both ends at once plus the month they live in, never an end left over from
  // whatever was picked before.
  expect(create).toContain('setFrom(range.from);');
  expect(create).toContain('setTo(range.to);');
  expect(create).toContain('setMonth(range.from);');
});

test('a single day is a date and nothing else — the length is only said of a span', () => {
  // Spec 8, «Края»: «12–14 сентября · 3 дня», but «12 сентября 2026» alone.
  expect(create).toContain('const days = to === null ? 1 : Math.round((to.getTime() - from.getTime()) / 86400000) + 1;');
  expect(create).toContain('{days > 1 ? <Text role="chip" tone="muted">{` · ${s.create.days(days)}`}</Text> : null}');
  expect(ru.create.days(1)).toBe('1 день');
  expect(ru.create.days(3)).toBe('3 дня');
  expect(ru.create.days(5)).toBe('5 дней');
  expect(en.create.days(1)).toBe('1 day');
  expect(en.create.days(3)).toBe('3 days');
});

test('paging the calendar by months never moves what is picked', () => {
  // Spec 8, «Края»: a span longer than a month is set by scrolling to its end, and the first day
  // has to still be picked when it gets there. The month showing is its own state for that reason.
  expect(create).toContain('const [month, setMonth] = useState(today);');
  expect(create).toContain('onMonth={setMonth}');
});

test('a day picked away and back submits the day, never the label', () => {
  expect(create).toContain('event_start: from.toISOString()');
  // A single day sends no end at all — `to` stays `null` until a second tap, and the api reads a
  // memory without an end as the one day it started on. The same request the screen always sent.
  expect(create).toContain('event_end: to === null ? undefined : endOfDay(to).toISOString()');
  expect(create).toContain('const [to, setTo] = useState<Date | null>(null);');
});

test('tomorrow is not a day a memory can be of', () => {
  expect(create).toContain('max={today}');
  expect(create).toContain('const today = startOfDay(new Date());');
});

test('a rejected order leaves the form standing, not stuck mid-submit', () => {
  expect(create).toContain('setError(errorMessage(e));');
  expect(create).toContain('setBusy(false);');
  // Both happen together in the catch, so a 400 from the api hands the form straight back
  // rather than leaving the button spinning over a request that already failed.
  const caught = create.slice(create.indexOf('} catch (e) {'), create.indexOf('};', create.indexOf('} catch (e) {')));
  expect(caught).toContain('setError(errorMessage(e));');
  expect(caught).toContain('setBusy(false);');
});

test('a placed memory leaves by the back it arrived on, or the list when there is none', () => {
  expect(create).toContain('if (router.canGoBack()) router.back();');
  expect(create).toContain("else router.replace('/');");
});

test('the back chevron is drawn only where going back means something', () => {
  expect(create).toContain('router.canGoBack() ? (');
  expect(create).toContain('<IconButton icon={ChevronLeft}');
});

test('the screen invents no colour of its own, so daylight is a substitution of tokens', () => {
  // Spec 2 and the chief's word of 2026-09-21: there is no milestone for the light theme, the
  // screen simply turns with it. Everything that carries a colour here is a part of the kit, and
  // the one sheet this file builds is shape only — which `screen-theme.test.tsx` sweeps for every
  // route, and this says out loud for the one that was just redrawn.
  expect(create).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(create).not.toMatch(/rgba?\(/);
  expect(create).not.toContain('useTheme');
});
