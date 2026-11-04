import type { Memory } from '@/api';
import { endOfDay, startOfDay } from '@/lib/dates';
export type Captured = {
  creationTime?: number | null;
};
export type ShootingDay<T> = {
  at: number;
  inEvent: boolean;
  assets: T[];
};
export function assetsByDay<T extends Captured>(
  memory: Pick<Memory, 'event_start' | 'event_end'> | null,
  assets: readonly T[],
): ShootingDay<T>[] {
  const from = memory === null ? 0 : startOfDay(new Date(memory.event_start)).getTime();
  const until =
    memory === null ? -1 : endOfDay(new Date(memory.event_end ?? memory.event_start)).getTime();
  const days = new Map<number, ShootingDay<T>>();
  for (const asset of assets) {
    const at = startOfDay(new Date(asset.creationTime || 0)).getTime();
    let day = days.get(at);
    if (day === undefined) {
      day = { at, inEvent: at >= from && at <= until, assets: [] };
      days.set(at, day);
    }
    day.assets.push(asset);
  }
  return [...days.values()].sort((a, b) => Number(b.inEvent) - Number(a.inEvent) || b.at - a.at);
}
