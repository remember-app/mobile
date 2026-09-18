import { expect, test } from 'vitest';

import invite from './app/invite.tsx?raw';
import { en, ru } from '@/strings';

/**
 * `src/app/invite.tsx` has no renderer for the same reason the other routes read as text
 * (`home-screen.test.ts`): it is wired to `expo-router` and `useAuth`. What matters is that its
 * five branches — no token, still signing in, a link followed while signed out, a link accepted,
 * and a link already spent — each land on the right one and never on another's words.
 */

test('a link with no token at all is the one silence with no story behind it', () => {
  expect(invite).toContain('if (!invite) {');
  expect(invite).toContain('setStop({ text: s.join.noToken });');
});

test('a second visit picks the token back up from where the first one left it', () => {
  // `usePush` reopens this screen once a session exists; nothing in the url this time, so the
  // token the person actually tapped must not turn into `s.join.noToken`.
  expect(invite).toContain('const invite = fromLink ?? peekInvite();');
});

test('signing in comes before accepting, and the token survives the trip', () => {
  expect(invite).toContain("if (status !== 'ready' || session === null) {");
  expect(invite).toContain('stashInvite(invite);');
  expect(invite).toContain("router.replace('/login');");
  // The api call sits after that branch's `return` — a signed-out visitor must never reach it.
  expect(invite.indexOf("router.replace('/login');")).toBeLessThan(
    invite.indexOf('acceptInvite(session, invite)'),
  );
});

test('an accepted invite clears the stash before it leaves, so the join cannot repeat', () => {
  expect(invite).toContain('clearInvite();');
  expect(invite).toContain(
    "router.replace({ pathname: '/memory/[id]', params: { id: memory.id, face: 'people' } });",
  );
  expect(invite.indexOf('clearInvite();')).toBeLessThan(invite.indexOf('router.replace({'));
});

test('a spent link gets a heading of its own; every other failure speaks in the api’s words', () => {
  expect(invite).toContain('const dead = e instanceof ApiError && e.status === 404;');
  expect(invite).toContain('if (dead) clearInvite();');
  expect(invite).toContain(
    'setStop(dead ? { title: s.join.deadTitle, text: s.join.dead } : { text: errorMessage(e) });',
  );
  // A guessed heading over a message the api already chose is worse than none.
  for (const set of [en, ru]) {
    expect(set.join.deadTitle).not.toEqual(set.join.dead);
  }
});
