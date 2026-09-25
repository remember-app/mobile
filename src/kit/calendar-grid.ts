/**
 * The arithmetic under the calendar (spec 7.3, detail 15): which square a day stands in, and how
 * much of each week the range's ribbon covers. Pure and free of any React Native import on purpose,
 * so a test can run it under any time zone — a day is a *local* day here, taken apart with the local
 * getters and never through `toISOString()`, which is what would slide it onto its neighbour for
 * anyone east or west of UTC.
 */

/** Midnight, so two days compare by the day they land on and by nothing else. */
export function dayKey(day: Date): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
}

/**
 * Where the range's ribbon runs across one week, in columns from its left edge: from the middle of
 * the first day — under its circle — or from the edge the range came into the week by, to the middle
 * of the last day or the edge it leaves by. One piece per week, so a range reads as one ribbon and
 * not as a mark per day. `null` when the week holds none of it, and when there is no range: one day
 * picked twice is one day, and one day is not a ribbon.
 */
export function ribbonOf(
  week: readonly (Date | null)[],
  start: number | null,
  end: number | null,
): { from: number; to: number } | null {
  if (start === null || end === null || end <= start) return null;
  const inside = week.flatMap((day, column) =>
    day && dayKey(day) >= start && dayKey(day) <= end ? [{ column, at: dayKey(day) }] : [],
  );
  const first = inside[0];
  const last = inside[inside.length - 1];
  if (!first || !last) return null;
  return {
    from: first.column + (first.at === start ? 0.5 : 0),
    to: last.column + 1 - (last.at === end ? 0.5 : 0),
  };
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
