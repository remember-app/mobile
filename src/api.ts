import { currentLanguage, type Language } from '@/language';
import { strings } from '@/strings';

// The API base URL. Expo inlines EXPO_PUBLIC_* at build time, so it has to be
// read as a literal property access — destructuring or dynamic keys stay undefined.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * The words, read at the moment one is needed. Nothing in this file is a component, so there is no
 * `useStrings()` to hang it on — and a call, not a captured set, is what keeps a language switched
 * after this module was imported from being missed.
 */
const say = () => strings[currentLanguage()];

const TIMEOUT_MS = 5000;

/** The account as the api returns it. `username` is null until it is claimed. Duplicated, same reason. */
export type User = { id: string; username: string | null; name: string | null; email: string | null };

/** What every sign-in endpoint answers with: the session token plus the account it belongs to. */
export type Session = { token: string; user: User };

/** A non-2xx answer. Carries the status and parsed body so screens can branch on 401/409/501/… */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(describe(status, body));
    this.name = 'ApiError';
  }
}

/**
 * The api's own sentence for a failure, when it sent one. Handed out on its own as well as inside
 * the message, for the one place that has to keep a failure and word it later (`@/upload-queue`).
 *
 * ponytail: it comes down the wire in whatever language the api writes — English today. The api is
 * now told which language the caller reads (TASK-91), but it spends that on what it writes
 * unprompted — the mails and the pushes — and not on its answer to a request. The two lines this
 * side words itself are already both.
 */
export function apiReason(body: unknown): string | undefined {
  const reason =
    typeof body === 'object' && body !== null && 'error' in body
      ? (body as { error: unknown }).error
      : undefined;
  return typeof reason === 'string' ? reason : undefined;
}

function describe(status: number, body: unknown): string {
  if (status === 429) return say().error.tooMany;
  return apiReason(body) ?? say().error.status(status);
}

/** The line a screen can show for a failed call: the api's own wording, or a network one. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : say().error.offline;
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  /** Longer than the default only where the api is waiting on something slower than itself. */
  timeout?: number;
};

async function request<T>(
  path: string,
  { method = 'GET', body, token, timeout = TIMEOUT_MS }: Options = {},
): Promise<T> {
  const abort = new AbortController();
  // Without this an unreachable host hangs for a minute and the screen stays on "loading".
  const timer = setTimeout(() => abort.abort(), timeout);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        // A body-less POST must not claim JSON — Fastify rejects an empty JSON body with 400.
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // A proxy or a crash can answer with something that is not JSON; keep it as the raw text.
      parsed = text;
    }
    if (!response.ok) throw new ApiError(response.status, parsed);
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask for the six digits that open the way in (TASK-138). The api answers 200 whether or not the
 * address is registered, so this says nothing about who is already here.
 *
 * The language rides along because at this point there is no session to hang it on — the address
 * is all the api knows about whoever asked, and the letter has to be written in the language of
 * the app that asked (TASK-85). Every later sync goes through `putLanguage` instead.
 *
 * `code` comes back only where the api has its development door open — an address on `test.test`,
 * off a production server — and it is the same digits the letter would have carried, handed
 * straight back. Anywhere that really posts the letter, the answer is the bare `ok`.
 */
export function startEmailSignIn(email: string): Promise<{ ok: true; code?: string }> {
  return request('/auth/email/start', {
    method: 'POST',
    body: { email, language: currentLanguage() },
  });
}

/**
 * Trade the address and the code from the letter for a session. The address goes with it because
 * the code is only ever the secret *of an address*: six digits on their own would be a million
 * codes shared by everybody signing in at once.
 *
 * 401 for every way of failing — wrong digits, expired, spent, attempts used up, address unknown.
 * The api answers one way on purpose, and so this side says one thing back.
 */
export function verifyEmailCode(email: string, code: string): Promise<Session> {
  return request('/auth/email/verify', { method: 'POST', body: { email, code } });
}

/**
 * Accept the one user agreement there is (doc-04, decision-9, TASK-139). No body at all: what is
 * being accepted is the pilot's single agreement, whose text the app ships, and a version the
 * client names is a version the client could get wrong.
 *
 * Idempotent — the moment it answers with is the one the person actually agreed at, so pressing
 * «Принимаю» a second time (a lost answer, a session picked up again before the username was
 * claimed) costs nothing and moves nothing.
 */
export function acceptConsent(token: string): Promise<{ accepted_at: string }> {
  return request('/me/consent', { method: 'POST', token });
}

