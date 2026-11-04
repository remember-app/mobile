export function form(n: number, one: string, few: string, many: string): string {
  const teen = n % 100 >= 11 && n % 100 <= 14;
  const last = n % 10;
  return teen ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}
export function count(n: number, one: string, few: string, many: string): string {
  return `${n} ${form(n, one, few, many)}`;
}
