// A memory carries a day, or a span of days; the api carries instants. These are the two
// ends of that: what a day looks like on screen, and which instant a picked day is.

/** One day in the device's own locale, e.g. «3 Sep 2026». */
export function formatDay(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** The line under a memory's title: the single day, or the span when it has an end. */
export function formatEventDates(start: string, end: string | null): string {
  return end ? `${formatDay(start)} — ${formatDay(end)}` : formatDay(start);
}

/**
 * The instant a picked day began here. Local on purpose: the event happened in the
 * user's own timezone, and `toISOString()` carries the offset the api requires.
 */
export function startOfDay(day: Date): Date {
  const instant = new Date(day);
  instant.setHours(0, 0, 0, 0);
  return instant;
}

/** The instant a picked day ended here, so a span covers the whole of its last day. */
export function endOfDay(day: Date): Date {
  const instant = new Date(day);
  instant.setHours(23, 59, 59, 999);
  return instant;
}
