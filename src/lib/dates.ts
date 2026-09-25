import { currentLanguage } from '@/lib/language';

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
function dayFields(
  value: string | Date,
  locale: string = currentLanguage(),
  // The same word cut short — «сент», «Sep» — for a day standing in a space measured in millimetres:
  // the pill on the date spine.
  width: 'long' | 'short' = 'long',
) {
  const day = new Date(value);
  // `new Date` never throws and neither does `toLocaleDateString` — an unparseable value comes out
  // the other end as «NaN Invalid Date NaN», printed under a photograph as the day it happened. The
  // app ships over the air and the api deploys on its own, so a build that expects these fields can
  // meet one that has stopped sending them; `null` is that, and every caller writes nothing.
  if (Number.isNaN(day.getTime())) return null;
  return {
    day: String(day.getDate()),
    month: day
      .toLocaleDateString(locale, { day: 'numeric', month: width })
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
 * The same day without its year — «13 сентября», «13 September». What stands over an open frame and
 * on its own sheet (spec 8): a frame is looked at inside the memory it belongs to, and the year is
 * already settled by that.
 */
export function formatDayShort(value: string | Date, locale?: string): string {
  const fields = dayFields(value, locale);
  return fields === null ? '' : `${fields.day} ${fields.month}`;
}

/**
 * A day of the phone's own roll (spec 8, `Upload*`): «13 сентября», the way the layout writes it
 * over the frames — but with its year once it is not this one. Unlike a memory's feed, where the
 * memory settles the year, the roll runs back years, and «13 сентября» twice over would be two days
 * nobody can tell apart. `now` is only for tests.
 */
export function formatRollDay(
  value: string | Date,
  now: Date = new Date(),
  locale?: string,
): string {
  return new Date(value).getFullYear() === now.getFullYear()
    ? formatDayShort(value, locale)
    : formatDay(value, locale);
}

/**
 * The shortest a day gets — «13 сент», «13 Sep»: the pill on the date spine (spec 7.8, detail 66),
 * which holds one line ten pixels tall. The month is the locale's own abbreviation with its full
 * stop taken off, the way the layout writes it.
 */
export function formatDayTiny(value: string | Date, locale?: string): string {
  const fields = dayFields(value, locale, 'short');
  return fields === null ? '' : `${fields.day} ${fields.month}`;
}

/**
 * The clock beside that day — «21:47», «9:47 PM». Whether it is read round the clock or in halves
 * is the language's own business, which is why the hour is asked for as a number rather than padded
 * here. Unreadable is no time at all, the way an unreadable day is no day.
 */
export function formatTime(value: string | Date, locale: string = currentLanguage()): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/**
 * And the name of that day — «суббота», «Saturday» — the second line of the frame's own sheet; cut
 * short — «сб», «Sat» — beside the figure on a day tile of `SheetFilter` (spec 7.3, detail 74).
 *
 * A Russian day is written small (spec 9: «пт», «сб», «вс»). iOS hands a weekday asked for on its
 * own back in the stand-alone form, capitalised — «Сб» on the tile — so the case is the language's
 * and not the platform's.
 */
export function formatWeekday(
  value: string | Date,
  locale: string = currentLanguage(),
  width: 'long' | 'short' = 'long',
): string {
  const day = new Date(value);
  if (Number.isNaN(day.getTime())) return '';
  const name = day.toLocaleDateString(locale, { weekday: width });
  return locale.startsWith('ru') ? name.toLocaleLowerCase('ru') : name;
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
  if (from.month !== to.month || from.year !== to.year)
    return `${wholeDay(from)} — ${wholeDay(to)}`;
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

/**
 * The month over the calendar's grid — «Сентябрь 2026», «September 2026». Asked for on its own a
 * month comes back in the form that heads a page («сентябрь», not «сентября»), and only its first
 * letter has to be raised: Russian writes the word lowercase and the layout prints it capitalised.
 */
export function formatMonth(month: Date, locale: string = currentLanguage()): string {
  const name = month.toLocaleDateString(locale, { month: 'long' });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.getFullYear()}`;
}

/**
 * «ПН…ВС» over the calendar's seven columns, in the language the app is speaking and starting on
 * Monday, which is the week the kit draws. Read off a real week rather than written out per
 * language: a list of seven letters copied into every dictionary is a translation waiting to drift.
 */
export function weekdayLetters(locale: string = currentLanguage()): readonly string[] {
  // 5 January 1970 was a Monday, and the seven days after it are one whole week.
  return Array.from({ length: 7 }, (_, i) =>
    new Date(1970, 0, 5 + i).toLocaleDateString(locale, { weekday: 'short' }).toUpperCase(),
  );
}

/** The same day some days back, month and year rolling over on their own. */
export function daysBefore(day: Date, count: number): Date {
  const back = new Date(day);
  back.setDate(back.getDate() - count);
  return back;
}

/**
 * What «Выходные» hands over: the weekend just gone. On a Saturday that is the Saturday alone —
 * Sunday has not happened yet, and a memory cannot be of tomorrow.
 */
export function lastWeekend(today: Date): { from: Date; to: Date } {
  // `getDay()` counts from Sunday, so it is also how far back the last Sunday is.
  const weekday = today.getDay();
  if (weekday === 6) return { from: today, to: today };
  const sunday = weekday === 0 ? today : daysBefore(today, weekday);
  return { from: daysBefore(sunday, 1), to: sunday };
}
