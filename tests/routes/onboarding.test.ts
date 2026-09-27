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
import stepHead from '@/kit/step-head.tsx?raw';
import { TYPE_MOST } from '@/kit/text';
import head from '@/screens/onboarding/head.tsx?raw';
import progress from '@/screens/onboarding/progress.tsx?raw';
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

const walk = { login, email, code, consent, username };

test('every step has a head of its own, and the five of them are one part', () => {
  // Spec 8, 27 September: the stack and the promise, the feed, the film, the faces, the people —
  // one head per step, drawn by the kit's `StepHead` with that step's picture and words.
  for (const [at, [name, screen]] of Object.entries(walk).entries()) {
    expect(flat(screen), name).toContain(`<OnboardingHead step={${at + 1}}`);
  }
  expect(head).toContain('<StepHead');
  for (const art of ['<PhotoStack', '<FeedArt', '<FilmArt', '<FacesArt', '<PeopleArt'])
    expect(head, art).toContain(art);
  // The words are the dictionary's, in both languages — step 4 and 5 as the layout writes them.
  expect(ru.consent.title).toBe('Прежде чем войти');
  expect(ru.consent.lead).toBe('Три вещи, на которые вы соглашаетесь.');
  expect(ru.username.title).toBe('Как вас звать');
  expect(ru.login.feed.title).toBe('Одна лента на всех');
  expect(ru.login.film.title).toBe('И сразу ролик');
  expect(ru.login.step(3)).toBe('Шаг 3 из 5');
  expect(en.login.step(3)).toBe('Step 3 of 5');
});

test('the head stands where the layout measured it, and never moves', () => {
  // Detail 76, from the status line (the layout's 52): «Назад» 18 under it, 10 off the edge; the
  // picture 60 under it, 90 tall — the first step's stack 176; the heading 12 under the picture (16
  // under the stack); the block of the field at the layout's 312, and at least 16 under the lead.
  const kit = flat(stepHead);
  expect(kit).toContain('head: { minHeight: 312 - 52 - space.s4 }');
  expect(kit).toContain("art: { height: 90, marginTop: 60, alignItems: 'center' }");
  expect(kit).toContain('artFirst: { height: 176 }');
  expect(kit).toContain('marginTop: space.s3, paddingHorizontal: space.s6');
  expect(kit).toContain('wordsFirst: { marginTop: space.s4 }');
  expect(kit).toContain('block: { marginTop: space.s4, paddingHorizontal: space.s4 }');
  expect(kit).toContain("back: { position: 'absolute', left: 10, top: 18 }");
  // Anchored to the top of the board and not centred in what is left over: centred, it would ride
  // up and down as the keyboard took the room under it.
  expect(stepHead).not.toContain("justifyContent: 'center' }");
});

test('the keyboard moves only the main button: the field stands in the body, nothing under it', () => {
  // Spec 7.1, detail 76, `LoginCodeKeys`: the field is the head's `children`, in the body the board
  // never moves, and only the button is in the bottom layer the keyboard lifts — 16 over it.
  for (const [name, screen] of Object.entries({ email, code, username })) {
    const footer = screen.slice(screen.indexOf('footer={'), screen.indexOf('<OnboardingHead'));
    expect(footer, name).toContain('<ActionBar keyboardGap={space.s4}>');
    expect(footer, name).not.toMatch(/<(Field|CodeField|UsernameField)\b/);
    const body = screen.slice(screen.indexOf('<OnboardingHead'));
    expect(body, name).toMatch(/<(Field|CodeField|UsernameField)\b/);
  }
  // `LoginCodeKeys` is not a route: it is `LoginCode` with the keyboard up.
  expect(layout).not.toContain('LoginCodeKeys');
  // And the answer about what was typed is over the field, never under it.
  expect(email).toContain('hintAbove');
  expect(form).toContain('hintAbove={wayIn}');
});

