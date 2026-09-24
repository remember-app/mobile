/**
 * The arithmetic under the calendar (spec 7.3, detail 15): which square a day stands in, and which
 * half of it the range's ribbon fills. Pure and free of any React Native import on purpose, so a
 * test can run it under any time zone — a day is a *local* day here, taken apart with the local
 * getters and never through `toISOString()`, which is what would slide it onto its neighbour for
 * anyone east or west of UTC.
 */

/** Midnight, so two days compare by the day they land on and by nothing else. */
export function dayKey(day: Date): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
}

/** Which half of a square the range's ribbon fills — see {@link laneOf}. */
export type Lane = 'left' | 'right' | 'full' | null;

/**
 * Which half of a square the range's ribbon fills: all of it between the ends, the right half under
 * the first day, the left half under the last — so a range reads as one ribbon and not as three
 * separate marks. `null` at both ends of the question: no range, or a day outside it.
 */
export function laneOf(at: number, start: number | null, end: number | null): Lane {
  // One day picked twice is one day, and one day is not a ribbon.
  if (start === null || end === null || end <= start) return null;
  if (at > start && at < end) return 'full';
  if (at === start) return 'right';
  if (at === end) return 'left';
  return null;
}

/**
 * The month as weeks of seven, Monday first: blanks in front until the first day stands under its
 * own weekday, and blanks behind until the last week is full. Every week is seven long because the
 * calendar draws each one as its own row of equal cells — a single wrapping row of seventh-width
 * cells leaves it to Yoga's float arithmetic whether the seventh fits, and for about one width in
 * nine it does not.
 */
export function weeksOf(month: Date): (Date | null)[][] {
  const year = month.getFullYear();
  const at = month.getMonth();
  // `getDay()` counts from Sunday; the grid counts from Monday.
  const lead = (new Date(year, at, 1).getDay() + 6) % 7;
  const days = new Date(year, at + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(year, at, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}
