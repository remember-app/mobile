import type { MediaItem } from '@/api';
import type { TileState } from '@/kit/tile';

/**
 * What a gallery record is on screen. Both types are imported for their shape only, so this module
 * stays a plain one — no `react-native` at module scope, which is what lets a test read it.
 *
 * The two questions here are the ones a screen that draws somebody's material has to answer, and
 * both were written inline in the gallery until they turned out to be wrong there.
 */

/** The frame a record hands the tile: what has become of it, and the picture to draw if there is one. */
export type Frame = { state: TileState; uri: string | null };

/**
 * One record read as a frame. The status is the state, with one correction: a `ready` record that
 * carries no derivative has nothing to show either, so it wears the fallen frame rather than
 * sitting in the sheet as an empty square.
 */
export function frameOf(item: MediaItem): Frame {
  const uri = item.thumbnail_url;
  return { state: item.status === 'ready' && uri === null ? 'failed' : item.status, uri };
}

/**
 * Whether the list is waiting on the worker for anything. A `processing` record only ever moves on
 * the worker's side, so a screen holding one has material coming that it will never hear about —
 * this is the screen's reason to look again, and its reason to stop.
 */
export function stillPreparing(items: readonly MediaItem[] | null): boolean {
  return items?.some((item) => item.status === 'processing') ?? false;
}
