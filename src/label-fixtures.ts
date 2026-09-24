import type { Label, MediaItem } from '@/api';

/**
 * The records the labels tests are written on, shared so each test states only what it is about.
 * Imported by `*.test.*` only — nothing in the app reaches for it.
 */

/** A finished frame lying in the labels named. */
export const frame = (id: string, labelIds: string[] = []): MediaItem => ({
  id,
  kind: 'photo',
  status: 'ready',
  uploaded_by: 'u',
  size_bytes: '1',
  captured_at: null,
  width: null,
  height: null,
  duration_seconds: null,
  created_at: '2026-09-20T10:00:00.000Z',
  label_ids: labelIds,
  thumbnail_url: null,
  preview_url: null,
  screening_rejected: null,
  screening_reason: null,
});

/** A shared label the asker may fill and edit, unless said otherwise. */
export const label = (over: Partial<Label> = {}): Label => ({
  id: '1',
  title: 'Лучшее',
  color: 1,
  shared: true,
  mine: true,
  can_edit: true,
  can_add_media: true,
  media_count: 23,
  ...over,
});
