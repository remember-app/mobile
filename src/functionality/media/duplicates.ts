import type { Item } from '@/models';
import type { ProjectItemId } from '@/types/id';

// dHash в 64 бита: до десяти различающихся битов считаем одним ракурсом.
const THRESHOLD = 10;
const HASH = /^[0-9a-f]{16}$/;

type Entry = { id: ProjectItemId; at: number; added: number; first: number; second: number };

const halves = (hash: string): [number, number] => [
  Number.parseInt(hash.slice(0, 8), 16),
  Number.parseInt(hash.slice(8), 16),
];

const counting = (value: number): number => {
  let bits = value - ((value >>> 1) & 0x55555555);
  bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);
  return (((bits + (bits >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

const distance = (left: Entry, right: Entry): number =>
  counting(left.first ^ right.first) + counting(left.second ^ right.second);

/**
 * Кадры, которые повторяют более ранний кадр той же сцены.
 * В каждой группе остаётся самый ранний по съёмке, остальные — лишние.
 */
export function nearDuplicateExtras(items: readonly Item[]): Set<ProjectItemId> {
  const entries = items.flatMap((item): Entry[] => {
    const hash = item.media.perceptualHash;
    if (!HASH.test(hash)) return [];
    const [first, second] = halves(hash);
    return [
      {
        id: item.id,
        at: (item.media.capturedAt ?? item.createdAt).getTime(),
        added: item.createdAt.getTime(),
        first,
        second,
      },
    ];
  });
  const parent = new Int32Array(entries.length);
  for (let at = 0; at < parent.length; at += 1) parent[at] = at;
  const root = (at: number): number => {
    let found = at;
    let next = parent[found] ?? found;
    while (next !== found) {
      found = next;
      next = parent[found] ?? found;
    }
    let walk = at;
    while (parent[walk] !== found) {
      next = parent[walk] ?? found;
      parent[walk] = found;
      walk = next;
    }
    return found;
  };
  // ponytail: попарный перебор по загруженной галерее; при десятках тысяч кадров переносить на сервер.
  for (let left = 0; left < entries.length; left += 1) {
    const first = entries[left];
    if (!first) continue;
    for (let right = left + 1; right < entries.length; right += 1) {
      const second = entries[right];
      if (second && distance(first, second) <= THRESHOLD) parent[root(left)] = root(right);
    }
  }
  const groups = new Map<number, Entry[]>();
  entries.forEach((entry, at) => {
    const key = root(at);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });
  const extras = new Set<ProjectItemId>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort(
      (a, b) => a.at - b.at || a.added - b.added || a.id.localeCompare(b.id),
    );
    for (const entry of ordered.slice(1)) extras.add(entry.id);
  }
  return extras;
}
