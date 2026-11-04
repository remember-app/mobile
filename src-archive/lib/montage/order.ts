import type {
  MediaItem,
  Montage,
  MontageOrientation,
  MontageTemplate,
  MontageTemplateId,
  MontageWishes,
  MusicTrackId,
} from '@/api';
import type { Strings } from '@/strings';
export const TRACKS: readonly {
  id: MusicTrackId;
  seconds: number;
}[] = [
  { id: 'bright', seconds: 80 },
  { id: 'warm', seconds: 126 },
  { id: 'calm', seconds: 110 },
  { id: 'night', seconds: 110 },
  { id: 'road', seconds: 146 },
  { id: 'merry', seconds: 120 },
  { id: 'tender', seconds: 72 },
  { id: 'dreamy', seconds: 127 },
  { id: 'mystery', seconds: 135 },
  { id: 'energetic', seconds: 231 },
];
export const shelfTrack = (key: string): MusicTrackId | null =>
  TRACKS.some((track) => track.id === key) ? (key as MusicTrackId) : null;
export function trackWords(params: Montage['params'], s: Strings): string[] {
  const { music_director, music_tracks, music_track_id, music_track_key } = params;
  if (music_director) return [s.montage.directorChoice];
  if (music_tracks?.length)
    return music_tracks.map((key) => {
      const shelf = shelfTrack(key);
      return shelf ? s.montage.track[shelf] : s.montage.ownTrackShort;
    });
  if (music_track_id) return [s.montage.track[music_track_id]];
  return music_track_key ? [s.montage.ownTrackShort] : [];
}
export const PRESETS = [30, 60, 90, 180] as const;
export const WISH_LIMIT = 500;
export const TRACK_LIMIT = 50;
export const MIN_FRAMES = 3;
export const STORY_LIMIT = 1800;
export type PickedTrack = {
  key: string;
  name: string | null;
  wish?: string;
};
export function pickedSeconds(tracks: readonly PickedTrack[]): number | null {
  let total = 0;
  for (const track of tracks) {
    const shelf = TRACKS.find((one) => one.id === track.key);
    if (shelf === undefined) return null;
    total += shelf.seconds;
  }
  return total;
}
export function movedTrack(
  tracks: readonly PickedTrack[],
  from: number,
  to: number,
): PickedTrack[] {
  const next = [...tracks];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
  return next;
}
export function landing(heights: readonly number[], from: number, dy: number): number {
  const way = dy > 0 ? 1 : -1;
  let to = from;
  let left = Math.abs(dy);
  for (;;) {
    const next = heights[to + way];
    if (next === undefined || left <= next / 2) return to;
    left -= next;
    to += way;
  }
}
export type Order = {
  dropped: ReadonlySet<string>;
  returned: ReadonlySet<string>;
  story: string;
  template: MontageTemplateId | null;
  ownStory: boolean;
  tracks: readonly PickedTrack[];
  director: boolean;
  seconds: number | null;
  ownLength: boolean;
  orientation: MontageOrientation;
};
export const blankOrder = (): Order => ({
  dropped: new Set(),
  returned: new Set(),
  story: '',
  template: null,
  ownStory: false,
  tracks: [],
  director: false,
  seconds: null,
  ownLength: false,
  orientation: 'landscape',
});
export type TemplateFill = Omit<Order, 'dropped' | 'returned' | 'seconds'> & {
  seconds: number;
};
export const fromTemplate = (template: MontageTemplate): TemplateFill => ({
  template: template.id,
  story: template.story_text,
  ownStory: false,
  tracks: template.music_tracks.map((key) => ({
    key,
    name: null,
    wish: template.music_wishes[key],
  })),
  director: false,
  seconds: template.target_seconds,
  ownLength: false,
  orientation: template.orientation,
});
export const entered = (order: Order): boolean =>
  order.dropped.size > 0 ||
  order.returned.size > 0 ||
  order.story.trim() !== '' ||
  order.template !== null ||
  order.tracks.length > 0 ||
  order.director ||
  order.seconds !== null ||
  order.orientation !== 'landscape';
export const usable = (items: readonly MediaItem[]): MediaItem[] =>
  items.filter((item) => item.status === 'ready');
export const enoughMaterial = (items: readonly MediaItem[]): boolean =>
  usable(items).length >= MIN_FRAMES;
export type Pick = 'keep' | 'auto' | 'hand';
export function pickOf(item: MediaItem, order: Order): Pick {
  if (order.dropped.has(item.id)) return 'hand';
  if (item.screening_rejected && !order.returned.has(item.id)) return 'auto';
  return 'keep';
}
export function afterTap(
  item: MediaItem,
  order: Order,
): {
  dropped: Set<string>;
  returned: Set<string>;
} {
  const dropped = new Set(order.dropped);
  const returned = new Set(order.returned);
  if (pickOf(item, order) === 'keep') dropped.add(item.id);
  else {
    dropped.delete(item.id);
    if (item.screening_rejected) returned.add(item.id);
  }
  return { dropped, returned };
}
export const taken = (items: readonly MediaItem[], order: Order): MediaItem[] =>
  usable(items).filter((item) => pickOf(item, order) === 'keep');
export const droppedByPass = (items: readonly MediaItem[], order: Order): MediaItem[] =>
  usable(items).filter((item) => pickOf(item, order) === 'auto');
export type Reason = 'blur' | 'exposure' | 'unreadable' | 'duplicate' | 'other';
const REASONS: readonly Reason[] = ['blur', 'duplicate', 'exposure', 'unreadable', 'other'];
export const reasonOf = (raw: string | null): Reason =>
  REASONS.includes(raw as Reason) ? (raw as Reason) : 'other';
export function rejectedGroups(
  items: readonly MediaItem[],
  order: Order,
): {
  reason: Reason;
  ids: string[];
}[] {
  const dropped = droppedByPass(items, order);
  return REASONS.map((reason) => ({
    reason,
    ids: dropped
      .filter((item) => reasonOf(item.screening_reason) === reason)
      .map((item) => item.id),
  })).filter((group) => group.ids.length > 0);
}
export function wishes(items: readonly MediaItem[], order: Order): MontageWishes {
  const material = usable(items);
  const include = material
    .filter(
      (item) =>
        item.screening_rejected && order.returned.has(item.id) && !order.dropped.has(item.id),
    )
    .map((item) => item.id);
  const exclude = material.filter((item) => pickOf(item, order) !== 'keep').map((item) => item.id);
  const story = order.story.trim();
  const tracks = order.tracks.map((track) => track.key);
  const said = order.tracks.flatMap((track) => {
    const wish = track.wish?.trim();
    return wish ? [[track.key, wish] as const] : [];
  });
  return {
    orientation: order.orientation,
    ...(order.director ? { music_director: true } : { music_tracks: tracks }),
    ...(order.seconds === null ? {} : { target_seconds: order.seconds }),
    ...(story ? { story_text: story } : {}),
    ...(include.length > 0 ? { include_media_ids: include } : {}),
    ...(exclude.length > 0 ? { exclude_media_ids: exclude } : {}),
    ...(!order.director && said.length > 0 ? { music_wishes: Object.fromEntries(said) } : {}),
  };
}
export const shapeOf = (orientation: MontageOrientation | undefined): number =>
  orientation === 'portrait' ? 9 / 16 : 16 / 9;
export const RATIO: Record<MontageOrientation, string> = { landscape: '16:9', portrait: '9:16' };
export const beingMade = (status: Montage['status']): boolean =>
  status === 'queued' || status === 'processing';
export const WHILE_MAKING_MS = 5000;
