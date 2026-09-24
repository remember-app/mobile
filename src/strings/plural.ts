/**
 * Russian counts in three forms where English has two: 1 кадр, 2 кадра, 5 кадров. The rule is the
 * language's own and never changes, so it is four lines here rather than `Intl.PluralRules`, which
 * Hermes does not carry on every platform. `form` is the word alone, for a number drawn apart from it.
 */
export function form(n: number, one: string, few: string, many: string): string {
  const teen = n % 100 >= 11 && n % 100 <= 14;
  const last = n % 10;
  return teen ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}

export function count(n: number, one: string, few: string, many: string): string {
  return `${n} ${form(n, one, few, many)}`;
}
