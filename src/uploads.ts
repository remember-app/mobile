// Getting the picked files to R2 (architecture.md, «Хранилище и медиа-пайплайн»): the api signs,
// the phone sends the bytes itself, the api is told when they are there.
//
// A queue and not a loop over a selection, because every way this goes wrong is ordinary on a
// phone — the tunnel, the lift, the app swiped away mid-file. It lives on disk, so it outlives the
// app; it remembers what R2 already took, so a resume sends only what is missing; and it is module
// state rather than screen state, so an upload outlives the screen that started it. Nothing here
// asks what the memory's status is: material goes in during the event and long after the montage
// was made (doc-02).
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  ApiError,
  apiReason,
  finishUpload,
  refreshUpload,
  setContributionStatus,
  startUpload,
  type UploadPlan,
} from '@/api';
import { useAuth } from '@/auth';
import {
  missingParts,
  uploadedParts,
  type PartRange,
  type QueuedFile,
  type UploadFailure,
} from '@/upload-queue';

/** Where the queue waits between launches. Documents and not cache — nothing may sweep this. */
const QUEUE_FILE = 'uploads.json';

/** How long a parked queue waits before trying itself again, for the tunnel that ends mid-file. */
const RETRY_MS = 15_000;

/**
 * A failure the pump names itself, carried as the line to say and not as the sentence — the queue
 * holds no words at all, so nothing in it can be left in yesterday's language (TASK-93). The
 * `Error` message is for a log and never for a person. Everything else that lands in the pump — a
 * dead api, a dropped connection — is named by `failure` below.
 */
class UploadError extends Error {
  constructor(readonly failure: UploadFailure) {
    super(failure.reason);
  }
}

/** Whatever came out of the pump, as the queue keeps it: the pump's own reason, or the api's. */
const failure = (error: unknown): UploadFailure =>
  error instanceof UploadError
    ? error.failure
    : error instanceof ApiError
      ? { reason: 'api', status: error.status, said: apiReason(error.body) }
      : { reason: 'offline' };

let queue: QueuedFile[] = [];
let restored = false;
let session: string | null = null;
/**
 * The memory whose «Это всё?» is up and unanswered (doc-06). Module state beside the queue and not
 * a screen's own, for the reason the queue is: the moment the question is due is the moment a file
 * lands, which happens with no screen watching as readily as with one.
 *
 * Not written to disk. A question the app was killed in the middle of is a question missed, exactly
 * as a system dialog would have been — and what it would have set is the standing the first upload
 * already left them on.
 */
let asking: string | null = null;
let running = false;
let retrying: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const store = () => new File(Paths.document, QUEUE_FILE);

/** Read back what the last run left. Once per launch, and never a reason to show anything. */
function restore() {
  if (restored) return;
  restored = true;
  try {
    const saved = store();
    // Last run's reasons stay with last run: whatever parked a file happened a tunnel and possibly
    // a language ago, so everything comes back waiting and the pump says what is wrong now. It is
    // also what makes a queue left by an older build readable — there the reason on disk is a
    // finished sentence and not a line to say (TASK-93) — and it costs nothing: a queue that comes
    // back parked is woken by the retry timer fifteen seconds later anyway.
    if (saved.exists) {
      queue = (JSON.parse(saved.textSync()) as QueuedFile[]).map(({ error, ...file }) => file);
    }
  } catch {
    // A queue that cannot be read is a list of what to send again, not the material itself —
    // that is still in the gallery, and the person can pick it once more.
    queue = [];
  }
}

/**
 * Tell whoever is watching. The queue's own changes go through `changed()` below; the question
 * doc-06 raises has nothing to write down, so it comes here straight.
 */
function notify() {
  for (const listener of listeners) listener();
}

/**
 * Every change to the queue lands here: a fresh array so React re-reads it, and the file so the next
 * launch knows. Entries themselves are mutated in place — the etags go in one part at a time, and a
 * copy per part is a copy per 8 MB for nothing.
 */
function changed() {
  queue = [...queue];
  notify();
  try {
    const file = store();
    if (!file.exists) file.create({ intermediates: true });
    file.write(JSON.stringify(queue));
  } catch {
    // A queue that cannot be written still empties in this run; only a restart forgets it.
  }
}

/**
 * The file behind a gallery entry. `uri` is the library's own handle — `ph://…` on iOS — and
 * cannot be read as a path; `localUri` is the actual file, which is what the parts are cut from.
 */
function sourceFile(asset: MediaLibrary.AssetInfo): File {
  try {
    const source = new File(asset.localUri ?? asset.uri);
    if (source.exists && source.size > 0) return source;
  } catch {
    // Whatever the reason, it comes to the same thing as the line below.
  }
  throw new UploadError({ reason: 'gone' });
}

/**
 * The links to send this file with: the intent the first time round, a re-issue every time after.
 * A re-issue is the same row and the same multipart upload, so everything already in R2 stays
 * there — the api's side of «оборванная загрузка докачивается».
 */
