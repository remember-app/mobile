import { currentLanguage } from '@/lib/language';

function dayFields(
  value: string | Date,
  locale: string = currentLanguage(),
  width: 'long' | 'short' = 'long',
) {
  const day = new Date(value);
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
type DayFields = NonNullable<ReturnType<typeof dayFields>>;
const wholeDay = (fields: DayFields) => `${fields.day} ${fields.month} ${fields.year}`;
const yearOf = (fields: DayFields, now: Date) =>
  fields.year === String(now.getFullYear()) ? '' : ` ${fields.year}`;
export function formatDay(value: string | Date, locale?: string, now: Date = new Date()): string {
  const fields = dayFields(value, locale);
  return fields === null ? '' : `${fields.day} ${fields.month}${yearOf(fields, now)}`;
}
export function formatDayShort(value: string | Date, locale?: string): string {
  const fields = dayFields(value, locale);
  return fields === null ? '' : `${fields.day} ${fields.month}`;
}
export function formatDayTiny(value: string | Date, locale?: string): string {
  const fields = dayFields(value, locale, 'short');
  return fields === null ? '' : `${fields.day} ${fields.month}`;
}
export function formatTime(value: string | Date, locale: string = currentLanguage()): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}
export function clockOf(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}
export function atClock(day: Date, clock: string): Date | null {
  const typed = /^\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s*$/.exec(clock);
  if (typed === null) return null;
  const at = new Date(day);
  at.setHours(Number(typed[1]), Number(typed[2]), 0, 0);
  return at;
}
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
export function formatEventDates(
  start: string,
  end: string | null,
  locale?: string,
  now: Date = new Date(),
): string {
  const from = dayFields(start, locale);
  if (from === null) return '';
  const to = end ? dayFields(end, locale) : null;
  if (to === null || (from.day === to.day && from.month === to.month && from.year === to.year))
    return formatDay(start, locale, now);
  if (from.year !== to.year) return `${wholeDay(from)} — ${wholeDay(to)}`;
  const year = yearOf(from, now);
  if (from.month !== to.month) return `${from.day} ${from.month} — ${to.day} ${to.month}${year}`;
  return `${from.day}–${to.day} ${to.month}${year}`;
}
export function startOfDay(day: Date): Date {
  const instant = new Date(day);
  instant.setHours(0, 0, 0, 0);
  return instant;
}
export function formatRuntime(seconds: number | null): string | undefined {
  if (seconds === null) return undefined;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
export function endOfDay(day: Date): Date {
  const instant = new Date(day);
  instant.setHours(23, 59, 59, 999);
  return instant;
}
export function formatAgo(
  value: string | Date,
  names: {
    yesterday: string;
    beforeYesterday: string;
  },
  now: Date = new Date(),
): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '';
  const back = Math.round(
    (startOfDay(now).getTime() - startOfDay(at).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (back === 1) return names.yesterday;
  if (back === 2) return names.beforeYesterday;
  return formatDayShort(at);
}
export function formatMonth(month: Date, locale: string = currentLanguage()): string {
  const name = month.toLocaleDateString(locale, { month: 'long' });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.getFullYear()}`;
}
export function weekdayLetters(locale: string = currentLanguage()): readonly string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(1970, 0, 5 + i).toLocaleDateString(locale, { weekday: 'short' }).toUpperCase(),
  );
}
export function daysBefore(day: Date, count: number): Date {
  const back = new Date(day);
  back.setDate(back.getDate() - count);
  return back;
}
export function lastWeekend(today: Date): {
  from: Date;
  to: Date;
} {
  const weekday = today.getDay();
  if (weekday === 6) return { from: today, to: today };
  const sunday = weekday === 0 ? today : daysBefore(today, weekday);
  return { from: daysBefore(sunday, 1), to: sunday };
}
