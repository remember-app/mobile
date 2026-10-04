import { request } from './call';
import type { Contact } from './contacts';
import type { Label } from './labels';

/**
 * One line written under a frame — doc-14. It rides `FrameInfo` rather than a route of its own:
 * it is drawn on the sheet the person just opened, so a second request would only mean the panel
 * filling in after it appears, the way the labels do not (TASK-497).
 *
 * `mine` is the server's own answer about the asker and the only thing that says «this is yours,
 * this may be taken down». The rule behind it is never repeated on the phone: somebody else's
 * comment is removed by nobody, the organizer included, and the sign is drawn where the server
 * said it may be — the way `Label.can_edit` works.
 */
export type FrameComment = {
  id: string;
  body: string;
  created_at: string;
  author: Contact;
  mine: boolean;
};

/** The material: declaring a file, sending it, reading it back, and taking it away. */
/**
 * How a file gets into R2 without the bytes passing through the api: the row it minted, and a
 * signed `PUT` for every slice of the file, cut at `part_size`. The links die at `expires_at`
 * (about an hour), and asking for them again re-issues them against the *same* multipart upload —
 * which is what lets an interrupted upload carry on instead of starting over.
 */
export type UploadPlan = {
  id: string;
  status: string;
  upload: {
    key: string;
    upload_id: string;
    part_size: number;
    parts: { part_number: number; url: string }[];
    expires_at: string;
  };
};

/** The file as the api wants it declared, before a single byte is sent. */
export type UploadIntent = {
  kind: 'photo' | 'video';
  size_bytes: number;
  /** RFC 3339 with an offset, or null when the file carries no capture date at all. */
  captured_at?: string | null;
  /** Required for a video and ignored for a photo — the api answers 400 without it. */
  duration_seconds?: number | null;
  /**
   * What the file is called on the phone, up to 255 characters — the one line «сведения о кадре»
   * has no other source for. Optional on the api's side and staying that way: everything uploaded
   * before the app started sending it lives without one.
   */
  file_name?: string;
};

/**
 * Announce a file and get the links to send it with. 403 for a viewer, 413 when the file is over
 * a limit, 409 when the memory is full or out of space.
 */
export function startUpload(
  token: string,
  memoryId: string,
  file: UploadIntent,
): Promise<UploadPlan> {
  return request(`/memories/${memoryId}/media`, { method: 'POST', body: file, token });
}

/**
 * Fresh links for the same upload — the answer to one that expired mid-file, and the way a resume
 * gets its links back at all. 409 once there is nothing left to send, and the body then carries
 * the status the row has moved on to.
 */
