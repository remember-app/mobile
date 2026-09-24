import { request } from './call';

/** The labels a frame is filed under, and who may touch them. */
/**
 * A label (doc-13) — a box with a name and a colour inside one memory, as the asker sees it. Shared
 * means everybody in the memory sees it; private means nobody but its owner does, and somebody
 * else's private label leaves no trace in any answer at all.
 *
 * `can_edit` (rename, recolour, delete) and `can_add_media` (put frames in) are **the server's own
 * answer about this asker**, worked out by the same function that refuses the write routes
 * (`labelDenial`, api README). The app never repeats the rule: a button is drawn where the server
 * said it may be. Neither of them is `mine` — a shared label is edited and filled by every member,
 * a viewer included (decision-12).
 */
export type Label = {
  id: string;
  title: string;
  /** The palette cell, 1–8 — a number and not a paint: the eight colours are the client's. */
  color: number;
  shared: boolean;
  /** Whether the asker is the one who made it. */
  mine: boolean;
  can_edit: boolean;
  can_add_media: boolean;
  media_count: number;
};

/**
 * Every label of a memory the asker is allowed to see — shared first, by title within each, which
 * is the order `SheetLabels` lays its two groups out in and the order `label_ids` comes in. Any
 * member may read it, a viewer included: everybody has boxes of their own. No labels is an empty
 * array and not a 404.
 */

/**
 * Every label of a memory the asker is allowed to see — shared first, by title within each, which
 * is the order `SheetLabels` lays its two groups out in and the order `label_ids` comes in. Any
 * member may read it, a viewer included: everybody has boxes of their own. No labels is an empty
 * array and not a 404.
 */
export function listLabels(token: string, memoryId: string): Promise<Label[]> {
  return request(`/memories/${memoryId}/labels`, { token });
}

/**
 * Make one — and, from picking mode, fill it in the same breath: the label and its frames appear
 * together or not at all. Answers with the row the listing would give, so the sheet that made it
 * puts it straight into its own list without asking again.
 *
 * `shared` is settled here and never again: moving a box between shared and private after the fact
 * is not allowed (decision-12). 403 when a viewer tries to make a shared one — a viewer makes
 * private ones only.
 */

/**
 * Make one — and, from picking mode, fill it in the same breath: the label and its frames appear
 * together or not at all. Answers with the row the listing would give, so the sheet that made it
 * puts it straight into its own list without asking again.
 *
 * `shared` is settled here and never again: moving a box between shared and private after the fact
 * is not allowed (decision-12). 403 when a viewer tries to make a shared one — a viewer makes
 * private ones only.
 */
export function createLabel(
  token: string,
  memoryId: string,
  label: { title: string; color: number; shared: boolean; media_ids?: string[] },
): Promise<Label> {
  return request(`/memories/${memoryId}/labels`, { method: 'POST', body: label, token });
}

/** Rename and recolour, and nothing else — visibility is not a thing this route takes. */

/** Rename and recolour, and nothing else — visibility is not a thing this route takes. */
export function updateLabel(
  token: string,
  memoryId: string,
  labelId: string,
  patch: { title?: string; color?: number },
): Promise<Label> {
  return request(`/memories/${memoryId}/labels/${labelId}`, {
    method: 'PATCH',
    body: patch,
    token,
  });
}

/** Take the box away. The frames stay in the memory — only the box goes. */

/** Take the box away. The frames stay in the memory — only the box goes. */
export function deleteLabel(
  token: string,
  memoryId: string,
  labelId: string,
): Promise<{ ok: true }> {
  return request(`/memories/${memoryId}/labels/${labelId}`, { method: 'DELETE', token });
}

/**
 * Put a batch in, one request for the whole selection. A frame already in the box is neither an
 * error nor a duplicate; a frame from another memory or one still uploading refuses the whole batch
 * (400), and nothing is filed half way.
 */

/**
 * Put a batch in, one request for the whole selection. A frame already in the box is neither an
 * error nor a duplicate; a frame from another memory or one still uploading refuses the whole batch
 * (400), and nothing is filed half way.
 */
export function addLabelMedia(
  token: string,
  memoryId: string,
  labelId: string,
  mediaIds: string[],
): Promise<Label> {
  return request(`/memories/${memoryId}/labels/${labelId}/media`, {
    method: 'POST',
    body: { media_ids: mediaIds },
    token,
  });
}

/**
 * Take a batch back out of the box — out of the label and never out of the memory. A frame that was
 * not in it is not an error. Any member takes frames out of a shared label, whoever put them in.
 */

/**
 * Take a batch back out of the box — out of the label and never out of the memory. A frame that was
 * not in it is not an error. Any member takes frames out of a shared label, whoever put them in.
 */
export function removeLabelMedia(
  token: string,
  memoryId: string,
  labelId: string,
  mediaIds: string[],
): Promise<Label> {
  return request(`/memories/${memoryId}/labels/${labelId}/media`, {
    method: 'DELETE',
    body: { media_ids: mediaIds },
    token,
  });
}

/**
 * The tracks the montage worker holds, by id. Five strings the api enumerates and refuses anything
 * outside of, so they are written out here rather than typed as `string` — what each one sounds
 * like is the worker's (`projects/montage/tracks`), and what each one is called on screen is the
 * screen's. The shelf's own order is the layout's, and it lives in `@/lib/montage/order` beside the running
 * time of each one.
 */
