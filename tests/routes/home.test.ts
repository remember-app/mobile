import { expect, test } from 'vitest';

import index from '@/app/index.tsx?raw';
import { en, ru } from '@/strings';

/**
 * `card-memory.test.tsx` proves the card itself draws whatever it is handed — this proves the home
 * screen hands it the right thing, and that the three silences of spec «Ожидание и отказы» stay
 * three. Read as text, the same reason `tests/routes/memory/screen.test.ts` reads the other routes that way: no
 * renderer here for a screen wired to `expo-router` and auth.
 */

test('a memory card on the home screen draws the frames the listing actually signed', () => {
  // The wider sample from the whole memory, and the tail behind it for an api older than that field
  // (TASK-544). Both `??` — a build that knows the field can meet an api that does not, and a card
  // that read a missing one bare would throw inside the list renderer.
  expect(index).toContain(
    'const thumbs = item.card_thumbnail_urls ?? item.recent_thumbnail_urls ?? [];',
  );
  expect(index).toContain('thumbs={thumbs}');
});

test('the blank strip tells the truth about why it is empty', () => {
  // An empty memory and a memory still waiting on the worker are not the same silence, and the
  // wording must not collapse into one — the fix that milestone made was drawing frames at all;
  // this is what stops the two states drifting onto the same sentence later. The words moved into
  // the dictionary with TASK-86, so the screen is pinned on picking between two keys and the two
  // keys are pinned on saying different things — in both languages, not only the one written first.
  expect(index).toContain('item.media_count === 0');
  expect(index).toContain('s.home.noFrames');
  expect(index).toContain('s.state.preparing');
  expect(en.home.noFrames).not.toEqual(en.state.preparing);
  expect(ru.home.noFrames).not.toEqual(ru.state.preparing);
  // And the empty one says what spec 7.6 (detail 37) and `Main.html`'s third card say (TASK-383).
  expect(ru.home.noFrames).toBe('Ни одного кадра — скиньте первые');
  expect(en.home.noFrames).toBe('No frames yet — share the first ones');
});

test('one icon stands in the header and it opens the account', () => {
  // Spec 8, `Main`: the main screen has exactly one button beside its name. There were two — the
  // contact list had its own — and the second one is what this stops coming back, because a screen
  // gains an icon far more easily than it loses one.
  // The account — the cross on the banner is the banner's own (`hide`).
  expect(index.match(/<IconButton/g)).toHaveLength(1);
  expect(index).toContain('label={s.home.account}');
  expect(index).toContain("router.push('/profile')");
  expect(index).not.toContain("router.push('/contacts')");
});

test('the large card is the freshest memory only while it has a photograph to carry', () => {
  // Spec 8 gives the lead card two fifths of the screen because it *is* a picture with a name
  // across it. The memory just created is both the freshest and the emptiest one there is, so
  // keying the size on the index alone opens the app on a 340-tall grey rectangle. A chosen cover
  // is that photograph just as much as the tail is, and it carries the card on its own.
  expect(index).toContain('const large = index === 0 && (cover !== null || thumbs.length > 0);');
});

test('a memory whose organizer chose a face draws it, and one that has none is unchanged', () => {
  // Spec 7.6, «с обложкой» — the card itself decides what a cover does to each of its two sizes
  // (`card-memory.test.tsx`); the screen's whole part is handing over the field the api signs.
  expect(index).toContain('cover={cover}');
  // `?? null` and not a bare read: the app ships over the air and the api deploys on its own, so
  // a build that knows this field can meet one that does not — and `undefined` would then decide
  // the size of the lead card by accident.
  expect(index).toContain('const cover = item.cover_thumbnail_url ?? null;');
});

test('who has already brought their frames is read off the listing, not asked per card', () => {
  // TASK-141 put the summary on `GET /memories` for exactly this reason: the screen holds every
  // memory one is in, and a roster request per card would be a round trip per card.
  expect(index).toContain('item.contributed_member_count / item.member_count');
  expect(index).toContain('s.home.brought(item.contributed_member_count, item.member_count)');
  // An api older than the field sends neither, and `0 / 0` is `NaN` — which is a full bar under
  // «undefined из undefined», not an empty one.
  expect(index).toContain('const shared = large && item.member_count > 0;');
});

test('the connection is a line over the list and never a replacement for it', () => {
  // Spec «Ожидание и отказы»: `HomeOffline` goes on being the main screen. A failed refetch that
  // cleared the list — or stood an error in its place — would be the screen the design refuses.
  expect(index).not.toContain('setMemories(null)');
  expect(index).toContain('ListHeaderComponent');
  expect(index).toContain('text={s.state.offline}');
  expect(index).toContain('hide={{ label: s.action.hide');
  // And the one that says it is back has no button on it at all, in either language: it leaves by
  // itself, and a button on something already going is a button nobody reaches.
  expect(index).toContain('<Banner tone="done" text={s.state.online} />');
  expect(index).toContain("setTimeout(() => setLink('ok'), duration.hold)");
  expect(index).toContain('return () => clearTimeout(leaves);');
});

test('hiding the offline line does not count as the connection coming back', () => {
  // The cross puts the message away; it says nothing about the network. Folding `hushed` into `ok`
  // would leave somebody who dismissed it never told when it returns — the quiet half of the pair.
  expect(index).toContain("onPress: () => setLink('hushed')");
  expect(index).toContain("was === 'gone' || was === 'hushed' ? 'back' : was");
});

test('a refused read is the api answering, and never a lost connection', () => {
  // TASK-521 — the same question `frames-material.ts` asks before it stands its plate: only a read
  // nobody got an answer at all is the connection. A 403/404/500 is the server's own word about
  // something else, and «нет связи» over a list that is fine says the wrong reason out loud.
  // Pinned on the *guard*, not on the words around it: what the failure says is `failed`'s job and
  // `failed` is its own state now, so the two cannot be told apart by looking at either alone.
  expect(index).toContain("import { answered } from '@/lib/failure';");
  expect(index).toContain("if (!answered(e)) setLink('gone');");
  // The whole state: a read that failed writes the reason and nothing else, and where the connection
  // stands is never derived from a failure — that derivation is what made a 403 look like an outage.
  expect(index).toContain('const [failed, setFailed] = useState<string | null>(null);');
  expect(index).not.toMatch(/setLink\(\{\s*at: 'gone'/);
});

test('the empty list invites instead of reporting, and the first load says which it is', () => {
  // Spec `HomeEmpty` — a heading and a paragraph, not one flat sentence — and `HomeLoading`, whose
  // whole point is that it is *not* the empty state: a list still on its way must never read as a
  // list with nothing in it.
  expect(index).toContain('title={s.home.emptyTitle}');
  expect(index).toContain('<Waiting text={s.state.gathering} />');
  for (const set of [en, ru]) {
    expect(set.home.emptyTitle).not.toEqual(set.home.empty);
    expect(set.home.empty.length).toBeGreaterThan(60);
  }
});