/** Trade an Apple identity token for a session. 501 while the provider has no keys. */
export function signInWithApple(idToken: string): Promise<Session> {
  return request('/auth/apple', { method: 'POST', body: { idToken } });
}

/** Trade a Google identity token for a session. 501 while the provider has no keys. */
export function signInWithGoogle(idToken: string): Promise<Session> {
  return request('/auth/google', { method: 'POST', body: { idToken } });
}

/** The account behind a session token. 401 once the token stops being honoured. */
export function fetchMe(token: string): Promise<User> {
  return request('/me', { token });
}

/**
 * Claim or change the username. 409 when taken, 400 when the format is wrong, and 403
 * («consent required») on a first claim by an account that has not accepted the agreement —
 * holding a username *is* being registered, so that is the one gate registration has (TASK-139).
 * Changing a name later never asks again.
 */
export function putUsername(token: string, username: string): Promise<User> {
  return request('/me/username', { method: 'POST', body: { username }, token });
}

/**
 * Tell the account which of the two languages its owner reads in. What it is for is everything the
 * api writes to a person who is not looking at the app — the invite mails, the pushes — so each one
 * lands in their own language and not in the sender's. Answers with the account, same as
 * `putUsername`; nothing here reads it, the app already turned before the call was made.
 */
export function putLanguage(token: string, language: Language): Promise<User> {
  return request('/me/language', { method: 'POST', body: { language }, token });
}

/**
 * The question `putUsername` answers by trying, asked without trying — so the field can say «free»
 * while it is still being typed. The caller's own current username is free (re-sending it claims
 * nothing), and a malformed one is a 400 rather than a `true` the submit would then refuse. Only an
 * answer about the name still in the field is worth anything: the claim is what the 409 guards.
 */
export function checkUsername(token: string, username: string): Promise<{ available: boolean }> {
  return request(`/me/username/available?username=${encodeURIComponent(username)}`, { token });
}

/**
 * The three public fields the api hands out about somebody who is not you: no email, ever. It is
 * what `GET /users` answers and what a contact is, and the same shape a roster row is built on —
 * so `memberName` and `memberHandle` name one of these as readily as a member.
 */
export type Contact = Omit<User, 'email'>;

/**
 * Somebody by their exact username — no prefixes and no fuzzy matching, which would turn this into
 * a directory of everybody rather than a way to reach a person you already know. 404 when nobody
 * holds the name, and a name nobody could ever hold answers that same 404 rather than a 400.
 */
export function findUser(token: string, username: string): Promise<Contact> {
  return request(`/users?username=${encodeURIComponent(username)}`, { token });
}

/**
 * The caller's own contacts (doc-10), by username. No id in the route because there is no other
 * list to ask for: a contact list is one-way and private, so being on somebody's grants nothing and
 * reveals nothing.
 */
export function listContacts(token: string): Promise<Contact[]> {
  return request('/me/contacts', { token });
}

/**
 * Save somebody by their exact username. 404 when nobody holds it and 400 on one's own name;
 * saving somebody already saved is a plain 200, which is what makes «Сохранить» safe to press
 * beside a person who is already on the list.
 */
export function addContact(token: string, username: string): Promise<Contact> {
  return request('/me/contacts', { method: 'POST', body: { username }, token });
}

/** Drop one. 404 for somebody who was never on the list — and for anybody on another person's. */
export function removeContact(token: string, userId: string): Promise<{ ok: true }> {
  return request(`/me/contacts/${userId}`, { method: 'DELETE', token });
}

/** Where the caller stands in a memory. Duplicated from the api, same reason as `User`. */
export type MemberRole = 'organizer' | 'contributor' | 'viewer';

/**
 * How much material is still owed (doc-06). The first two are the api's own to write — an invite
 * leaves `not_started` behind and the first upload that lands moves it to `more_coming` — and the
 * last two are the member's own word. It grants and denies nothing: «статус не режет права».
 */
export type ContributionStatus = 'not_started' | 'more_coming' | 'done' | 'nothing';

/**
 * A memory as both /memories routes return it: the row plus the caller's own role.
 * Timestamps arrive as RFC 3339 strings (JSON has no date), and `storage_bytes` as a
 * string because it is a bigint server-side. Duplicated here on purpose: no shared types package.
 */