async function planFor(file: QueuedFile, token: string, size: number): Promise<UploadPlan> {
  if (file.mediaId === undefined) {
    const plan = await startUpload(token, file.memoryId, {
      kind: file.kind,
      size_bytes: size,
      captured_at: file.capturedAt,
      duration_seconds: file.durationSeconds,
      // The phone's own name for the file, which is the only place «сведения о кадре» can get it
      // from. Cut to what the api takes rather than sent whole: over 255 it answers 400, and a 400
      // here parks a file that has nothing wrong with it.
      file_name: file.filename.slice(0, 255),
    });
    file.mediaId = plan.id;
    // The size the api signed links against, kept rather than re-read: the slices must line up
    // with the links, and a file measured twice could answer differently the second time.
    file.size = size;
    file.partSize = plan.upload.part_size;
    changed();
    return plan;
  }

  const plan = await refreshUpload(token, file.memoryId, file.mediaId);
  if (plan.upload.part_size !== file.partSize) {
    // The api's part size moved between two runs. The etags in hand describe slices that no
    // longer line up with the links, so this file starts over rather than being sealed wrong.
    file.partSize = plan.upload.part_size;
    file.parts = {};
    changed();
  }
  return plan;
}

/**
 * One slice, straight to R2. Answers with the etag R2 receipts it with, or null when the link has
 * simply run out of its hour — the one failure that is fixed by asking the api again rather than
 * by trying harder.
 */
async function putPart(url: string, source: File, part: PartRange): Promise<string | null> {
  const handle = source.open();
  // Typed as the handle hands it back rather than as a plain `Uint8Array`: a view over a
  // `SharedArrayBuffer` is not a body `fetch` will take, and the two say so differently.
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    handle.offset = part.start;
    // ponytail: a synchronous read of one part (8 MB by default) on the JS thread — the only
    // read-at-an-offset the platform offers. If it ever janks the grid, the part size is the knob:
    // architecture.md allows 5–10 MB and the api hands the number out.
    bytes = handle.readBytes(part.length);
  } finally {
    handle.close();
  }

  const response = await fetch(url, { method: 'PUT', body: bytes });
  if (response.status === 403) return null;
  if (!response.ok) {
    throw new UploadError({ reason: 'partRefused', part: part.number, status: response.status });
  }
  const etag = response.headers.get('etag');
  if (etag === null) throw new UploadError({ reason: 'noReceipt', part: part.number });
  return etag;
}

/** One file, all the way: announce it, send what is missing, and tell the api it is there. */
async function send(file: QueuedFile, token: string) {
  const source = sourceFile(await MediaLibrary.getAssetInfoAsync(file.assetId));
  let plan = await planFor(file, token, source.size);
  const size = file.size ?? source.size;
  const partSize = plan.upload.part_size;

  const linkFor = (number: number) => {
    const link = plan.upload.parts.find((part) => part.part_number === number)?.url;
    if (link === undefined) throw new UploadError({ reason: 'noLink', part: number });
    return link;
  };

  for (const part of missingParts(size, partSize, file.parts)) {
    let etag = await putPart(linkFor(part.number), source, part);
    if (etag === null) {
      // The hour ran out mid-file. Fresh links, same upload, and this part is the only one that
      // has to be sent again — everything before it is already receipted.
      plan = await planFor(file, token, size);
      // `planFor` throws the etags away if the api's part size moved, and this loop is cutting to
      // the old one: it stops here and the next run starts the file on slices that line up.
      if (plan.upload.part_size !== partSize) throw new UploadError({ reason: 'partSizeChanged' });
      etag = await putPart(linkFor(part.number), source, part);
      if (etag === null) throw new UploadError({ reason: 'partNotTaken', part: part.number });
    }
    file.parts[part.number] = etag;
    // Written down before the next part goes out: an app killed here resumes from this line.
    changed();
  }

  const done = await finishUpload(token, file.memoryId, plan.id, uploadedParts(file.parts));

  // doc-06: asked once, on the very first file this person got into this memory, and asked by the
  // api rather than by anything counted here — the phone has no way of knowing what it uploaded on
  // some other device. Raised here and drawn by the upload screen as the layout's own «Это всё?»
  // sheet: the queue knows the moment, the screen holds the words.
  if (done.first_upload) {
    asking = file.memoryId;
    notify();
  }
}

const askedMemory = () => asking;

/** Which memory is waiting for that answer — `null` while nothing is being asked. */
export function useAskAll(): string | null {
  return useSyncExternalStore(subscribe, askedMemory, askedMemory);
}

/**
 * The answer, and the end of the question. Both answers are a standing and both are said out loud:
 * «Больше ничего» is `done`, «Ещё будет» is `more_coming` — the same one the first upload already
 * left them on, sent again because this time it is their own word and not the api's guess, and
 * because somebody who had said «ждать нечего» earlier is taking that back with this tap.
 *
 * `null` is the question closed without an answer — a tap beside the sheet. Nothing is set then:
 * silence is not a standing.
 */
