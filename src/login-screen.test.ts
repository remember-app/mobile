import { expect, test } from 'vitest';

import login from './app/login.tsx?raw';
import { en, ru } from '@/strings';

/**
 * The two answers to `POST /auth/email/start` differ by one optional field, and picking the wrong
 * branch breaks quietly in both directions: a phone that really was sent a letter would sit trading
 * a token that does not exist, and a workbench with no mail behind it would be told to check an
 * inbox nothing was posted to. Read as text, the reason `memory-screens.test.ts` gives at length —
 * this is an `expo-router` screen wired to auth, and there is no renderer for one here.
 */

test('only the answer that was actually mailed sends the person to their inbox', () => {
  expect(login).toContain('const { link } = await startEmailSignIn(email.trim());');
  expect(login).toContain('if (!link) {');
  // The one place the waiting screen is raised, and it sits under that guard.
  expect(login.match(/setSent\(true\)/g)).toHaveLength(1);
});

test('a link handed back is traded for a session here, not put up to be copied', () => {
  expect(login).toContain("new URL(link).searchParams.get('token')");
  expect(login).toContain('const session = await verifyEmailToken(token);');
  expect(login).toContain('await signIn(session.token);');
});

test('the development way in is not dressed up as the ordinary one', () => {
  // The plain banner, no tone: rust would read as a failure and green as a job well done, and this
  // is neither — it is the workbench, and both languages have to say so in their own words.
  expect(login).toContain('<Banner text={s.login.devLink} />');
  expect(en.login.devLink).toMatch(/development/i);
  expect(ru.login.devLink).toMatch(/разработк/i);
});