export type Memory = {
  id: string;
  organizer_id: string;
  title: string;
  event_start: string;
  event_end: string | null;
  storage_bytes: string;
  media_count: number;
  /**
   * Up to four signed thumbnail urls, most recently captured first — the frames the card draws.
   * Only ready media has one, so this is a tail of `media_count` and never all of it; empty
   * while nothing is processed yet, or when the api has no bucket configured.
   */
  recent_thumbnail_urls: string[];
  /**
   * The frame the organizer chose as this memory's face (spec 10.8.3), and the signed link to its
   * preview — signed and living exactly as long as the ones in the tail above. Both are `null`
   * until somebody picks one, and then the card draws what it drew before the cover existed. The
   * tail does not depend on it either way; which of the two a card draws is the client's own call.
   */
  cover_media_id: string | null;
  cover_thumbnail_url: string | null;
  montage_count: number;
  created_at: string;
  role: MemberRole;
  /** How many people are in it, the organizer included. */
  member_count: number;
  /**
   * How many of them have already brought their material — the two terminal standings, «всё
   * загрузил» and «ждать нечего» (doc-06, `hasShared` below). This is «7 из 9 уже скинули свои
   * кадры» on the card, counted by the listing itself so the main screen makes no request per card.
   */
  contributed_member_count: number;
};

/** Every memory the caller organizes or belongs to, newest event first. 401 once the token dies. */
export function listMemories(token: string): Promise<Memory[]> {
  return request('/memories', { token });
}

/**
 * Create one, as its organizer. Both dates must be RFC 3339 *with an offset* — a bare
 * `2026-09-02` is a 400, as is a blank title or an end before the start.
 */
export function createMemory(
  token: string,
  memory: { title: string; event_start: string; event_end?: string },
): Promise<Memory> {
  return request('/memories', { method: 'POST', body: memory, token });
}

/**
 * Edit one — the organizer's alone (403 for anybody else), and the one route behind the pencil on
 * the settings screen: the name, the days and the cover are three things changed in one press
 * (spec 10.8.3). Only what was touched goes up; an empty body is a 400, because answering 200 to
 * «change nothing» would claim something changed. The dates keep the same rules creating one has —
 * RFC 3339 with an offset, and a window checked as the row will stand, not as it was sent.
 *
 * `cover_media_id` is a ready frame of this same memory, and `null` takes the cover off. A frame of
 * another memory, one the worker has not finished, and an id behind which there is nothing are one
 * 404 between them.
 *
 * Answers with the whole card — counters, tail of frames and cover — so the screen replaces what it
 * holds instead of reading the listing a second time.
 */
export function updateMemory(
  token: string,
  memoryId: string,
  patch: {
    title?: string;
    event_start?: string;
    event_end?: string | null;
    cover_media_id?: string | null;
  },
): Promise<Memory> {
  return request(`/memories/${memoryId}`, { method: 'PATCH', body: patch, token });
}

/** A roster row: the three public fields the api hands out, plus where that person stands. */
export type Member = Contact & {
  role: MemberRole;
  /**
   * `null` for a `viewer` and for nobody else: they were never asked to bring anything, so «ничего
   * не загрузил» over their name would be a reproach for work they were not given. A null, not a
   * missing key — one shape of row for everybody.
   */
  contribution_status: ContributionStatus | null;
  /**
   * How many frames that person brought *to this memory*. Counted by the api off the same records
   * the gallery lists (TASK-190), so the figure on the roster and the one in the gallery agree —
   * this screen used to read the whole gallery to count it itself.
   */
  media_count: number;
};

/**
 * What a person is called on screen: the name they gave, else the username they claimed, else the
 * word for a stranger. One copy, for the reason `mayContribute` has one — the roster names people
 * and so does every open frame, and the two must say the same thing about the same person. `null`
 * is «not on the roster», which a frame from somebody who has since left the memory hits.
 */
export const memberName = (member: Pick<Member, 'name' | 'username'> | null) =>
  member?.name ?? member?.username ?? say().memory.someone;

/**
 * The `@username` written under that name — and nothing at all when the username is already the
 * name above it, because everybody who signed in by email is called by their username and printing
 * it twice spends a line saying nothing. The other half of `memberName`, and here beside it for the
 * same reason: the roster row and the profile head both draw this pair, and the day the rule
 * changes it has to change once.
 */
export const memberHandle = (member: Pick<Member, 'name' | 'username'> | null) =>
  member?.username && member.username !== memberName(member) ? `@${member.username}` : undefined;

/** What may actually be granted. Never `organizer`: a memory has exactly one, its creator. */
export type InviteRole = Exclude<MemberRole, 'organizer'>;

