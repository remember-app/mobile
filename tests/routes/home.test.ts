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
  expect(index).toContain('const thumbs = item.recent_thumbnail_urls ?? [];');
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
});

test('one icon stands in the header and it opens the account', () => {
  // Spec 8, `Main`: the main screen has exactly one button beside its name. There were two — the
  // contact list had its own — and the second one is what this stops coming back, because a screen
  // gains an icon far more easily than it loses one.
  expect(index.match(/<IconButton/g)).toHaveLength(2); // the account, and the cross on the banner
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
  expect(index).toContain('<Banner text={s.home.offline}>');
  // And the one that says it is back has no button on it at all, in either language: it leaves by
  // itself, and a button on something already going is a button nobody reaches.
  expect(index).toContain('<Banner tone="done" text={s.home.online} />');
  expect(index).toContain("setTimeout(() => setLink({ at: 'ok' }), duration.hold)");
  expect(index).toContain('return () => clearTimeout(leaves);');
});

test('hiding the offline line does not count as the connection coming back', () => {
  // The cross puts the message away; it says nothing about the network. Folding `hushed` into `ok`
  // would leave somebody who dismissed it never told when it returns — the quiet half of the pair.
  expect(index).toContain("setLink({ at: 'hushed', why: link.why })");
  expect(index).toContain("was.at === 'gone' || was.at === 'hushed' ? { at: 'back' } : was");
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
