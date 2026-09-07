import { memberName, type MediaItem, type Member } from '@/api';
import { formatDay } from '@/dates';
import type { TileState } from '@/kit/tile';

/**
 * What a gallery record is on screen. `@/kit/tile` is imported for its shape only and `@/api` and
 * `@/dates` are plain modules themselves, so nothing here pulls `react-native` in — which is what
 * lets a test read this file, and the reason every decision the gallery makes about a record lives
 * in it rather than inline in a screen no test can render.
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

/**
 * Whether a record can be opened big. A frame still developing has nothing behind it yet — the kit
 * keeps it in the filmstrip so the count stays honest, but will not open it. A fallen one does
 * open: that is the screen the delete button is on, and a record nobody can look at is exactly the
 * one somebody wants rid of.
 */
export function mayOpen(item: MediaItem): boolean {
  return item.status !== 'processing';
}

/**
 * Which tile the filmstrip opens on — the position of the record being shown. Never below zero: a
 * record that has just been deleted is no longer in the list, and a strip told to start at «not
 * found» starts nowhere at all, so it starts at its head instead.
 */
export function frameIndex(items: readonly MediaItem[], id: string | null): number {
  const at = items.findIndex((item) => item.id === id);
  return at < 0 ? 0 : at;
}

/**
 * The line over an open frame — who brought it and the day it was shot, the kit's `.viewer__who`.
 * `captured_at` is the day the camera wrote and `created_at` the day it reached us; the first is
 * the truer one and old material has only the second. Somebody who has since left the memory is
 * off the roster, and their frame stays — so an unknown uploader is «Someone», not a blank.
 */
export function shotBy(item: MediaItem, roster: readonly Member[] | null): string {
  const who = roster?.find((member) => member.id === item.uploaded_by) ?? null;
  return `${memberName(who)} · ${formatDay(item.captured_at ?? item.created_at)}`;
}