export function refreshUpload(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<UploadPlan> {
  return request(`/memories/${memoryId}/media/${mediaId}/upload`, { token });
}

/**
 * «Загружено»: seals the parts into one object and starts the preview. Idempotent — a repeat only
 * reports where the row stands. Given a longer leash than the rest: the api is waiting on R2
 * assembling the object, which for a big video is not a five-second job.
 *
 * `first_upload` is true exactly once per person per memory — on the completion that moved them
 * off `not_started` — and is the api telling the app to ask the doc-06 question. A repeat of the
 * same call, or anybody's second file, answers false.
 */
export function finishUpload(
  token: string,
  memoryId: string,
  mediaId: string,
  parts: { part_number: number; etag: string }[],
): Promise<{ id: string; status: string; first_upload: boolean }> {
  return request(`/memories/${memoryId}/media/${mediaId}/complete`, {
    method: 'POST',
    body: { parts },
    token,
    timeout: 60_000,
  });
}

/**
 * A file the phone would not hand over, told to the one place on the api's side that hears a phone
 * today: its request log, which writes down every url it is asked for, query and all (TASK-434).
 * `/health` because it does nothing and wants no session — the report costs the api nothing and
 * gets through whatever state the session is in.
 *
 * ponytail: the log is the whole sink, and it lives as long as the api's pod does. A route and a
 * table of their own when there is more than one path's failures to hear.
 */
export function reportUploadFailure(report: Record<string, string>): Promise<unknown> {
  return request(`/health?${new URLSearchParams(report)}`);
}

/**
 * One record in a memory's gallery. `pending_upload` never appears — those are uploads still in
 * flight, with no bytes in the store to show — so the three statuses here are the whole set.
 *
 * The two urls are the derivatives, signed and short-lived (~15 minutes, architecture.md); the
 * original is deliberately not linked from here. Both are null until the worker has made them,
 * which is what `processing` and `failed` look like on screen.
 */
export type MediaItem = {
  id: string;
  kind: 'photo' | 'video';
  status: 'processing' | 'ready' | 'failed';
  uploaded_by: string;
  /**
   * Taken out of the shared feed and the montage by whoever brought it, and still theirs. Only its
   * owner is ever sent one — to everybody else the api does not list it at all.
   */
  hidden: boolean;
  size_bytes: string;
  captured_at: string | null;
  width: number | null;
  height: number | null;
  /**
   * Which way the frame stands as it is seen — worked out by the api from `width` and `height`, so
   * null exactly while those are. A separate axis from `kind`, filtered on the phone like the rest.
   */
  orientation: 'landscape' | 'portrait' | 'square' | null;
  duration_seconds: number | null;
  created_at: string;
  /**
   * The boxes this frame lies in (doc-13), and only the ones the asker may see: the memory's shared
   * labels and their own private ones. A frame in none of them comes with an empty array, never a
   * null, and it is listed once however many labels hold it — the gallery is not joined on them.
   */
  label_ids: string[];
  /** A photo's thumbnail, a video's poster frame. */
  thumbnail_url: string | null;
  /** The 720p H.264 the gallery plays progressively. A photo has none. */
  preview_url: string | null;
  /**
   * What the automatic pass made of this frame (doc-03), handed over as the worker left it: whether
   * it would drop it, and the word for why — `blur`, `exposure`, `unreadable`. Null on both while
   * the analysis has not looked yet, which is «ещё не готово» and deliberately not `false`: that
   * would read as «looked at and kept». A proposal and not a verdict — the organizer overrules it in
   * either direction on the first step of the order (`@/lib/montage/order`).
   */
  screening_rejected: boolean | null;
  screening_reason: string | null;
};

/**
 * Everything in a memory, oldest shot first — the order the montage would play it in. Any member
 * reads it, a viewer included. 503 while the api has no bucket configured.
 *
 * The api hands the asker their own hidden frames too, marked, so that «Мои кадры» can show them;
 * every other screen reads the shared feed, where a hidden frame is not — so they are left out
 * unless `hidden` asks for them.
 */
export async function listMedia(
  token: string,
  memoryId: string,
  { hidden = false }: { hidden?: boolean } = {},
): Promise<MediaItem[]> {
  const all = await request<MediaItem[]>(`/memories/${memoryId}/media`, { token });
  return hidden ? all : all.filter((item) => !item.hidden);
}

/**
 * What the person who brought a frame may change about it: whether it is hidden, when it was shot,
 * and where. The two coordinates go together, both `null` takes the place off; the date cannot be
 * taken off. 404 for a frame that is not the asker's own, as for one that is gone.
 */
export type MediaEdit = {
  hidden?: boolean;
  captured_at?: string;
} & (
  | { latitude?: undefined; longitude?: undefined }
  | { latitude: number | null; longitude: number | null }
);

export function editMedia(
  token: string,
  memoryId: string,
  mediaId: string,
  edit: MediaEdit,
): Promise<unknown> {
  return request(`/memories/${memoryId}/media/${mediaId}`, { method: 'PATCH', body: edit, token });
}

/**
 * Everything about one frame the picture itself does not say — the sheet «Сведения о кадре» (spec 8,
 * `SheetFrameInfo`). Read by every member, a viewer included.
 *
 * Half of it is written by the montage worker rather than by the api, exactly as `width` and
 * `height` are: the camera, the place, and which finished videos this frame stands in. A record
 * older than that worker carries `null` in every one of those fields, and `file_name` is missing
 * outright for anything uploaded before the app started sending a name — so «нет такого поля» and
 * «поле пустое» are one thing here, and the sheet draws neither.
 */
export type FrameInfo = {
  id: string;
  /** Absent, never null, when the file arrived without a name. */
  file_name?: string;
  size_bytes: string;
  captured_at: string | null;
  created_at: string;
  width: number | null;
  height: number | null;
  camera_model: string | null;
  focal_length_mm: number | null;
  aperture: number | null;
  /** Sensitivity as the camera wrote it. The worker's, and null on a frame it never read. */
  iso: number | null;
  /**
   * Exposure compensation in stops, signed. `0` is a camera that metered without compensation and
   * means as much to a reader as any other reading, so it is told apart here from the null a camera
   * that never wrote the tag leaves behind — and the strip draws the two differently.
   */
  exposure_ev: number | null;
  /**
   * The shutter as the fraction EXIF holds, `1/60` and not 0.0166 (TASK-532): the denominator is
   * the answer, and seconds would print «0.008 с» on a 1/125. Null where the tag is not there.
   */
  shutter: string | null;
  /** The place as coordinates and nothing else: the name is the phone's geocoder's (`@/lib/geocoder`). */
  latitude: number | null;
  longitude: number | null;
  /** Who brought it, and how many frames that person brought to *this* memory. */
  uploaded_by: Contact & { media_count: number };
  /**
   * The finished montages this frame stands in, newest first, and the second it stands at in each.
   * One frame can legitimately appear twice in the same montage, so the id alone is not a key.
   */
  montages: { id: string; duration_seconds: number | null; start_seconds: number }[];
  /**
   * The boxes this frame lies in — the memory's shared ones and the asker's own private ones, whole
   * rows and not ids, which is what the filter over the gallery reads (doc-13). An empty array and
   * never `null`: a frame in no box at all is a frame in none, and the caller asks `labels.length`.
   *
   * The order is the api's — shared first, by title within each, and that is the order it arrives in
   * here in too. The phone does not sort it again; a filter that reorders them reads a gallery the
   * picker does not.
   */
  labels: Label[];
  /**
   * What people wrote under this frame (doc-14), oldest first — the order the panel draws them in
   * and the order a new one joins at the end of. An empty array and never `null`, like `labels`:
   * nobody has written yet is a fact about the frame, not a missing field, and the panel says so
   * in words rather than drawing nothing at all.
   *
   * Missing altogether on an answer from an api that does not send it yet, which is not the same
   * thing and is not read as one — the panel's own rule says a line the server knows nothing about
   * is not drawn.
   */
  comments?: FrameComment[];
};

/**
 * The sheet's one read. Nothing signed comes back and no bucket is asked, so this is the one media
 * route with no 503 in it: the sheet opens over a frame the app is already showing.
 */
export function fetchFrameInfo(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<FrameInfo> {
  return request(`/memories/${memoryId}/media/${mediaId}`, { token });
}

/**
 * Write one under a frame and get **the list row itself** back — not `{ok:true}`. The form is the
 * one `GET …/media/:mediaId` would have handed over, so the panel puts it at the end of what it is
 * already showing and asks nothing a second time. Written by any member, a viewer included, under
 * somebody else's frame as much as under their own: a comment is a note about a picture, and doc-14
 * does not ask who is looking at it.
 *
 * 400 for a body that is empty once the server has trimmed it, or over `MAX_COMMENT_LENGTH`. That
 * ceiling is the api's alone and is not written here in a second copy: the two repositories have no
 * shared source to read it from, and a copy that quietly disagreed would refuse words the server had
 * long since agreed to take. It cannot even be matched — the base counts an emoji as one letter and
 * a phone as two — so the phone writes what a person wrote and answers with what came back.
 */
export function addFrameComment(
  token: string,
  memoryId: string,
  mediaId: string,
  body: string,
): Promise<FrameComment> {
  return request(`/memories/${memoryId}/media/${mediaId}/comments`, {
    method: 'POST',
    body: { body },
    token,
  });
}

/**
 * Take one down — the writer's own, and only the writer's: somebody else's answers 404 rather than
 * 403, because «not allowed» would be an answer about a comment everybody can already see. Nobody
 * works the rule out on the phone; the panel draws the sign off `mine`, which the api worked out.
 */
export function deleteFrameComment(
  token: string,
  memoryId: string,
  mediaId: string,
  commentId: string,
): Promise<{ ok: true }> {
  return request(`/memories/${memoryId}/media/${mediaId}/comments/${commentId}`, {
    method: 'DELETE',
    token,
  });
}

/**
 * A signed link to the *original* — the file as it was sent, not the derivative the gallery draws.
 * Any member may ask, a viewer included. 404 for a record that is still uploading (there are no
 * bytes to sign yet) and for one of another memory; 503 while the api has no bucket. The link is
 * as short-lived as the gallery's own (~15 minutes), so it is fetched at the moment of saving.
 */
export function downloadMedia(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<{ url: string }> {
  return request(`/memories/${memoryId}/media/${mediaId}/download`, { token });
}

/**
 * An original to save, as both download routes hand it out — the whole-gallery one row for row.
 * Named here rather than beside the screen that saves them: it is the shape on the wire, and the
 * two are the same shape on purpose.
 */
export type Original = { id: string; kind: MediaItem['kind']; url: string };

/**
 * Every original in one answer, in the gallery's own order — «скачать всю галерею» without a round
 * trip per file. Same set as `listMedia`, cut down to what the saving needs: the extension comes
 * from `kind`, since neither this nor the record carries the name the file had.
 *
 * The long leash for the reason `finishUpload` has one: a memory may hold up to a thousand records
 * (MEMORY_MAX_FILES), and this signs and ships a link for every one of them in a single answer —
 * the one request the whole «download all» hangs on must not be the one that times out at five
 * seconds. ponytail: the real answer is a page at a time; the client already saves file by file,
 * so paging costs it nothing. Add it when a gallery that big exists to test against.
 */
export function downloadAllMedia(token: string, memoryId: string): Promise<Original[]> {
  return request(`/memories/${memoryId}/media/download`, { token, timeout: 60_000 });
}

/**
 * Take one record out for good, bytes and all. Whoever uploaded it may, and so may the organizer;
 * 403 for anybody else, 404 once it is already gone.
 */
export function deleteMedia(
  token: string,
  memoryId: string,
  mediaId: string,
): Promise<{ ok: true }> {
  return request(`/memories/${memoryId}/media/${mediaId}`, { method: 'DELETE', token });
}
