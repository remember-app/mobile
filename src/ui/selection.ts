export function orderOf(ids: Iterable<string>): Map<string, number> {
  const order = new Map<string, number>();
  for (const id of ids) order.set(id, order.size + 1);
  return order;
}
