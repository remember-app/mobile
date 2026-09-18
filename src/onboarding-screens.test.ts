import { expect, test } from 'vitest';

import api from './api.ts?raw';
import notFound from './app/+not-found.tsx?raw';
import layout from './app/_layout.tsx?raw';
import consent from './app/consent.tsx?raw';
import login from './app/login.tsx?raw';
import code from './app/login/code.tsx?raw';
import email from './app/login/email.tsx?raw';
import username from './app/set-username.tsx?raw';
import head from './onboarding-head.tsx?raw';
import form from './username-form.tsx?raw';
import { en, ru } from '@/strings';

/**
 * The five screens of the way in (spec 8, «Онбординг») — `Login`, `LoginEmail`, `LoginCode`,
 * `Consent`, `Username` — read as text, the idiom `memory-screens.test.ts` explains at length: these
 * are `expo-router` screens wired to auth, and there is no renderer for one here.
 *
 * What they are about is what breaks quietly: a way in drawn that this build cannot walk, a code
 * refused with the server's own wording, an agreement that can be walked around, and a head that
 * drifts up the screen as the block under it grows.
 */

const walk = { login, email, code, username };

test('the head is one element, and the four screens that share it hold it in one place', () => {
  // Four screens, one part, no variant: whatever is different about them happens at the bottom.
  for (const [name, screen] of Object.entries(walk)) {
    expect(screen, name).toContain('<OnboardingHead />');
  }
  // `Consent` is the one that squeezes it, because a card of three promises stands underneath.
  expect(consent).toContain('<OnboardingHead small />');

  // Anchored to the top of the board and not centred in what is left over: centred, the name would
  // ride up and down as the footer under it grew a field, then six cells — which is the one thing
  // these four screens must not do.
  expect(head).toContain('paddingTop: space.s4');
  expect(head).not.toContain("justifyContent: 'center'");
});

test('a way in this build cannot walk is not drawn at all', () => {
  // Both providers stand under their own signal. Drawn switched off, they are three buttons where
  // only one works and the person finds out which by pressing.
  expect(login).toContain('{appleAvailable ? (');
  expect(login).toContain('{GOOGLE_CLIENT_ID ? (');
  expect(login).not.toContain('disabled={!appleAvailable}');
  // `disabled={!googleRequest}` stays inside the branch: with an id the button is real and only
  // waits for the request to be built. Without one it is not there to wait.
  expect(login).toContain('disabled={!googleRequest}');
  // `null` and not `false` — the phone's answer is a round trip, and «not asked yet» is a third
  // thing from «no».
  expect(login).toContain('useState<boolean | null>(null)');
  // What a server that turns a live way in down still says is untouched: a stale signal is the
  // case this screen cannot see, and it is answered in words.
  expect(login).toContain('return s.login.providerUnavailable(provider);');
});

test('none of the three doors is the main one — there is no accent on this screen', () => {
  // Spec 8: «Ни одна не главнее: цвета акцента здесь нет». Which door a person owns is not
  // something the app has an opinion about, and an ember on one of them would be one.
  expect(login).not.toContain("variant=\"primary\"");
  expect(login).not.toContain("'primary'");
  expect(login).toContain('variant="paper"');
  expect(login).toContain('variant="secondary"');
});

test('the address is asked for on a screen of its own, which the mail door opens', () => {
  expect(login).toContain("router.push('/login/email')");
  // The field stood on the place of the doors before (TASK-77); now it has a screen, so nothing on
  // the first one has to be read past.
  expect(login).not.toContain('<Field');
  expect(email).toContain('<Field');
  // And both of the screens after the first have a way back — a floating one, because a header row
  // would push the head down 44 and break what the test above pins.
  for (const [name, screen] of Object.entries({ email, code })) {
    expect(screen, name).toContain('icon={ChevronLeft}');
    expect(screen, name).toContain("back: { position: 'absolute'");
    expect(screen, name).not.toContain('<AppBar');
  }
});

test('the letter carries six digits now, and the address is sent with them', () => {
  expect(api).toContain("return request('/auth/email/verify', { method: 'POST', body: { email, code } });");
  expect(email).toContain('const { code } = await startEmailSignIn(address);');
  expect(email).toContain("router.push({ pathname: '/login/code'");
  expect(code).toContain('const session = await verifyEmailCode(email, code);');
  expect(code).toContain('await signIn(session.token);');
  // The kit's six cells, not six fields: one input behind them is what lets the phone's own
  // one-time-code autofill land.
  expect(code).toContain('<CodeField');
});

test('digits the api refuses are answered under the cells, and the cells are emptied', () => {
  // The api answers 401 to every way six digits can fail — wrong, expired, spent, used up — so this
  // side says one thing back instead of guessing which half to blame.
  const caught = code.slice(code.indexOf('} catch (e) {'), code.indexOf('} finally {'));
  expect(caught).toContain('e.status === 401');
  expect(caught).toContain("setCode('')");
  expect(caught).toContain('setBad(true)');
  expect(code).toContain("state={bad ? 'error' : undefined}");
  expect(code).toContain('hint={bad ? s.login.codeBad : undefined}');
  expect(en.login.codeBad).toMatch(/code/i);
  expect(ru.login.codeBad).toMatch(/код/i);
});

