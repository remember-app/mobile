import { i18n, locale } from './i18n';

export function number(value: number, digits = 1): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(value);
}

export function gigabytes(value: number): string {
  return `${number(value)} ${i18n.t('unit.gb')}`;
}

export function megabytes(bytes: number): string {
  return `${number(bytes / 1024 / 1024, 2)} ${i18n.t('unit.mb')}`;
}

export function size(bytes: number): string {
  return bytes >= 1024 ** 3 ? gigabytes(bytes / 1024 ** 3) : megabytes(bytes);
}

export function dayMonth(value: Date): string {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(value);
}

export function dateRange(start: Date, end: Date | null): string {
  if (!end || dayMonth(start) === dayMonth(end)) return dayMonth(start);
  return `${dayMonth(start)} — ${dayMonth(end)}`;
}

export function fullDay(value: Date): string {
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

export function monthYear(value: Date): string {
  return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(value);
}

export function time(value: Date): string {
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(value);
}

export function dateTime(value: Date): string {
  const text = new Intl.DateTimeFormat(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function duration(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function scoreColor(score: number): string {
  const clamped = Math.min(Math.max(score, 0), 1);
  return `hsl(${Math.round(clamped * 120)}, 70%, 45%)`;
}
