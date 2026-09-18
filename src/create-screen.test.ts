import { expect, test } from 'vitest';

import create from './app/create.tsx?raw';

/**
 * `src/app/create.tsx` has no renderer for the reason `home-screen.test.ts` gives: wired to
 * `expo-router`, `@react-native-community/datetimepicker` and auth. Read as text for the same
 * reason, this pins the screen's own branches — the ones a story could not tell apart from a typo
 * two lines over.
 */

test('the button glows only once there is a title to send', () => {
  expect(create).toContain("disabled={title.trim() === ''}");
});

test('a day picked away and back submits the day, never the label', () => {
  expect(create).toContain('event_start: start.toISOString()');
  expect(create).toContain('event_end: end?.toISOString()');
  // A single day sends no end at all — `end` stays `null` until the toggle is on, and
  // `end?.toISOString()` on `null` is `undefined`, which the api reads as the same day.
  expect(create).toContain('const [end, setEnd] = useState<Date | null>(null);');
});

test('the second day field exists only while the toggle asking for it is on', () => {
  expect(create).toContain('value={end !== null}');
  expect(create).toContain('onValueChange={(on) => setEnd(on ? endOfDay(start) : null)}');
  expect(create).toContain('{end === null ? null : (');
  // And it cannot be set before the day it is meant to follow.
  expect(create).toContain('minimumDate={start}');
});

test('the platform picker´s own cancel never overwrites the day already chosen', () => {
  // Android reports 'dismissed' rather than throwing; iOS never fires without a pick. Either way,
  // only 'set' with a value in hand is allowed to move the state.
  expect(create).toContain("if (event.type === 'set' && picked) onChange(picked);");
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
