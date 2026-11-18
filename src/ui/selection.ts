export function orderOf(ids: Iterable<string>): Map<string, number> {
  const order = new Map<string, number>();
  for (const id of ids) order.set(id, order.size + 1);
  return order;
}

export function toggledInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