test('one progress over the whole way in, over the navigator and not in the screens', () => {
  // Detail 75: five segments, one bar for all the steps — so it is drawn once, over the stack, and
  // can fill the next segment as a step is walked, the second to the fourth at once after Apple or
  // Google, and empty the one a step back left.
  expect(layout).toContain('<OnboardingProgress />');
  expect(flat(progress)).toContain(
    "'/login': 1, '/login/email': 2, '/login/code': 3, '/consent': 4, '/set-username': 5,",
  );
  expect(progress).toContain('<StepScale tone="paper" steps={5} done={step}');
  expect(progress).toContain('top: insets.top + 6');
  for (const screen of Object.values(walk)) expect(screen).not.toContain('StepScale');
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
  // And every step after the first has a way back — floating in the head, because a header row
  // would push the head down 44 and break what the test above pins.
  expect(stepHead).toContain('<BackButton label={back.label} onPress={back.onPress} />');
  for (const [name, screen] of Object.entries({ email, code, username })) {
    expect(screen, name).not.toContain('<AppBar');
    // The arrow leads to the step before — otherwise it is an icon that leads nowhere.
    expect(screen, name).toContain('back={() => router.back()}');
  }
  // The address and the code behind the agreement are spent: going back from it is walking away,
  // and it ends the session they bought — the gate stands the way in from its first step.
  expect(flat(consent)).toContain('back={() => signOut().catch(');
  // `Login` has no way back at all — «нет пути назад, потому что это начало» — and `Consent` has no
  // decline to dress up as a second choice either.
  expect(login).not.toContain('back=');
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

test('digits the api refuses are answered over the cells, and the cells are emptied', () => {
  // The api answers 401 to every way six digits can fail — wrong, expired, spent, used up — so this
  // side says one thing back instead of guessing which half to blame.
  const caught = code.slice(code.indexOf('} catch (e) {'), code.indexOf('} finally {'));
  expect(caught).toContain('e.status === 401');
  expect(caught).toContain("setCode('')");
  expect(caught).toContain('setBad(true)');
  expect(code).toContain("state={bad ? 'error' : undefined}");
  // Detail 12: the head of the block says so, in place of where the letter went — under the cells
  // there is nothing.
  expect(flat(code)).toContain('bad ? s.login.codeBad.toUpperCase()');
  expect(ru.login.codeBad).toBe('Код не подошёл');
  expect(en.login.codeBad).toMatch(/code/i);
});

test('the address in the head is the one that was typed — never in capitals — and breaks after @ or a dot', () => {
  // Detail 80, `[правлено]`: «КОД НА liza@example.com»; a long address wraps after «@» or a dot.
  expect(flat(code)).toContain('`${s.login.codeTo.toUpperCase()} ${breakable(email)}`');
  expect(code).toContain('const MAY_BREAK = String.fromCharCode(0x200b);');
  expect(code).toContain('address.replace(/[@.]/g, `$&${MAY_BREAK}`)');
  expect(ru.login.codeTo).toBe('Код на');
});

test('another code is asked for from the same screen, and then rests for a minute', () => {
  expect(code).toContain('const { code: handed } = await startEmailSignIn(email);');
  // Drawn as detail 80 has it: the small 32 on `raise`, no hairline, 12 / 600 in paper, hung 8 past
  // the column's edge — a repair beside the address, never the thing the screen is for.
  expect(code).toContain('variant="raise"');
  expect(code).toContain('size="xxs"');
  expect(code).toContain('labelRole="chipXs"');
  expect(code).toContain('labelTone="paper"');
  expect(code).toContain('again: { marginRight: -space.s2 }');
  // A minute after a letter went out it waits and counts: «Ещё раз через 0:47».
  expect(code).toContain('const AGAIN_AFTER_MS = 60_000;');
  expect(code).toContain('setRested(Date.now() + AGAIN_AFTER_MS);');
  expect(code).toContain('s.login.againIn(formatRuntime(wait)');
  expect(code).toContain('disabled={busy || wait > 0}');
  expect(ru.login.againIn('0:47')).toBe('Ещё раз через 0:47');
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
  // Pushed, so the name's «Назад» leads back to it.
  expect(consent).toContain("router.push('/set-username');");

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
  expect(username).toContain("useUsername({ onConsentNeeded: () => router.replace('/consent') })");
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

test('on the way in a name is answered in one word over the field; on the sheet, in a line under it', () => {
  // Spec 8, `Username` (27 September): «СВОБОДЕН» or «ЗАНЯТ» beside «НИК», a spinner in the field while
  // the server is asked, nothing under the box — what the name is for is the head's lead.
  expect(ru.username.available).toBe('Свободен');
  expect(ru.username.taken).toBe('Занят');
  expect(form).toContain('pending={wayIn && availability ===');
  expect(ru.username.intro).toBe(
    'В воспоминании вас зовут выбором из списка. Ник — чтобы вас нашли по нему.',
  );
  // The sheet over the account keeps «Ник свободен.» and then «По нему вас найдут в воспоминании.»
  // on one line, and its column of 12.
  expect(form).toContain("hintAfter={!wayIn && state === 'ok' ? s.username.lead : undefined}");
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
