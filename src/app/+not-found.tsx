import { Redirect } from 'expo-router';

/**
 * Anything the app has no screen for. Without this file expo-router draws its own «Unmatched Route»
 * page — black, English, with a link to the sitemap — which on a phone reads as a crash.
 *
 * It has one real caller: `remember://auth/email?token=…`. The api stopped sending that link
 * (TASK-138, the letter carries six digits now) and the screen it landed on is gone, but the letters
 * already posted are still sitting in inboxes, and the screen that link used to open said the link
 * was spent and offered the way in. This keeps that promise.
 *
 * `/` is read through the gate in `_layout`, which declares only the screens the session's standing
 * allows — so this lands on the memories, the agreement or the sign-in, whichever is owed, the same
 * way `invite.tsx` leans on it.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