export function answerAskAll(answer: 'done' | 'more_coming' | null) {
  const memoryId = asking;
  asking = null;
  notify();
  if (answer === null || memoryId === null || session === null) return;
  void setContributionStatus(session, memoryId, answer).catch(() => {
    // Swallowed the way `changed()` swallows a queue it could not write: the material is in, which
    // is the part that mattered, and a status that missed leaves them on «still adding» — the
    // truthful reading of somebody who just uploaded. Not worth a red line over an upload that
    // succeeded, and there is no second moment to ask in.
  });
}

/**
 * Not a failure: the re-issue route answers 409 with the status the row has moved on to, which
 * means every byte is in R2 and the callback got through — the app just never heard it, because
 * that is precisely the moment the connection dropped.
 */
function alreadyIn(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    typeof (error.body as { status?: unknown } | null)?.status === 'string'
  );
}

const waiting = () => queue.find((file) => file.error === undefined);

/** The pump. One file at a time, and only ever one of it running. */
async function run() {
  restore();
  if (running || session === null) return;
  const token = session;
  running = true;
  try {
    for (let next = waiting(); next !== undefined; next = waiting()) {
      try {
        await send(next, token);
        queue = queue.filter((file) => file !== next);
      } catch (error) {
        // Parked, not dropped: offline is the ordinary reason to be here, and the material is
        // still owed to the memory. What is written down is the reason and not a sentence — the
        // screen words it when it draws it.
        // ponytail: everything parks the same way, so a file the api will never take — the row
        // swept away after a day, a membership that ended — is retried until somebody drops the
        // row by hand. Worth splitting permanent from transient the day that stares at anyone.
        if (alreadyIn(error)) queue = queue.filter((file) => file !== next);
        else next.error = failure(error);
      }
      changed();
    }
  } finally {
    running = false;
  }

  // Nothing else would ever kick it while the app stays open and the tunnel ends.
  if (queue.length > 0 && retrying === null) {
    retrying = setTimeout(() => {
      retrying = null;
      wake();
    }, RETRY_MS);
  }
}

/** Clear what parked them and go again — a foreground, that timer, or the button on the screen. */
export function wake() {
  if (queue.length === 0) return;
  for (const file of queue) delete file.error;
  changed();
  void run();
}

/** Take a pick from the grid into the queue. The same file twice is the same one entry. */
export function enqueue(memoryId: string, assets: readonly MediaLibrary.Asset[]) {
  restore();
  const queued = new Set(queue.map((file) => `${file.memoryId}:${file.assetId}`));
  for (const asset of assets) {
    if (queued.has(`${memoryId}:${asset.id}`)) continue;
    queue.push({
      assetId: asset.id,
      memoryId,
      filename: asset.filename,
      kind: asset.mediaType === 'video' ? 'video' : 'photo',
      // RFC 3339 as the api asks for it. A file with no capture date declares none rather than
      // borrowing today's — the montage orders by this, and a wrong date is worse than no date.
      capturedAt: asset.creationTime ? new Date(asset.creationTime).toISOString() : null,
      // Only a video's is looked at, and the api refuses a video without it.
      durationSeconds: asset.mediaType === 'video' ? (asset.duration ?? 0) : null,
      parts: {},
    });
  }
  changed();
  void run();
}

/**
 * Give up on one: the file that has left the phone, or one nobody wants sent after all.
 *
 * Keyed on the pair `enqueue` composes and not on the asset alone — the same photo may be owed to
 * two memories, and dropping it from one screen must not take the other one's copy with it.
 */
export function drop(memoryId: string, assetId: string) {
  queue = queue.filter((file) => file.memoryId !== memoryId || file.assetId !== assetId);
  changed();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  // The first read is also what brings the last run's queue back — cheap, synchronous, once.
  restore();
  return queue;
}

/**
 * The queue as a screen sees it, and the pump that empties it. Called once from the root
 * navigator, the way `usePush` is, so a queue picks itself up on launch whatever screen the app
 * opens on — and again from the upload screen, which is where it is shown.
 */
export function useUploads(): QueuedFile[] {
  const { status, token } = useAuth();

  useEffect(() => {
    session = token;
    // A settled sign-out, not merely an absent token: at launch there is no token either, and a
    // queue left by the last session is exactly what has to survive that.
    if (status === 'signed-out') {
      queue = [];
      // The question goes with the session that raised it: there is nobody left to answer for.
      asking = null;
      changed();
    } else {
      void run();
    }
  }, [status, token]);

  useEffect(() => {
    // «Повтор при возврате в приложение»: the phone that went into the lift comes back with the
    // app in the foreground, and that is the moment worth trying again.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') wake();
    });
    return () => subscription.remove();
  }, []);

  return useSyncExternalStore(subscribe, snapshot);
}
