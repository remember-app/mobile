import { fontFile, wordWidth } from '@tests/helpers/font';
import { api, flat } from '@tests/helpers/source';
import { expect, test } from 'vitest';

import layout from '@/app/_layout.tsx?raw';
import notFound from '@/app/+not-found.tsx?raw';
import consent from '@/app/consent.tsx?raw';
import code from '@/app/login/code.tsx?raw';
import email from '@/app/login/email.tsx?raw';
import login from '@/app/login.tsx?raw';
import username from '@/app/set-username.tsx?raw';
import { ICO_S } from '@/kit/icon';
import { TYPE_MOST } from '@/kit/text';
import head from '@/screens/onboarding/head.tsx?raw';
import form from '@/screens/onboarding/username-form.tsx?raw';
import { en, ru, type Strings } from '@/strings';
import { space, type } from '@/theme';

/**
 * The five screens of the way in (spec 8, «Онбординг») — `Login`, `LoginEmail`, `LoginCode`,
 * `Consent`, `Username` — read as text, the idiom `tests/routes/memory/screen.test.ts` explains at length: these
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

test('the head stands where the layout measured it, and the squeezed one where Consent has it', () => {
  // TASK-378, `Login.json`: the stack's box 68–304 under a status line of 52 (16 under it, 236
  // tall), «Remember» at 330 — 26 under the stack — and the promise at 388, 14 under the name's 44.
  expect(flat(head)).toContain("head: { alignItems: 'center', paddingTop: space.s4, gap: 26 }");
  expect(flat(head)).toContain(
    "words: { alignItems: 'center', gap: 14, paddingHorizontal: space.s6 }",
  );
  // `Consent.json`: the squeezed box starts at 40, 12 above the status line, and is 196 tall; the
  // name follows at 254 — 18 under it — and the lead 12 under the name.
  expect(flat(head)).toContain('headSmall: { paddingTop: 0, marginTop: -12, gap: 18 }');
  expect(flat(head)).toContain('wordsSmall: { gap: space.s3 }');
});

test('the three doors stand 10 apart, as the layout stacks them', () => {
  // `Login.json`: «Продолжить с Google» 688–744, «Продолжить по почте» from 754.
  expect(login).toContain('doors: { flex: 1, gap: 10 }');
  // And the mail door wears the `mail` spec 8 names for it, 18 at 1.8 — not the main 56's 19 / 2.1.
  expect(login).toContain('glyph={{ size: 18, stroke: 1.8 }}');
});

test('a way in this build cannot walk is not drawn at all', () => {
  // Both providers stand under their own signals — which ones, `tests/screens/login-flow.test.tsx`
  // walks. Drawn switched off, they are three buttons where only one works and the person finds out
  // which by pressing.
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
  expect(login).not.toContain('variant="primary"');
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
    expect(screen, name).toContain('<BackButton label={s.action.back}');
    expect(screen, name).toContain("back: { position: 'absolute'");
    expect(screen, name).not.toContain('<AppBar');
    // The arrow is drawn beside `router.back()` — otherwise the doc comment's «way back» promise is
    // an icon that leads nowhere.
    expect(screen, name).toContain('onPress={() => router.back()}');
  }
  // `Login` has no way back at all — «нет пути назад, потому что это начало» — and `Consent` has no
  // decline to dress up as one either: walking away from the screen is the only refusal it offers.
  expect(login).not.toContain('ChevronLeft');
  expect(consent).not.toContain('ChevronLeft');
});

test('the letter carries six digits now, and the address is sent with them', () => {
  expect(api).toContain(
    "return request('/auth/email/verify', { method: 'POST', body: { email, code } });",
  );
  expect(email).toContain('const { code } = await startEmailSignIn(address);');
  expect(flat(email)).toContain("router.push({ pathname: '/login/code'");
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
  // And drawn as the layout draws it (`LoginCode.json` e16–e17): 13 / 600 in paper beside the muted
  // address, its words ending on the column's edge (x 374), the address stepping 4 in (x 20).
  expect(code).toContain('labelRole="label"');
  expect(code).toContain('labelTone="paper"');
  // The quiet button's own 14 a side (no hairline round it — TASK-397), all of it hung out.
  expect(code).toContain('again: { marginRight: -14 }');
  expect(flat(code)).toContain('gap: space.s3, paddingLeft: space.s1,');
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
  // The layout paints that row #1A1A24 (spec 8) — the night's `raiseSoft`, and never a raw hex a
  // day theme has never heard of.
  expect(consent).not.toMatch(/'#[0-9A-Fa-f]{6}'/);
  expect(consent).toContain('lit: { backgroundColor: color.raiseSoft }');
});

test('the agreement reads at the layout’s sizes: 14 / 20 promises, a link, a 12 line under it all', () => {
  // `Consent.json`: the three promises 14 / 20 (e9, e14, e18), the lit one a weight up; «Полный
  // текст соглашения» a link 13 / 600 in accentText (e19); «Без согласия зарегистрироваться
  // нельзя.» 12 (e21) — in `muted`, not the layout's `faint`: it is read (spec 10.1, `Consent`);
  // and the card, the link, «Принимаю» and that line 14 apart.
  expect(consent.match(/<Text role="bodyXs"/g)).toHaveLength(4);
  expect(consent).not.toContain('role="note"');
  expect(consent).toContain('style={[styles.grow, styles.medium]}');
  expect(flat(consent)).toContain('<Button variant="link" label={s.consent.readFull}');
  expect(consent).not.toContain('variant="quiet"');
  expect(consent).toContain('<Text role="noteSm" tone="muted" style={styles.note}>');
  expect(consent).toContain('column: { flex: 1, gap: 14 }');
});

test('the six digits are asked for whole, though the layout draws the button lit at four', () => {
  // `LoginCode.json` e18 shows «Подтвердить» in accent with four cells filled. Kept off until the
  // sixth on purpose: the api answers any shorter code with the 401 that empties the cells.
  expect(code).toContain('disabled={code.length < 6 || email ===');
});

test('a free name is answered and told what it is for, and the column is the way in’s 12', () => {
  // `Username.json`: «Ник свободен.» and then «По нему вас найдут в воспоминании.» on one line
  // (e14, e15), the label, the box, that line and «Продолжить» each 12 apart.
  expect(form).toContain("hintAfter={state === 'ok' ? s.username.lead : undefined}");
  expect(form).toContain("form: { alignSelf: 'stretch', gap: space.s3 }");
  expect(ru.username.lead).toBe('По нему вас найдут в воспоминании.');
  expect(en.username.lead).toMatch(/find you in a memory/);
});

test('the short line about storage is the layout’s own sentence, word for word', () => {
  // `Consent.json` e9 (chief, 26 September: the layout is the newer word, TASK-409).
  expect(ru.consent.storage).toBe(
    'Ваши фото и видео хранятся у нас, пока вы не удалите их или воспоминание.',
  );
  expect(en.consent.storage).toMatch(/until you delete them or the memory\.$/);
  // The full text keeps the whole of it, being removed from a memory included.
  expect(ru.consent.agreement.parts[1]?.text).toMatch(/расшифровывает речь/);
  expect(ru.consent.agreement.parts[0]?.text).toMatch(/исключены/);
});

const ONEST = {
  regular: fontFile('@expo-google-fonts/onest/400Regular/Onest_400Regular.ttf'),
  medium: fontFile('@expo-google-fonts/onest/500Medium/Onest_500Medium.ttf'),
  bold: fontFile('@expo-google-fonts/onest/700Bold/Onest_700Bold.ttf'),
};
/** The words of a line of the card, each in the face it is drawn in. */
const inFace = (face: Buffer, text: string) =>
  text
    .split(' ')
    .filter(Boolean)
    .map((word) => [face, word] as const);
