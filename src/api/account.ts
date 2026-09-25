import { currentLanguage, type Language } from '@/lib/language';
import { request } from './call';

/** The account: the three ways in, the nick, the language, and the way out. */
/** The account as the api returns it. `username` is null until it is claimed. Duplicated, same reason. */
export type User = {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  /** «Даты между днями»: one setting of the person for every feed of theirs, off on a new account. */
  dates_between_days: boolean;
};

/** What every sign-in endpoint answers with: the session token plus the account it belongs to. */
export type Session = { token: string; user: User };

/** A non-2xx answer. Carries the status and parsed body so screens can branch on 401/409/501/… */

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
 * Turn «Даты между днями» on or off for the account — every feed of every memory, on every phone the
 * person is signed in on. Answers with the account, same as `putLanguage`.
 */
export function putDatesBetweenDays(token: string, on: boolean): Promise<User> {
  return request('/me/dates-between-days', {
    method: 'POST',
    body: { dates_between_days: on },
    token,
  });
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

/** Drop the session server-side. Sends no body on purpose — see the note in `request`. */
export function endSession(token: string): Promise<{ ok: true }> {
  return request('/auth/logout', { method: 'POST', token });
}

// 3–30 chars: an alphanumeric at each end with separators allowed only between them.

// 3–30 chars: an alphanumeric at each end with separators allowed only between them.
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/;

/** A cheap client-side mirror of the server rule. The server stays the authority. */
export function isValidUsername(username: string): boolean {
  return USERNAME.test(username);
}
