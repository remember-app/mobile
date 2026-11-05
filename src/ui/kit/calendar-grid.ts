export function dayKey(day: Date): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
}
export function ribbonOf(
  week: readonly (Date | null)[],
  start: number | null,
  end: number | null,
): {
  from: number;
  to: number;
} | null {
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
export function weeksOf(month: Date): (Date | null)[][] {
  const year = month.getFullYear();
  const at = month.getMonth();
  const lead = (new Date(year, at, 1).getDay() + 6) % 7;
  const days = new Date(year, at + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(year, at, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}
