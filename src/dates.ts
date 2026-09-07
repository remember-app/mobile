import { currentLanguage } from '@/language';

// A memory carries a day, or a span of days; the api carries instants. These are the two
// ends of that: what a day looks like on screen, and which instant a picked day is. Plus the
// one other time this app writes out — how long a video runs.

/**
 * A day taken apart into the three pieces the kit writes: day, month, year, in that order in
 * every language. The locale's own sentence is not that shape — Russian hangs a « г.» off the
 * year, American English leads with the month — so only the month word is asked of it, and the
 * digits stay digits. Asked for beside a day, the month comes back in the form that belongs
 * there: «сентября», not the bare «сентябрь». The day's digits and the locale's glue are then
 * taken back out of it.
 *
 * ponytail: `Intl.DateTimeFormat.formatToParts` would read the month out cleanly, but iOS builds
 * of Hermes have shipped without it twice (react-native 0.74 and 0.77), and a missing method here
 * is every screen that draws a date going down. The cost is a language that writes the day with a
 * letter of its own — Japanese «9月3日» — which this app does not speak; move to `formatToParts`
 * when it does.
 *
 * The month word comes from the language the app is speaking, never from the device: handed
 * `undefined`, a formatter falls back on the phone's own locale, which is how a phone set to
 * Russian wrote «сентября» into an otherwise English screen. Only the word is taken, so the
 * language alone is locale enough — «ru» and «en» carry no region worth naming here.
 */
function dayFields(value: string | Date, locale: string = currentLanguage()) {
  const day = new Date(value);
  // `new Date` never throws and neither does `toLocaleDateString` — an unparseable value comes out
  // the other end as «NaN Invalid Date NaN», printed under a photograph as the day it happened. The
  // app ships over the air and the api deploys on its own, so a build that expects these fields can
  // meet one that has stopped sending them; `null` is that, and every caller writes nothing.
  if (Number.isNaN(day.getTime())) return null;
  return {
    day: String(day.getDate()),
    month: day
      .toLocaleDateString(locale, { day: 'numeric', month: 'long' })
      .replace(/[\d\s.,]+/g, ' ')
      .trim(),
    year: String(day.getFullYear()),
  };
}

const wholeDay = (fields: NonNullable<ReturnType<typeof dayFields>>) =>
  `${fields.day} ${fields.month} ${fields.year}`;

/**
 * One day the way the kit writes it — «3 сентября 2026», «3 September 2026». `locale` is only for
 * tests to name a language out loud; the app leaves it out and gets the one it is speaking. A day
 * that will not parse is no day at all and writes nothing.
 */
export function formatDay(value: string | Date, locale?: string): string {
  const fields = dayFields(value, locale);
  return fields === null ? '' : wholeDay(fields);
}

/**
 * The line under a memory's title. A span inside one month names that month once and leaves the
 * year off — «12–16 августа», the way the kit draws a memory card; a span that crosses a month or
 * a year writes both days whole, year and all. A span whose end is the day it started on is a
 * single day, which is what the create screen makes the moment the end is switched on.
 */
export function formatEventDates(start: string, end: string | null, locale?: string): string {
  const from = dayFields(start, locale);
  // No readable start is no line at all; a start that reads with an end that does not is the day it
  // began, which is the same shape a memory without an end has.
  if (from === null) return '';
  if (!end) return wholeDay(from);
  const to = dayFields(end, locale);
  if (to === null) return wholeDay(from);
  if (from.month !== to.month || from.year !== to.year) return `${wholeDay(from)} — ${wholeDay(to)}`;
  return from.day === to.day ? wholeDay(from) : `${from.day}–${to.day} ${to.month}`;
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

/**
 * How long a video runs, for the corner of its frame — `0:42`, `1:07`. Both screens that draw a
 * contact sheet write it, so it is written once: the gallery gets the length from the api and may
 * have none, the upload screen gets it from the phone and always does.
 */
export function formatRuntime(seconds: number | null): string | undefined {
  if (seconds === null) return undefined;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The instant a picked day ended here, so a span covers the whole of its last day. */
export function endOfDay(day: Date): Date {
  const instant = new Date(day);
  instant.setHours(23, 59, 59, 999);
  return instant;
}
