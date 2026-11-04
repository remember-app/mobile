import type { Label, MediaItem } from '@/api';
import { labelColors, type Theme } from '@/theme';
export function labelTint(color: number, theme: Theme): string {
  const palette = labelColors(theme);
  return palette[color - 1] ?? palette[0];
}
export type Filing = {
  inside: boolean;
  ids: string[];
};
export function filing(labelId: string, frames: readonly MediaItem[]): Filing {
  const holds = (frame: MediaItem) => frame.label_ids.includes(labelId);
  const inside = frames.length > 0 && frames.every(holds);
  return {
    inside,
    ids: frames.filter((frame) => (inside ? holds(frame) : !holds(frame))).map((frame) => frame.id),
  };
}
export function filed(
  items: readonly MediaItem[] | null,
  labelId: string,
  ids: readonly string[] | null,
  now: boolean,
): MediaItem[] | null {
  if (items === null) return null;
  const moved = ids === null ? null : new Set(ids);
  return items.map((item) => {
    if (moved !== null && !moved.has(item.id)) return item;
    const has = item.label_ids.includes(labelId);
    if (now === has) return item;
    return {
      ...item,
      label_ids: now
        ? [...item.label_ids, labelId]
        : item.label_ids.filter((one) => one !== labelId),
    };
  });
}
export function labelNameOk(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length > 0 && trimmed.length <= LABEL_NAME_MAX;
}
export const LABEL_NAME_MAX = 100;
export function labelGroups(labels: readonly Label[]): {
  shared: Label[];
  own: Label[];
} {
  return {
    shared: labels.filter((label) => label.shared),
    own: labels.filter((label) => !label.shared),
  };
}
export function withLabel(labels: readonly Label[], one: Label): Label[] {
  const rest = labels.filter((label) => label.id !== one.id);
  return [...rest, one].sort(
    (a, b) =>
      Number(b.shared) - Number(a.shared) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
}