/**
 * «Добавление» and up — the matrix row that governs both bringing material and bringing people
 * (architecture.md, «Проверка прав»). One copy, because two screens gate buttons on it and the
 * one that drifted would be the one nobody noticed. The api is the authority either way; this
 * only decides whether a button is drawn.
 */
export const mayContribute = (role: MemberRole | null) =>
  role === 'organizer' || role === 'contributor';

/**
 * Whether that person is somebody the memory is still waiting on (doc-06). Both terminal standings
 * count as brought — «всё загрузил» and «ждать нечего» are two different answers to the same
 * question and either one ends it — while the two before them, never started and still adding, are
 * both material still owed. One copy for the reason `mayContribute` has one: the roster's «7 из 9
 * скинули» and the card's line on the main screen are one rule, and the api counts its own tally
 * (`contributed_member_count`) by the very same one.
 */
export const hasShared = (status: ContributionStatus | null) =>
  status === 'done' || status === 'nothing';

/** The one live invite link of a memory: the raw token and the level following it grants. */
export type Invite = { token: string; role: InviteRole };

/** Everyone in a memory, in the order they joined. Any member may read it, a viewer included. */
export function listMembers(token: string, memoryId: string): Promise<Member[]> {
  return request(`/memories/${memoryId}/members`, { token });
}

/**
 * Add somebody by their exact username. 404 when nobody holds it, 403 when the caller is a
 * viewer. Re-adding an existing member is a plain 200 that answers with the role they already
 * had — so «added» and «was already in» can only be told apart against the roster on screen.
 */
export function inviteByUsername(
  token: string,
  memoryId: string,
  username: string,
  role: InviteRole,
): Promise<Member> {
  return request(`/memories/${memoryId}/members`, {
    method: 'POST',
    body: { username, role },
    token,
  });
}

/** The memory's live link, minted on the first ask rather than at creation. 403 for a viewer. */
export function fetchInvite(token: string, memoryId: string): Promise<Invite> {
  return request(`/memories/${memoryId}/invite`, { token });
}

/** Revoke the live link and mint a fresh one; the old token stops opening anything. */
export function rotateInvite(token: string, memoryId: string, role: InviteRole): Promise<Invite> {
  return request(`/memories/${memoryId}/invite`, { method: 'POST', body: { role }, token });
}

/**
 * Drop a membership: the organizer showing anyone else out, or anybody walking out on their
 * own id. 409 when the organizer aims at themselves — the role is never handed over in MVP.
 */
export function removeMember(
  token: string,
  memoryId: string,
  userId: string,
): Promise<{ ok: true }> {
  return request(`/memories/${memoryId}/members/${userId}`, { method: 'DELETE', token });
}

/**
 * The caller's own word about their material: «ещё будет», «это всё» or «ждать нечего». Three of the
 * four, in any order and as often as they like — `not_started` is the only one the api keeps to
 * itself, since it is what an invite leaves behind and asking for it back says nothing. So «всё
 * загрузил» is never a door that shuts (doc-06). `viewer` is the one role refused (403), and nobody
 * is waiting on them anyway: they were never asked to bring anything and are counted in nothing.
 * There is no `:userId` in the route because a status is never set on somebody else.
 */
export function setContributionStatus(
  token: string,
  memoryId: string,
  status: 'more_coming' | 'done' | 'nothing',
): Promise<{ status: ContributionStatus }> {
  return request(`/memories/${memoryId}/contribution-status`, {
    method: 'POST',
    body: { status },
    token,
  });
}

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
  size_bytes: string;
  captured_at: string | null;
  width: number | null;
  height: number | null;
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
   * either direction on the first step of the order (`@/montage`).
   */
  screening_rejected: boolean | null;
  screening_reason: string | null;
};

/**
 * Everything in a memory, oldest shot first — the order the montage would play it in. Any member
 * reads it, a viewer included. 503 while the api has no bucket configured.
 */
