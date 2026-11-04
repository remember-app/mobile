import {
  ApiError,
  type FrameInfo,
  type MediaItem,
  type Member,
  type Memory,
  memberName,
} from '@/api';
import type { TileState } from '@/kit/tile';
import { formatEventDates, startOfDay } from '@/lib/dates';
import { currentLanguage } from '@/lib/language';
import type { Strings } from '@/strings';
export type Frame = {
  state: TileState;
  uri: string | null;
  key: string;
  ratio?: number | null;
};
export function frameOf(item: MediaItem): Frame {
  return frameWith(item, item.thumbnail_url, 'thumb');
}
export function openFrameOf(item: MediaItem): Frame {
  return frameWith(
    item,
    item.preview_url ?? item.thumbnail_url,
    item.preview_url === null ? 'thumb' : 'preview',
  );
}
export function singleFrameOf(item: MediaItem): Frame {
  if (item.kind === 'video') return frameOf(item);
  return {
    ...openFrameOf(item),
    ratio:
      item.width !== null && item.height !== null && item.width > 0 && item.height > 0
        ? item.width / item.height
        : null,
  };
}
function frameWith(item: MediaItem, uri: string | null, kind: 'thumb' | 'preview'): Frame {
  return {
    state: item.status === 'ready' && uri === null ? 'failed' : item.status,
    uri,
    key: `${item.id}:${kind}`,
  };
}
export function megabytes(
  item: Pick<MediaItem, 'size_bytes'>,
  locale: string = currentLanguage(),
): string | null {
  return megabytesOf([item], locale);
}
export function megabytesOf(
  items: readonly Pick<MediaItem, 'size_bytes'>[],
  locale: string = currentLanguage(),
): string | null {
  const mb = items.reduce((sum, item) => sum + Number(item.size_bytes), 0) / 1e6;
  if (!Number.isFinite(mb) || mb <= 0) return null;
  return mb.toLocaleString(locale, { maximumFractionDigits: mb < 10 ? 1 : 0 });
}
export function stillPreparing(items: readonly MediaItem[] | null): boolean {
  return items?.some((item) => item.status === 'processing') ?? false;
}
export function keepReady<
  T extends {
    id: string;
    status: string;
  },