test('another code is asked for from the same screen, not by walking back for it', () => {
  expect(code).toContain('const { code: handed } = await startEmailSignIn(email);');
  expect(code).toContain('label={s.login.again}');
  // Quiet: another code is a repair, never the thing the screen is for.
  expect(code).toContain('variant="quiet"');
  // And it waits under its own flag: the main button spinning under «Входим…» while a letter is
  // being posted would say something that is not happening.
  expect(code).toContain('busy={sending}');
  expect(code).toContain('setSending(true);');
});

test('the development door hands the code forward instead of trading it out of sight', () => {
  // The api hands the digits straight back where it has no mail to post them with, and they are
  // carried to the cells rather than spent here: the six cells are where a code is entered,
  // whoever filled them in.
  expect(email).toContain('...(code ? { code } : {})');
  expect(code).toContain('s.login.devCode');
  // And it says it is the workbench, in both languages — this is not a way in anybody was meant
  // to have.
  expect(en.login.devCode).toMatch(/development/i);
  expect(ru.login.devCode).toMatch(/разработк/i);
});

test('the agreement stands before the name, and the gate is what puts it there', () => {
  expect(api).toContain("return request('/me/consent', { method: 'POST', token });");
  expect(consent).toContain('await acceptConsent(token);');
  expect(consent).toContain("router.replace('/set-username');");

  // The first screen a guard declares is the one the navigator falls back to, so a fresh session
  // lands on the agreement and not on the name it would be refused.
  const gate = layout.slice(layout.indexOf("guard={status === 'needs-username'}"));
  expect(gate.indexOf('name="consent"')).toBeLessThan(gate.indexOf('name="set-username"'));
});

test('a name refused for want of the agreement moves the person, it does not print the refusal', () => {
  // 403 «consent required» is not a line about the name at all — pressing again would only earn it
  // a second time. Which screen answers it belongs to whoever put the form up.
  expect(form).toContain('e.status === 403 && onConsentNeeded');
  expect(form).toContain('onConsentNeeded();');
  expect(username).toContain("onConsentNeeded={() => router.replace('/consent')}");
});

test('the agreement screen offers no refusal, and says so instead of hiding it', () => {
  expect(consent).toContain('label={s.consent.accept}');
  expect(consent).toContain('{s.consent.required}');
  // One ember on the screen and it is «Принимаю»; nothing here is dangerous-looking either, because
  // agreeing is not a loss.
  expect(consent.match(/variant="primary"/g)).toHaveLength(1);
  expect(consent).not.toContain('danger');
  expect(ru.consent.required).toMatch(/нельзя/);
  expect(en.consent.required).toMatch(/cannot register/i);
  // The whole text is one press away — shipped with the app, never fetched.
  expect(consent).toContain('{s.consent.agreement.title}');
  expect(consent).toContain('s.consent.agreement.parts.map');
  expect(ru.consent.agreement.parts).toHaveLength(3);
});

test('the line about the neural network is the lit one, and it is lit with tokens', () => {
  expect(consent).toContain('<Line lit icon={Smile}>');
  // The weight lands on the words that name what is recognised, inside the paragraph rather than
  // as a line of its own.
  expect(consent).toContain('style={styles.strong}');
  expect(consent).toContain('{s.consent.recognises}');
  expect(ru.consent.recognises).toMatch(/лица людей и животных/);
  // The layout paints that row #1A1A24, which is no token: a raw hex here would be a colour the day
  // theme has never heard of.
  expect(consent).not.toMatch(/'#[0-9A-Fa-f]{6}'/);
  expect(consent).toContain('backgroundColor: color.raise');
});

test('the short line about storage says what actually ends it, not what the layout drew', () => {
  // The layout says «пока вы не удалите их или воспоминание». There is no deleting a memory in this
  // product, so that half is a door that does not exist; what ends the storing is a frame deleted
  // or the person leaving.
  expect(ru.consent.storage).toContain('не выйдете из воспоминания');
  expect(ru.consent.storage).not.toContain('воспоминание.');
  expect(en.consent.storage).toMatch(/leave the memory/i);
  // The full text keeps the whole of it, being removed from a memory included.
  expect(ru.consent.agreement.parts[1]?.text).toMatch(/расшифровывает речь/);
  expect(ru.consent.agreement.parts[0]?.text).toMatch(/исключены/);
});

test('the username field is the one the layout draws, and the form still guards the claim', () => {
  expect(form).toContain('variant="username"');
  expect(form).toContain('prefix="@"');
  // At rest the line under it says what the name is for, not the rule about letters and length —
  // that one answers a broken name, and standing there before anything is typed it warns about
  // nothing. The screen has no heading to say it instead: the head above is the whole of it.
  expect(form).toContain('? s.username.lead');
  expect(username).not.toContain('role="display"');
  // Untouched by all of this: the check is a courtesy and the 409 is the guard.
  expect(form).toContain("const unchanged = typed === (user?.username ?? '');");
});

test('nothing is left of the link the server no longer sends', () => {
  expect(api).not.toContain('verifyEmailToken');
  expect(api).not.toContain('remember://auth/email');
  expect(layout).not.toContain('auth/email');
  // The screen that link landed on is gone, and so is every word written for it.
  expect(en).not.toHaveProperty('link');
  expect(ru).not.toHaveProperty('link');
  expect(en.login).not.toHaveProperty('sendLink');
});

test('a link the app has no screen for lands on the app, not on the framework’s error page', () => {
  // The letters already posted are still in inboxes. With no route of its own, `remember://auth/
  // email?token=…` opens expo-router's own black English «Unmatched Route» page — which reads as a
  // crash, where the screen that link used to open said the link was spent and offered the way in.
  expect(notFound).toContain('<Redirect href="/" />');
});