/** The three lines of the card as their words, the lit one a weight up and its middle two. */
const promises = (s: Strings) => [
  inFace(ONEST.regular, s.consent.storage),
  [
    ...inFace(ONEST.medium, s.consent.recognisesBefore),
    ...inFace(ONEST.bold, s.consent.recognises),
    ...inFace(ONEST.medium, s.consent.recognisesAfter),
  ],
  inFace(ONEST.regular, s.consent.training),
];
/** How many lines words fall into at `width`, each filled before the next is begun. */
function lineCount(words: readonly (readonly [Buffer, string])[], width: number, size: number) {
  let lines = 0;
  let at = Number.POSITIVE_INFINITY;
  for (const [face, word] of words) {
    const wide = wordWidth(face, word, size);
    const next = at + wordWidth(face, ' ', size) + wide;
    if (next <= width) at = next;
    else [lines, at] = [lines + 1, wide];
  }
  return lines;
}

test('the card of three promises is as tall as the layout’s at 390, and its words wrap whole on 320 at the largest type', () => {
  // `Consent.json` e7: the card 358 × 240 — rows 72 / 92 / 72 (e9, e11, e18: two lines, three, two)
  // between two hairlines, inside one. The storage line used to take three, and the card stood 19
  // taller than the layout's. A row is its lines of 20 and 16 over and under them; the words stand
  // 12 after the 18 glyph — the lit row's 22 circle — inside 16 and the card's hairline.
  expect(consent).toContain(
    "line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3, padding: space.s4 },",
  );
  expect(consent).toContain('size={lit ? ICO_XS : ICO_S}');
  expect(flat(consent)).toContain('spark: { width: 22, height: 22,');
  expect(flat(consent)).toContain('borderRadius: radius.section, borderWidth: 1,');
  const { fontSize, lineHeight } = type.bodyXs;
  const column = (phone: number, glyph: number) =>
    phone - 2 * space.s4 - 2 - 2 * space.s4 - glyph - space.s3;
  const glyphs = [ICO_S, 22, ICO_S];
  for (const s of [ru, en]) {
    const lines = promises(s).map((words, at) =>
      lineCount(words, column(390, glyphs[at]), Number(fontSize)),
    );
    if (s === ru) expect(lines).toEqual([2, 3, 2]);
    // The English storage line is two as well — the row the layout draws, whatever the language.
    expect(lines[0], 'storage').toBe(2);
    const card = 2 + 2 + lines.reduce((sum, n) => sum + 2 * space.s4 + n * Number(lineHeight), 0);
    if (s === ru) expect(card).toBe(240);
    // No word of the three is wider than its column on 320 at the ceiling its words grow to: they
    // wrap there, a word to a line at worst, and never break (spec 10.2; `TYPE_MOST`).
    for (const [at, words] of promises(s).entries())
      for (const [face, word] of words)
        expect(wordWidth(face, word, Number(fontSize)) * TYPE_MOST, word).toBeLessThanOrEqual(
          column(320, glyphs[at]),
        );
  }
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