>(current: readonly T[] | null, fresh: readonly T[]): T[] {
  const ready = new Map(
    (current ?? []).filter((item) => item.status === 'ready').map((item) => [item.id, item]),
  );
  return fresh.map((item) => ready.get(item.id) ?? item);
}
export function mayOpen(item: MediaItem): boolean {
  return item.status !== 'processing';
}
export function mayPick(item: MediaItem): boolean {
  return frameOf(item).state === 'ready';
}
export function allTaken(markable: readonly MediaItem[], have: ReadonlySet<string>): boolean {
  return markable.length > 0 && markable.every((item) => have.has(item.id));
}
export function toggleEvery(
  markable: readonly MediaItem[],
  have: ReadonlySet<string>,
): Set<string> {
  return allTaken(markable, have) ? new Set() : new Set(markable.map((item) => item.id));
}
export function toggleDay(markable: readonly MediaItem[], have: ReadonlySet<string>): Set<string> {
  const next = new Set(have);
  const whole = allTaken(markable, have);
  for (const item of markable) {
    if (whole) next.delete(item.id);
    else next.add(item.id);
  }
  return next;
}
export async function removeFrames(
  items: readonly MediaItem[],
  remove: (item: MediaItem) => Promise<unknown>,
  carryOn: () => boolean = () => true,
): Promise<{
  gone: Set<string>;
  failure?: unknown;
}> {
  const gone = new Set<string>();
  for (const item of items) {
    if (!carryOn()) break;
    try {
      await remove(item);
    } catch (failure) {
      if (!(failure instanceof ApiError && failure.status === 404)) return { gone, failure };
    }
    gone.add(item.id);
  }
  return { gone };
}
export type FrameDay = {
  at: number;
  frames: MediaItem[];
};
export function shotAt(item: MediaItem): number {
  return Date.parse(item.captured_at ?? item.created_at) || 0;
}
export function dayOf(item: MediaItem): number {
  return startOfDay(new Date(shotAt(item))).getTime();
}
export type FrameGroup = {
  key: string;
  frames: MediaItem[];
} & (
  | {
      by: 'all';
    }
  | {
      by: 'day';
      at: number;
    }
  | {
      by: 'person';
      who: string;
    }
  | {
      by: 'kind';
      kind: MediaItem['kind'];
    }
);
export type GroupBy = 'none' | 'person' | 'kind';
export type Order = 'newest' | 'oldest';
export type Sort = {
  by: GroupBy;
  order: Order;
};
export const SORT_DEFAULT: Sort = { by: 'none', order: 'newest' };
export function arranged(sort: Sort): boolean {
  return sort.by !== SORT_DEFAULT.by || sort.order !== SORT_DEFAULT.order;
}
export function rowsOf<T>(items: readonly T[], columns: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / columns) }, (_, i) =>
    items.slice(i * columns, i * columns + columns),
  );
}
export function dateMarks(
  frames: readonly MediaItem[],
  {
    top,
    row,
    columns,
  }: {
    top: number;
    row: number;
    columns: number;
  },
): {
  at: number;
  top: number;
}[] {
  const marks: {
    at: number;
    top: number;
  }[] = [];
  let day: number | null = null;
  frames.forEach((item, at) => {
    const on = dayOf(item);
    if (on === day) return;
    day = on;
    const y = top + Math.floor(at / columns) * row;
    if (marks.at(-1)?.top === y) return;
    marks.push({ at: on, top: y });
  });
  return marks;
}
export type Filter = {
  people: ReadonlySet<string>;
  labels: ReadonlySet<string>;
  days: ReadonlySet<number>;
  kind: MediaItem['kind'] | null;
  orientation: 'landscape' | 'portrait' | null;
};
export const FILTER_NONE: Filter = {
  people: new Set(),
  labels: new Set(),
  days: new Set(),
  kind: null,
  orientation: null,
};
export function filtering(filter: Filter): boolean {
  return (
    filter.people.size > 0 ||
    filter.labels.size > 0 ||
    filter.days.size > 0 ||
    filter.kind !== null ||
    filter.orientation !== null
  );
}
export function framesMatching(items: readonly MediaItem[], filter: Filter): MediaItem[] {
  return items.filter(
    (item) =>
      (filter.kind === null || item.kind === filter.kind) &&
      (filter.orientation === null || item.orientation === filter.orientation) &&
      (filter.people.size === 0 || filter.people.has(item.uploaded_by)) &&
      (filter.labels.size === 0 || item.label_ids.some((one) => filter.labels.has(one))) &&
      (filter.days.size === 0 || filter.days.has(dayOf(item))),
  );
}
export function keepLabels(filter: Filter, keep: (labelId: string) => boolean): Filter {
  const labels = new Set([...filter.labels].filter(keep));
  return labels.size === filter.labels.size ? filter : { ...filter, labels };
}
export function groupFrames(
  items: readonly MediaItem[],
  { by, order }: Sort,
  dates: boolean,
): FrameGroup[] {
  const within = [...items].sort((a, b) =>
    order === 'newest' ? shotAt(b) - shotAt(a) : shotAt(a) - shotAt(b),
  );
  if (by === 'kind') {
    return (['photo', 'video'] as const)
      .map((kind) => ({
        by: 'kind' as const,
        kind,
        key: `kind-${kind}`,
        frames: within.filter((item) => item.kind === kind),
      }))
      .filter((group) => group.frames.length > 0);
  }
  if (by === 'person') {
    return cut(within, (item) => item.uploaded_by)
      .map(([who, frames]) => ({ by: 'person' as const, who, key: `who-${who}`, frames }))
      .sort((a, b) => b.frames.length - a.frames.length);
  }
  if (!dates) return within.length === 0 ? [] : [{ by: 'all', key: 'all', frames: within }];
  return cut(within, dayOf)
    .map(([at, frames]) => ({ by: 'day' as const, at, key: `day-${at}`, frames }))
    .sort((a, b) => (order === 'newest' ? b.at - a.at : a.at - b.at));
}
function cut<T, K>(items: readonly T[], keyOf: (item: T) => K): [K, T[]][] {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const held = groups.get(key);
    if (held === undefined) groups.set(key, [item]);
    else held.push(item);
  }
  return [...groups];
}
export function framesByDay(items: readonly MediaItem[]): FrameDay[] {
  return byDay(items, shotAt);
}
export function byDay<T>(
  things: readonly T[],
  when: (thing: T) => number,
): {
  at: number;
  frames: T[];
}[] {
  return cut(things, (thing) => startOfDay(new Date(when(thing))).getTime())
    .map(([at, frames]) => ({ at, frames }))
    .sort((a, b) => b.at - a.at);
}
export type FilterDay = {
  at: number;
  count: number;
  fill: number;
};
export function filterDays(items: readonly MediaItem[]): FilterDay[] {
  const days = framesByDay(items);
  const bytes = days.map((day) =>
    day.frames.reduce((sum, item) => sum + (Number(item.size_bytes) || 0), 0),
  );
  const weight = bytes.some((one) => one > 0) ? bytes : days.map((day) => day.frames.length);
  const fullest = Math.max(...weight);
  return days.map((day, at) => ({
    at: day.at,
    count: day.frames.length,
    fill: weight[at] / fullest,
  }));
}
export const DAY_TILES = 3;
export function dayTiles(days: readonly FilterDay[]): FilterDay[] {
  return [...days]
    .sort((a, b) => b.count - a.count || b.at - a.at)
    .slice(0, DAY_TILES)
    .sort((a, b) => a.at - b.at);
}
export function frameIndex(items: readonly MediaItem[], id: string | null): number {
  const at = items.findIndex((item) => item.id === id);
  return at < 0 ? 0 : at;
}
export function shotBy(
  item: MediaItem,
  roster: readonly Member[] | null,
  memory: Memory | null,
): string {
  const who = memberName(roster?.find((member) => member.id === item.uploaded_by) ?? null);
  const when = memory === null ? '' : formatEventDates(memory.event_start, memory.event_end);
  return when === '' ? who : `${who} · ${when}`;
}
export type FrameFact = {
  label: string;
  value: string;
};
export function frameFacts(
  info: FrameInfo,
  s: Strings,
  locale?: string,
  place: string | null = null,
): FrameFact[] {
  const size = megabytes(info, locale);
  const facts: FrameFact[] = [];
  const said = (label: string, value: string) => {
    if (value !== '') facts.push({ label, value });
  };
  said(s.viewer.file, meta([info.file_name, size === null ? null : s.viewer.size(size)]));
  if (info.width !== null && info.height !== null) {
    said(s.viewer.pixels, `${info.width} × ${info.height}`);
  }
  said(
    s.viewer.camera,
    meta([
      info.camera_model,
      info.focal_length_mm === null ? null : s.viewer.focal(info.focal_length_mm),
      info.aperture === null ? null : s.viewer.aperture(info.aperture),
    ]),
  );
  if (info.latitude !== null && info.longitude !== null) {
    said(s.viewer.place, place || s.viewer.coords(info.latitude, info.longitude));
  }
  return facts;
}
export function shotCells(info: FrameInfo, s: Strings): (string | null)[] {
  return [
    info.iso === null ? null : s.viewer.iso(info.iso),
    info.focal_length_mm === null ? null : s.viewer.focal(info.focal_length_mm),
    info.exposure_ev === null ? null : s.viewer.ev(info.exposure_ev),
    info.aperture === null ? null : s.viewer.aperture(info.aperture),
    info.shutter === null ? null : s.viewer.shutter(info.shutter),
  ];
}
const meta = (parts: readonly (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');
