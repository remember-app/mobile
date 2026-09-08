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

test('the email field stands on the place of the ways in, never beside them', () => {
  // The kit's screen 1: three buttons at the bottom edge and nothing else, and the field arrives on
  // their place only when the third of them is asked for. A field standing there at all times —
  // which is the layout this replaced — reads as a fourth way in that everyone has to look past.
  const foot = login.slice(login.indexOf('<ActionBar'), login.indexOf('</ActionBar>'));
  const [asked, offered] = foot.split(') : (');

  expect(asked).toContain('<Field');
  expect(offered).not.toContain('<Field');
  expect(offered).toContain('s.login.withApple');
  expect(offered).toContain('s.login.withGoogle');
  // And the way back out of it, so the one screen with no header is not a room with no door.
  expect(asked).toContain('setByMail(false)');
});

test('the development way in is not dressed up as the ordinary one', () => {
  // The plain banner, no tone: rust would read as a failure and green as a job well done, and this
  // is neither — it is the workbench, and both languages have to say so in their own words.
  expect(login).toContain('<Banner text={s.login.devLink} />');
  expect(en.login.devLink).toMatch(/development/i);
  expect(ru.login.devLink).toMatch(/разработк/i);
});

test('a dev link with no token in it fails loud instead of trading nothing', () => {
  const block = login.slice(login.indexOf('if (!token) {'), login.indexOf('const session = await'));
  expect(block).toContain('setDevLink(false);');
  expect(block).toContain('setError(s.link.noToken);');
});

test('the trade\'s own failures land in the screen\'s words, not the api\'s', () => {
  // A spent link (TASK-97's token is single-use) answers 401, and the api's own wording for that is
  // written for whoever runs it — same trade `mailDown` already makes for a 503.
  const block = login.slice(login.indexOf('} catch (e) {'), login.indexOf('} finally {'));
  expect(block).toContain('setDevLink(false);');
  expect(block).toContain('if (status === 503) setError(s.login.mailDown);');
  expect(block).toContain('else if (status === 401) setError(s.link.expired);');
  expect(en.link.expired).toMatch(/expired/i);
  expect(ru.link.expired).toMatch(/действ/i);
});