export function listMedia(token: string, memoryId: string): Promise<MediaItem[]> {
  return request(`/memories/${memoryId}/media`, { token });
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
  /** The place as coordinates and nothing else: no geocoder, so there is no name to show. */
  latitude: number | null;
  longitude: number | null;
  /** Who brought it, and how many frames that person brought to *this* memory. */
  uploaded_by: Contact & { media_count: number };
  /**
   * The finished montages this frame stands in, newest first, and the second it stands at in each.
   * One frame can legitimately appear twice in the same montage, so the id alone is not a key.
   */
  montages: { id: string; duration_seconds: number | null; start_seconds: number }[];
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

/**
 * A label (doc-13) — a box with a name and a colour inside one memory, as the asker sees it. Shared
 * means everybody in the memory sees it; private means nobody but its owner does, and somebody
 * else's private label leaves no trace in any answer at all.
 *
 * `can_edit` (rename, recolour, delete) and `can_add_media` (put frames in) are **the server's own
 * answer about this asker**, worked out by the same function that refuses the write routes
 * (`labelDenial`, api README). The app never repeats the rule: a button is drawn where the server
 * said it may be. Neither of them is `mine` — a shared label is edited by its maker and by the
 * organizer, and filled by anybody who may add material at all.
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
export function listLabels(token: string, memoryId: string): Promise<Label[]> {
  return request(`/memories/${memoryId}/labels`, { token });
}

/**
 * Make one — and, from picking mode, fill it in the same breath: the label and its frames appear
 * together or not at all. Answers with the row the listing would give, so the sheet that made it
 * puts it straight into its own list without asking again.
 *
 * `shared` is settled here and never again (decision-12): the api has no way to move a box between
 * shared and private after the fact. 403 when a viewer tries to make a shared one.
 */
export function createLabel(
  token: string,
  memoryId: string,
  label: { title: string; color: number; shared: boolean; media_ids?: string[] },
): Promise<Label> {
  return request(`/memories/${memoryId}/labels`, { method: 'POST', body: label, token });
}

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
 * not in it is not an error. One frame in the batch this person may not take out refuses the whole
 * batch (403): they marked frames and have to hear «нельзя», not find half of them still filed.
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
 * screen's. The shelf's own order is the layout's, and it lives in `@/montage` beside the running
 * time of each one.
 */
export type MusicTrackId = 'bright' | 'warm' | 'calm' | 'night' | 'road';

/**
 * Which way up the finished video stands (doc-03). The api takes these two and nothing else, and
 * leaves it out as «horizontal» — which is what every montage was before the choice existed.
 */
export type MontageOrientation = 'landscape' | 'portrait';

/**
 * What was asked for at the order — the wishes doc-03 allows, every one of them optional. Named once
 * and shared by both ends of the round trip: this is the body `orderMontage` sends and it is
 * `Montage.params` coming back, which is the same shape on purpose, the way `Original` is one shape
 * for both download routes.
 *
 * The four steps of the order (spec 8) fill them in: the frames picked out by hand, the story, the
 * music, the length and the shape. `@/montage` is what turns a wizard's state into this.
 */
export type MontageWishes = {
  /**
   * Any whole number of seconds inside this memory's own range, which is the material's and not a
   * constant — `previewMontage` is the one place it is known, and the length step reads it from
   * there rather than working it out. Left out, the api picks its own and clamps it, so «не
   * сказали» is always a legal order and never a 400.
   */
  target_seconds?: number;
  /** What the organizer said the video is about, in their own words. */
  story_text?: string;
  /** The frames settled by hand: these go in whatever the worker thinks, those stay out. */
  include_media_ids?: string[];
  exclude_media_ids?: string[];
  /**
   * The music, in the order it plays: ids off the worker's shelf and keys of tracks the organizer
   * sent up themselves (`music/<uuid>`), mixed freely. A list and not one answer since doc-03 grew
   * the step — and the app sends it on every order, empty included, because an empty list is «без
   * музыки, живой звук из видео» and a missing one is only «ничего не сказали».
   */
  music_tracks?: string[];
  /** How to use those tracks, in words. Only ever with a non-empty `music_tracks` — 400 without. */
  music_note?: string;
  orientation?: MontageOrientation;
  /**
   * ⚠️ The one-track fields the api took before the list existed. The app no longer sends either —
   * they are here because `Montage.params` of an older order still carries them, and the card of
   * that movie still has to say what it was cut to.
   */
  music_track_id?: MusicTrackId;
  music_track_key?: string;
};

/**
 * A video assembled out of a memory (doc-03). The row as the api hands it out, minus its storage
 * key: `video_url` is the signed link standing in for it, and it is there only while the montage is
 * `ready` — before that it is null, which is «ещё не готово» and not an error, exactly as the
 * gallery's missing derivatives are. `duration_seconds` is the length the worker actually made,
 * so it too arrives only with the finished video; `params` is what was asked for at the order.
 */
export type Montage = {
  id: string;
  memory_id: string;
  ordered_by: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  duration_seconds: number | null;
  params: MontageWishes;
  /** The worker's own line about why it fell over. Only ever set on a `failed` one. */
  error_text: string | null;
  created_at: string;
  video_url: string | null;
  /** The still off the finished video, signed the same way `video_url` is, and null while there is
      none — an older montage cut before posters were kept, or one not yet ready. */
  poster_url: string | null;
  /**
   * How far the making has got — the five stages in pipeline order with a state each, and nothing
   * else about them: the card in the strip draws «3 из 5» and five bars out of this without opening
   * anybody's journal (api README, «Список роликов»).
   *
   * `null` on a finished montage and on one the worker has not opened yet — on the first there is
   * nothing left to show, on the second nothing yet — and absent altogether from the answer `retry`
   * gives back, which is why it is optional as well as nullable.
   */
  stages?: MontageStep[] | null;
};

/** One of the five as the list reports it: where it stands, and not a word more. */
export type MontageStep = { stage: MontageStageCode; state: MontageStage['state'] };

/**
 * Every montage of a memory, newest first. Any member reads it, a viewer included — the video is
 * the reward for everybody who brought material. 503 while the api has no bucket configured.
 */
export function listMontages(token: string, memoryId: string): Promise<Montage[]> {
  return request(`/memories/${memoryId}/montages`, { token });
}

/**
 * The six ready-made films of `MontageTemplate` (spec 8), by the api's own ids and in the order the
 * screen draws them. The order of the answer is the order of the tiles and does not change.
 */
export type MontageTemplateId =
  | 'for_myself'
  | 'quick'
  | 'report'
  | 'short_form'
  | 'parents'
  | 'dopamine';

/**
 * One template: a filled-in order and nothing more than one. What comes back here is what goes out
 * in `orderMontage`, minus the `id` and plus whatever the person changed on the way — which is the
 * whole of the autopilot (doc-03).
 *
 * The story is written on the server, in the reader's own language and with this memory's name and
 * dates already in it, and the length comes clamped to what the material can carry. What is *not*
 * here is the name on the tile: those six words are the app's own, kept in `@/strings` by id.
 */
export type MontageTemplate = {
  id: MontageTemplateId;
  story_text: string;
  target_seconds: number;
  orientation: MontageOrientation;
  music_tracks: string[];
  music_note: string | null;
};

/** The organizer's alone, 403 for anybody else — nobody but them can order the film. */
export function listMontageTemplates(token: string, memoryId: string): Promise<MontageTemplate[]> {
  return request(`/memories/${memoryId}/montage-templates`, { token });
}

/**
 * «Итог перед монтажом» (spec 8, `MontageSummary`): what the order would come to, worked out by the
 * api off the very same body the order sends. The numbers are the frames that would actually go in
 * — everything ready, minus `exclude_media_ids` — and the length range is this memory's own.
 *
 * The app never counts any of this itself: the floor and the ceiling of the length step, the people
 * in the film and the wait in minutes all have one source, and it is this. Nothing is written by
 * it, so a screen may ask as often as it likes; every refusal the order has, this has too, in the
 * same words — a summary that agreed to something the order would turn down is worse than none.
 */
export type MontagePreview = {
  photos: number;
  videos: number;
  /** How many different people brought those frames. */
  people: number;
  min_seconds: number;
  max_seconds: number;
  /** What the order would write down: what was asked for, or the api's own, clamped to the range. */
  target_seconds: number;
  orientation: MontageOrientation;
  /** Roughly how long the making would take. A bearing and not a promise — the api says so too. */
  estimate_minutes: number;
};

export function previewMontage(
  token: string,
  memoryId: string,
  wishes: MontageWishes,
): Promise<MontagePreview> {
  return request(`/memories/${memoryId}/montages/preview`, {
    method: 'POST',
    body: wishes,
    token,
  });
}

/**
 * «Смонтируй ролик» — the organizer's alone, 403 for anybody else. Every wish may be left out: the
 * api fills the length in itself and clamps it, an empty list of tracks is a film with the video's
 * own sound, and no orientation is horizontal. 409 when there is too little material to cut
 * anything out of, and the body then carries how much there is against how much is needed; 400 for
 * a frame named as both in and out, for a frame that is not this memory's, for a track that is
 * neither off the shelf nor this memory's, and for a note about music nobody picked.
 */
export function orderMontage(
  token: string,
  memoryId: string,
  wishes: MontageWishes,
): Promise<Montage> {
  return request(`/memories/${memoryId}/montages`, { method: 'POST', body: wishes, token });
}

/**
 * Queue a fallen montage again — the organizer's too. The same row goes back in the queue rather
 * than a second one being written, so the answer is the montage as it now stands. 409 when it is
 * not a failed one, which is «somebody already pressed this».
 */
export function retryMontage(
  token: string,
  memoryId: string,
  montageId: string,
): Promise<Montage> {
  return request(`/memories/${memoryId}/montages/${montageId}/retry`, { method: 'POST', token });
}

/**
 * The five stages of making a video, in the order the worker walks them (api README, «Журнал
 * монтажа»). The order is itself the contract: «этап 3 из 5» on screen is a position in this list,
 * and the api sorts its own answer by it rather than by when the worker got round to each one.
 */
export const MONTAGE_STAGES = [
  'screening',
  'understanding',
  'directing',
  'rhythm',
  'assembly',
] as const;

export type MontageStageCode = (typeof MONTAGE_STAGES)[number];

/**
 * What a stage came to, free-form on the wire because each stage's result is its own shape. These
 * are the keys the api names as the ones an app may count on; a key that is not there is simply not
 * drawn, and the phrase itself is built on this side.
 */
export type MontageStageOutcome = {
  /** `screening` — «212 из 214 годятся», and why the rest went, by reason code. */
  kept?: number;
  of?: number;
  reasons?: Record<string, number>;
  /** `understanding` — «37 лиц, 5 людей в главных». */
  faces?: number;
  people?: number;
  animals?: number;
  /** `directing` — «3 части, 61 кадр». */
  parts?: number;
  frames?: number;
  part_titles?: string[];
  /** `rhythm` — the track it was laid out to, and how many cuts that came to. */
  track?: string;
  bpm?: number;
  /** `assembly` — the cuts and the running time of what came out. */
  cuts?: number;
  seconds?: number;
};

/**
 * One of the five stages as the journal reports it. `eta_seconds` on the stage being worked on is
 * what is *left* of it rather than what it will take in all, and the three counts at the end are the
 * api's own tally over the records — the worker never writes those, so they cannot disagree.
 */
export type MontageStage = {
  stage: MontageStageCode;
  state: 'pending' | 'running' | 'done' | 'failed';
  started_at: string | null;
  finished_at: string | null;
  eta_seconds: number | null;
  done_count: number;
  /** Null until there is something to count against — «61 из ?» is not drawn. */
  total_count: number | null;
  outcome: MontageStageOutcome;
  updated_at: string;
  taken_count: number;
  skipped_count: number;
  thought_count: number;
};

/**
 * One thing the director said, out loud, while putting the video together. Everything but the stage
 * is optional: a record with no `media_id` is a thought about the plan rather than about a frame,
 * and one with no `decision` is a thought with nothing settled in it.
 *
 * `id` is a number and it is the cursor — the largest one held is what the next poll asks after.
 * The four fractions of the gaze arrive as one `focus`, or as nothing at all.
 */
export type JournalEntry = {
  id: number;
  stage: MontageStageCode;
  media_id: string | null;
  thought: string | null;
  decision: 'take' | 'skip' | null;
  /** Why it was passed over, by the worker's own vocabulary — no fixed set, see `reasonWord`. */
  reason: string | null;
  series_size: number | null;
  story_part: number | null;
  story_part_title: string | null;
  source_from_seconds: number | null;
  source_to_seconds: number | null;
  labels: string[] | null;
  /** Where on the frame the director is looking, in fractions of it — never in pixels. */
  focus: { x: number; y: number; w: number; h: number } | null;
  created_at: string;
};

/**
 * A file one of those records is about, signed the way the gallery's frames are. Only the files met
 * in the page just handed over, so a journal of hundreds of records about the same frames is not
 * re-signed in full on every poll — and a frame that has since been deleted simply has no entry
 * here, which is not an error: the record about it stays either way.
 */
export type JournalFile = {
  id: string;
  kind: MediaItem['kind'];
  uploaded_by: string;
  captured_at: string | null;
  /** How long the file itself runs — not to be read as the length of a place below. */
  duration_seconds: number | null;
  thumbnail_url: string | null;
  /**
   * Where this frame ended up in this video, in the order it plays. A list because one frame
   * legitimately stands in a video twice — a clip cut in half, a photo that comes back at the end —
   * and empty while there is no layout yet, which is every frame during the screening.
   */
  places: { start_seconds: number; duration_seconds: number }[];
};

/** Somebody watching the assembly right now. The api hands out no more than this about them. */
export type Viewer = Pick<Contact, 'id' | 'username'>;

/** One page of the journal, as the route answers. */
export type MontageJournal = {
  montage: { id: string; status: Montage['status'] };
  stages: MontageStage[];
  /** Always newest first, whichever way the cursor was going. */
  entries: JournalEntry[];
  /** Is there more in the direction that was asked for — and if so, ask again straight away. */
  has_more: boolean;
  files: JournalFile[];
  viewers: Viewer[];
};

/** The cursor and the two narrowings, exactly as the route takes them. */
export type JournalQuery = {
  /** Records newer than this one, and of those the ones *next to* the cursor — see `@/montage-journal`. */
  after?: number;
  /** Records older than this one — paging back through a journal already being read. */
  before?: number;
  /** Up to 500; the api fills in 200. */
  limit?: number;
  stage?: MontageStageCode;
  media_id?: string;
};

/**
 * How the video was put together, live and afterwards (api README, «Журнал монтажа»). Any member
 * reads it, a viewer included, and the reading itself is what marks the reader as watching — there
 * is no «я смотрю» to send. A montage with no journal at all answers with an empty one rather than
 * an error, and a finished video's journal is read the same way years later.
 */
export function fetchJournal(
  token: string,
  memoryId: string,
  montageId: string,
  query: JournalQuery = {},
): Promise<MontageJournal> {
  const asked = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  return request(
    `/memories/${memoryId}/montages/${montageId}/journal${asked ? `?${asked}` : ''}`,
    { token },
  );
}

/**
 * «Свой трек с телефона» (doc-03, spec 8 step 3): the organizer's own music instead of one off the
 * shelf. It goes into R2 the way material does — this announces the file and hands back the signed
 * links to send it with — and it is the organizer's alone, 403 for anybody else. 413 over the
 * file ceiling, 503 while the api has no bucket.
 *
 * The plan is the same shape the media intent answers with, deliberately: the parts are cut and
 * sent by the same arithmetic (`@/upload-queue`), and `@/music` is what does the sending. There is
 * no re-issue route for these links — a track is small and the hour is long — so an upload that
 * breaks is started again rather than resumed.
 */
export function startMusicUpload(
  token: string,
  memoryId: string,
  sizeBytes: number,
): Promise<UploadPlan> {
  return request(`/memories/${memoryId}/music`, {
    method: 'POST',
    body: { size_bytes: sizeBytes },
    token,
  });
}

/**
 * «Загружено» for a track: seals the parts into one object and answers with the key the order names
 * it by, in `music_track_key`. Idempotent — a repeat only reports where the row stands — and on the
 * same long leash `finishUpload` has, since the api is waiting on R2 assembling the object.
 */
export function finishMusicUpload(
  token: string,
  memoryId: string,
  trackId: string,
  parts: { part_number: number; etag: string }[],
): Promise<{ id: string; status: string; key: string }> {
  return request(`/memories/${memoryId}/music/${trackId}/complete`, {
    method: 'POST',
    body: { parts },
    token,
    timeout: 60_000,
  });
}

/**
 * «Послушать» on step 3 (TASK-171): a signed link to one of the five off the shelf, good for the
 * hour the api signs its links for. Outside `/memories` and behind the plain token — the shelf is
 * one for the whole product, the same five for everyone, so there is no memory to be a member of
 * and no role to weigh. 404 for an id that is not on it, 503 while the api has no bucket.
 */
export function previewMusicTrack(token: string, trackId: MusicTrackId): Promise<{ url: string }> {
  return request(`/music/tracks/${trackId}`, { token });
}

/**
 * Tell the api where to push to. Idempotent: the same device token registered twice is one row,
 * so this can run on every launch without asking whether it already ran.
 */
export function registerPushToken(
  token: string,
  expoToken: string,
  platform: string,
): Promise<{ ok: true }> {
  return request('/me/push-tokens', {
    method: 'POST',
    body: { token: expoToken, platform },
    token,
  });
}

/**
 * Join by invite link. Answers with the memory as its new member sees it — the same shape
 * `/memories` hands out, so the screen it lands on has nothing extra to fetch. 404 once the
 * link has been rotated, and being a member already is a plain 200 that changes no role.
 */
export function acceptInvite(token: string, inviteToken: string): Promise<Memory> {
  return request('/invites/accept', { method: 'POST', body: { token: inviteToken }, token });
}

/** Drop the session server-side. Sends no body on purpose — see the note in `request`. */
export function endSession(token: string): Promise<{ ok: true }> {
  return request('/auth/logout', { method: 'POST', token });
}

// 3–30 chars: an alphanumeric at each end with separators allowed only between them.
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/;

/** A cheap client-side mirror of the server rule. The server stays the authority. */
export function isValidUsername(username: string): boolean {
  return USERNAME.test(username);
}
