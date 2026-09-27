// Getting the picked files to R2 (architecture.md, «Хранилище и медиа-пайплайн»): the api signs,
// the phone sends the bytes itself, the api is told when they are there.
//
// A queue and not a loop over a selection, because every way this goes wrong is ordinary on a
// phone — the tunnel, the lift, the app swiped away mid-file. It lives on disk, so it outlives the
// app; it remembers what R2 already took, so a resume sends only what is missing; and it is module
// state rather than screen state, so an upload outlives the screen that started it. Nothing here
// asks what the memory's status is: material goes in during the event and long after the montage
// was made (doc-02).
import { File, FileMode, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import {
  ApiError,
  apiReason,
  finishUpload,
  refreshUpload,
  reportUploadFailure,
  setContributionStatus,
  startUpload,
  type UploadPlan,
} from '@/api';
import { useAuth } from '@/lib/auth';
import {
  missingParts,
  type PartRange,
  partDeadline,
  type QueuedFile,
  type UploadFailure,
  uploadedParts,
} from '@/lib/upload/queue';

/** Where the queue waits between launches. Documents and not cache — nothing may sweep this. */
const QUEUE_FILE = 'uploads.json';

/**
 * How long a parked queue waits before trying itself again, for the tunnel that ends mid-file.
 * Counted from the moment the pump stops, and nothing but the person's own «Повторить» cuts it
 * short (TASK-413).
 */
const RETRY_MS = 15_000;

/**
 * How many of those waits in a row may pass with nothing at all going up before the queue stops
 * trying by itself — five minutes of it. A parked file then waits for the person: «Повторить», or
 * the app coming back to the foreground, which starts the count again.
 */
const RETRIES = 20;

/**
 * A failure the pump names itself, carried as the line to say and not as the sentence — the queue
 * holds no words at all, so nothing in it can be left in yesterday's language (TASK-93). The
 * `Error` message is for a log and never for a person. The gallery and storage are named here,
 * where they fail; what else lands in the pump is named by `failure` below.
 */
class UploadError extends Error {
  constructor(readonly failure: UploadFailure) {
    super(failure.reason);
  }
}

/**
 * Whatever came out of the pump, as the queue keeps it: the pump's own reason, or the api's. What
 * is left after both is a call to the api that got no answer at all — and it goes to the log as it
 * came, the one place a dead api can still be told apart from anything else that ends up here.
 */
function failure(error: unknown): UploadFailure {
  if (error instanceof UploadError) return error.failure;
  if (error instanceof ApiError) {
    return { reason: 'api', status: error.status, said: apiReason(error.body) };
  }
  console.warn('upload parks, the api does not answer:', error);
  return { reason: 'offline' };
}

/** An error as one line: a native one carries the call and its cause on lines of their own. */
const said = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ');

/**
 * What each file last told the api's log. A parked file is tried every fifteen seconds, and the same
 * line every time is a log nobody reads to the end; a file picked again, or a new launch, is a new
 * entry and says it once more.
 */
const reported = new WeakMap<QueuedFile, string>();

/**
 * The phone refusing a file, sent to the api as well as drawn on the screen — the one failure that
 * otherwise never leaves the phone it happened on (TASK-434). Nothing waits on it: a report that
 * does not get through is a line in the phone's own log and nothing more.
 */
function report(file: QueuedFile, failure: UploadFailure) {
  if (failure.reason !== 'unreadable' && failure.reason !== 'iCloud') return;
  const line = `${failure.reason}: ${failure.detail}`;
  if (reported.get(file) === line) return;
  reported.set(file, line);
  reportUploadFailure({
    upload_failure: failure.reason,
    detail: failure.detail,
    file: file.filename,
    memory: file.memoryId,
    ...(file.mediaId === undefined ? {} : { media: file.mediaId }),
    platform: `${Platform.OS} ${Platform.Version}`,
  }).catch((error) => console.warn('the upload failure does not reach the api:', error));
}

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
/** Timed retries since a part last went up, or since the person last asked. */
let idle = 0;
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
      queue = (JSON.parse(saved.textSync()) as QueuedFile[]).map(
        ({ error, cloud, ...file }) => file,
      );
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
 * The gallery's own entry for a file, with the download from iCloud allowed or refused. Nothing at
 * all is an entry the gallery no longer has — both platforms answer that way rather than with an
 * error. A throw is the library refusing to answer anything: a grant taken back since the pick.
 */
async function assetInfo(
  file: QueuedFile,
  shouldDownloadFromNetwork: boolean,
): Promise<MediaLibrary.AssetInfo | null> {
  try {
    return await MediaLibrary.getAssetInfoAsync(file.assetId, { shouldDownloadFromNetwork });
  } catch (error) {
    console.warn(`${file.filename} cannot be read off the gallery:`, error);
    throw new UploadError({
      reason: 'unreadable',
      detail: `getAssetInfoAsync, download ${shouldDownloadFromNetwork ? 'on' : 'off'}: ${said(error)}`,
    });
  }
}

/**
 * The bytes behind that entry when the phone has them to open, and otherwise what stood in the way,
 * as the phone put it — no `localUri` at all is the answer for a photo whose original is still in
 * iCloud.
 *
 * `localUri` is the actual file and the only thing the parts can be cut from; `uri` is the library's
 * own handle — `ph://…` on iOS — which is not a path and which nothing here can open.
 */
function openable(asset: MediaLibrary.AssetInfo): File | string {
  if (!asset.localUri) return `no localUri, isNetworkAsset ${asset.isNetworkAsset}`;
  try {
    const source = new File(asset.localUri);
    if (source.exists && source.size > 0) return source;
    return `${asset.localUri}: exists ${source.exists}, size ${source.size}`;
  } catch (error) {
    return `${asset.localUri}: ${said(error)}`;
  }
}

/**
 * The file behind a gallery entry, brought down from iCloud first if that is where the original is.
 * On an iPhone with «Оптимизация хранения» on — the ordinary state of a full phone — the gallery
 * holds a thumbnail and the original is in iCloud, so there is no file to cut parts from until it
 * has come down (TASK-419).
 *
 * Which is why the entry is asked for twice, and the first time with the download turned off: iOS
 * fills `isNetworkAsset` in that mode alone, so it is the one answer that tells a photo waiting in
 * iCloud from a file that genuinely cannot be read. Asked with the download on — the library's own
 * default — the two come back identical: an entry with no `localUri` on it and no word why.
 *
 * Nothing here is the server, which nobody has asked anything yet.
 */
async function sourceFile(file: QueuedFile): Promise<File> {
  const asset = await assetInfo(file, false);
  if (!asset) throw new UploadError({ reason: 'gone' });
  const onPhone = openable(asset);
  if (typeof onPhone !== 'string') return onPhone;

  // Nothing on the phone, so the second ask — the one with the download on — is the download
  // itself. It goes out whatever the flag said: an original iOS did not flag as iCloud's but still
  // will not hand over locally (a shared album, a request it cancelled) is worth the one attempt.
  // The flag decides what the person is told, not whether it is worth trying.
  const cloud = asset.isNetworkAsset === true;
  if (cloud) {
    console.info(`${file.filename} comes down from iCloud before it goes up`);
    // Said on the screen while it happens, in the sending's own block: the download takes as long
    // as the original and the line make it, and a person watching a bar at nought is owed the
    // reason. The library reports no progress for it, so it is the state and never a figure.
    file.cloud = true;
    changed();
  }
  try {
    const brought = await assetInfo(file, true);
    const down = brought === null ? 'no entry on the second ask' : openable(brought);
    if (typeof down !== 'string') return down;
    // Parked and not dropped: iOS carries a download it has started on in the background, and the
    // queue's own pause brings this file round again — by then it is ordinarily on the phone.
    console.warn(
      `${file.filename} does not come down from ${cloud ? 'iCloud' : 'the gallery'}, the file parks: ${down}`,
    );
    throw new UploadError({ reason: cloud ? 'iCloud' : 'unreadable', detail: down });
  } finally {
    if (cloud) {
      delete file.cloud;
      changed();
    }
  }
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
 * One slice's bytes, off the phone. A read that breaks here is the file's, never the network's.
 *
 * Typed as the handle hands them back rather than as a plain `Uint8Array`: a view over a
 * `SharedArrayBuffer` is not a body `fetch` will take, and the two say so differently.
 */
function readPart(source: File, part: PartRange): Uint8Array<ArrayBuffer> {
  try {
    // Read-only, and said so: with no mode the library opens a `file://` for reading *and writing*,
    // and a gallery original is the phone's to read and never ours to write (TASK-434).
    const handle = source.open(FileMode.ReadOnly);
    try {
      handle.offset = part.start;
      // ponytail: a synchronous read of one part (8 MB by default) on the JS thread — the only
      // read-at-an-offset the platform offers. If it ever janks the grid, the part size is the
      // knob: architecture.md allows 5–10 MB and the api hands the number out.
      return handle.readBytes(part.length);
    } finally {
      handle.close();
    }
  } catch (error) {
    console.warn(`part ${part.number} cannot be read off the phone:`, error);
    throw new UploadError({
      reason: 'unreadable',
      detail: `read part ${part.number}: ${said(error)}`,
    });
  }
}

/**
 * One slice, straight to storage. Answers with the etag storage receipts it with — or, for the two
 * failures a fresh link and one more try can fix, with the reason to park on if that try fails too.
 *
 * One is a link that has outlived the time the api signed it for. Google says so with a 400 whose
 * body carries the code `ExpiredToken`, and the body is read for that alone; a 403 is taken the same
 * way, which is how R2 and MinIO say it. The other is storage not answering at all — the connection
 * dropped, or nothing came back within `partDeadline` — which is the network between this phone and
 * storage, and not the api.
 */
async function putPart(
  url: string,
  source: File,
  part: PartRange,
): Promise<string | UploadFailure> {
  const bytes = readPart(source, part);
  const abort = new AbortController();
  // Without this a connection that died quietly holds the whole queue for as long as it likes.
  const timer = setTimeout(() => abort.abort(), partDeadline(part.length));
  let status: number | undefined;
  let response: Response;
  let expired: boolean;
  try {
    response = await fetch(url, { method: 'PUT', body: bytes, signal: abort.signal });
    status = response.status;
    expired =
      status === 403 ||
      (status === 400 && (await response.text()).includes('<Code>ExpiredToken</Code>'));
  } catch (error) {
    console.warn(`part ${part.number} does not reach storage:`, error);
    return { reason: 'storageOffline', part: part.number, status };
  } finally {
    clearTimeout(timer);
  }
  if (expired) return { reason: 'partNotTaken', part: part.number };
  if (!response.ok) {
    throw new UploadError({ reason: 'partRefused', part: part.number, status: response.status });
  }
  const etag = response.headers.get('etag');
  if (etag === null) throw new UploadError({ reason: 'noReceipt', part: part.number });
  return etag;
}

/** One file, all the way: announce it, send what is missing, and tell the api it is there. */
async function send(file: QueuedFile, token: string) {
  const source = await sourceFile(file);
  let plan = await planFor(file, token, source.size);
  const size = file.size ?? source.size;
  const partSize = plan.upload.part_size;

  const linkFor = (number: number) => {
    const link = plan.upload.parts.find((part) => part.part_number === number)?.url;
    if (link === undefined) throw new UploadError({ reason: 'noLink', part: number });
    return link;
  };

  for (const part of missingParts(size, partSize, file.parts)) {
    let sent = await putPart(linkFor(part.number), source, part);
    if (typeof sent !== 'string') {
      // The link ran out mid-file, or storage went silent on it — and a link that hung for minutes
      // is that much nearer its hour. Fresh links, same upload, and this part is the only one that
      // has to be sent again — everything before it is already receipted.
      plan = await planFor(file, token, size);
      // `planFor` throws the etags away if the api's part size moved, and this loop is cutting to
      // the old one: it stops here and the next run starts the file on slices that line up.
      if (plan.upload.part_size !== partSize) throw new UploadError({ reason: 'partSizeChanged' });
      sent = await putPart(linkFor(part.number), source, part);
      // One fresh set per pass: twice is no longer a stale link or a blip, and the file parks.
      if (typeof sent !== 'string') throw new UploadError(sent);
    }
    file.parts[part.number] = sent;
    idle = 0;
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
  // The pause starts when the pump stops. One still ticking from before this round would clear,
  // mid-round, a reason this round parked a file with seconds ago — and try it again on the spot.
  if (retrying !== null) clearTimeout(retrying);
  retrying = null;
  try {
    for (let next = waiting(); next !== undefined; next = waiting()) {
      try {
        await send(next, token);
        queue = queue.filter((file) => file !== next);
        idle = 0;
      } catch (error) {
        // Parked, not dropped: offline is the ordinary reason to be here, and the material is
        // still owed to the memory. What is written down is the reason and not a sentence — the
        // screen words it when it draws it.
        // ponytail: everything parks the same way, so a file the api will never take — the row
        // swept away after a day, a membership that ended — is retried until somebody drops the
        // row by hand. Worth splitting permanent from transient the day that stares at anyone.
        if (alreadyIn(error)) queue = queue.filter((file) => file !== next);
        else {
          next.error = failure(error);
          report(next, next.error);
        }
      }
      changed();
    }
  } finally {
    running = false;
  }
  retryLater();
}

/**
 * The next round, one pause from now — the only way the queue tries again by itself. Nothing else
 * would ever kick it while the app stays open and the tunnel ends.
 */
function retryLater() {
  if (queue.length === 0 || retrying !== null || idle >= RETRIES) return;
  retrying = setTimeout(() => {
    retrying = null;
    idle += 1;
    retry();
  }, RETRY_MS);
}

/** Clear what parked them and go again. */
function retry() {
  for (const file of queue) delete file.error;
  changed();
  void run();
}

/** «Повторить» on the screen: the person's own say-so, the one retry that waits for no pause. */
export function wake() {
  if (queue.length === 0) return;
  idle = 0;
  retry();
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
 * Give up on some: the files that have left the phone, or ones nobody wants sent after all — all of
 * them in one write, since the screen lets go of every file parked for one reason at once.
 *
 * Keyed on the pair `enqueue` composes and not on the asset alone — the same photo may be owed to
 * two memories, and dropping it from one screen must not take the other one's copy with it.
 */
export function drop(memoryId: string, ...assetIds: string[]) {
  const leaving = new Set(assetIds);
  queue = queue.filter((file) => file.memoryId !== memoryId || !leaving.has(file.assetId));
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
    // app in the foreground, and that is the moment the queue starts trying again — one pause from
    // now, not on the spot. iOS goes inactive and back for a pulled-down notification, a system
    // prompt, a glance at the app switcher, and a retry on each of those is a parked file blinking
    // on and off faster than any pause (TASK-413). A wait already ticking is left to run out: a
    // timer that fell due while the app was away fires the moment it is back.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      idle = 0;
      if (!running) retryLater();
    });
    return () => subscription.remove();
  }, []);

  return useSyncExternalStore(subscribe, snapshot);
}
