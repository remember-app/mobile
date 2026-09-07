import { expect, test } from 'vitest';

import gallery from './app/memory/[id]/gallery.tsx?raw';
import montage from './app/memory/[id]/montage.tsx?raw';
import upload from './app/memory/[id]/upload.tsx?raw';
import members from './app/memory/[id].tsx?raw';
import home from './app/index.tsx?raw';
import invite from './app/invite.tsx?raw';
import layout from './app/_layout.tsx?raw';
// The one kit file read here: the sheet's offset from the header is the appbar's own padding.
import bars from './kit/bars.tsx?raw';
import push from './push.ts?raw';
import { en, ru } from '@/strings';

/**
 * The split of TASK-64, read off the route files themselves: the montage on one screen, the guest
 * list on the other, and no way to upload from either — that button lives in the gallery.
 *
 * Their text and not their rendered output, because this project has no renderer: every test here
 * runs pure logic, and a screen would need `react-native` transformed and `expo-router`,
 * `expo-video` and the safe area all faked before its first line ran. What is worth pinning about a
 * reorganisation is which half went where and what still points at what — that much the text
 * answers. These go the day a render harness arrives.
 */

test('the montage screen is a route of its own, behind the same gate as the rest of a memory', () => {
  expect(layout).toContain('<Stack.Screen name="memory/[id]/montage"');
  // Inside `Stack.Protected` — a screen declared outside it exists signed out too.
  expect(layout.indexOf('name="memory/[id]/montage"')).toBeLessThan(
    layout.indexOf('</Stack.Protected>'),
  );
});

test('the montage half moved out of the memory screen whole', () => {
  for (const moved of ['listMontages', 'orderMontage', 'retryMontage', 'CardMontage']) {
    expect(montage).toContain(moved);
    expect(members).not.toContain(moved);
  }
});

test('the roster half stayed where it was', () => {
  for (const stayed of ['listMembers', 'RowMember', 'inviteByUsername', 'removeMember']) {
    expect(members).toContain(stayed);
    expect(montage).not.toContain(stayed);
  }
});

test('neither of the two offers the upload screen any more — the gallery is where that button is', () => {
  expect(members).not.toContain('/memory/[id]/upload');
  expect(montage).not.toContain('/memory/[id]/upload');
  expect(gallery).toContain('/memory/[id]/upload');
});

test('the way to the material stays on the memory screen', () => {
  expect(members).toContain('/memory/[id]/gallery');
  // The words themselves live in the dictionary now (TASK-86); the button is pinned by the key.
  expect(members).toContain('s.memory.frames(');
});

// The four screens of one memory, and what tells them apart — TASK-76, reported by the designer:
// three of them were titled with the memory's own name and switched by one unlabelled icon, and the
// fourth had thrown the name away for the bare word «Gallery».

test('every screen of a memory wears its name, with the section it is under the name', () => {
  for (const [screen, section] of [
    [members, 's.members.title'],
    [montage, 's.montage.title'],
    [upload, 's.upload.title'],
    [gallery, 's.memory.framesPlain'],
  ] as const) {
    // The memory's own title, with one shared word standing in until the listing answers — four
    // different fallbacks would be four screens under four names for the same fraction of a second.
    expect(screen).toContain('s.memory.fallbackTitle');
    // And under it, the only thing that says which of the four is open.
    expect(screen).toContain(`subtitle={${section}}`);
  }
});

test('the material of a memory has one name — on the card, on the guest list, over the sheet', () => {
  // Three names for one thing was the other half of the report: «N frames» on the card, «Photos and
  // videos (N)» on the guest list, «Gallery» over the contact sheet. One key answers all three now.
  expect(members).toContain('s.memory.frames(');
  expect(members).toContain('s.memory.framesPlain');
  expect(gallery).toContain('subtitle={s.memory.framesPlain}');
  // The card names the material only where there is none of it to draw, and by the same word.
  expect(home).toContain('s.home.noFrames');
  for (const set of [en, ru]) {
    // «0 кадров» → «кадров», which is what «Кадров пока нет» has to be built on too. Russian
    // declines it, so the counted form is the one both lines are held against.
    expect(set.home.noFrames.toLowerCase()).toContain(set.memory.frames(0).split(' ')[1]);
  }
});

test('the two screens reach each other without stacking a copy each hop', () => {
  // The montage screen keeps its corner icon back to the roster; the road the other way is the
  // guest list's own glowing button now (TASK-74). `navigate` on both, so the pair never stacks.
  expect(members).toContain("router.navigate({ pathname: '/memory/[id]/montage'");
  expect(montage).toContain("router.navigate({ pathname: '/memory/[id]'");
});

test('the ember on the guest list is the road to the movie, not the one to the gallery', () => {
  // The kit gives the glow to one action per surface, and this file draws two: the screen, and the
  // invite sheet over it. Two glows in it, then, and each on the thing its own surface is for.
  expect(members.match(/variant="primary"/g)).toHaveLength(2);
  // The button a hit sits in: from its own `<Button` back to the `/>` that closes it.
  const button = (at: number) =>
    members.slice(members.lastIndexOf('<Button', at), members.indexOf('/>', at));
  const first = members.indexOf('variant="primary"');
  expect(button(first)).toContain("'/memory/[id]/montage'");
  expect(button(members.indexOf('variant="primary"', first + 1))).toContain('onPress={sendInvite}');
  // And the way to the material, which used to wear it, is a plain button.
  expect(button(members.indexOf("'/memory/[id]/gallery'"))).not.toContain('variant=');
});

// The open frame, read the same way. What was reported is a shape — «во весь экран без кнопок
// снизу, а снизу лента» — and a shape is what these pin: where the actions went, and that the strip
// is the grid's own list read once. Everything the strip decides is pinned properly in
// `frames.test.ts`; these three only guard the layout from drifting back.

test('nothing stands under the open frame — the actions moved up onto it', () => {
  // The bottom bar of the viewer and the style it wore are gone; the grid keeps its own.
  expect(gallery).not.toContain('styles.bar');
  expect(gallery).toContain('styles.viewerBar');
  for (const action of [
    'label={s.action.close}',
    'label={s.action.download}',
    'label={s.action.delete}',
  ]) {
    expect(gallery.slice(gallery.indexOf('styles.viewerBar'))).toContain(action);
  }
  // And they are still the same three errands, the delete still behind the kit's sheet.
  expect(gallery).toContain('ConfirmSheet');
  expect(gallery).toContain('void save(shown)');
});

test("the strip under the frame is the grid's own list, read once", () => {
  // The whole list and not a window on it: the strip is handed `items`, the same array the sheet
  // above draws.
  expect(gallery).toContain('data={items}');
  // One read of the media serves both the sheet and the strip.
  expect(gallery.match(/listMedia\(/g)).toHaveLength(1);
});

test('the strip is walked to the open frame, never started at it', () => {
  // `initialScrollIndex` is the prop this obviously wants and the one that broke it: it pins the
  // render window on the frame it names until a scroll event arrives, and a strip short enough to
  // fit on screen never scrolls, so the event never comes. Opened on the fifth of seven frames the
  // strip drew three, with a blank where the first four belonged and no way to reach them — the
  // whole point of the strip, lost, on every gallery small enough not to overflow the screen.
  // The prop and not the word: the comment above the fix names it, and has to be free to.
  expect(gallery).not.toContain('initialScrollIndex={');
  // Asked for once the content is laid out instead, which positions the strip the same way without
  // touching the window.
  expect(gallery).toContain('onContentSizeChange');
  expect(gallery).toContain('strip.current?.scrollToIndex({');
  expect(gallery).toContain('index: frameIndex(items, open)');
  // `scrollToIndex` on a list this long is only safe because every tile is a known size.
  expect(gallery).toContain('getItemLayout');
});

test('a strip tile and a sheet tile read a record the same way', () => {
  // `frameOf` twice and nowhere else: the two places that draw a record must not drift, which is
  // the bug the whole of `@/frames` exists to have fixed once.
  expect(gallery.match(/frameOf\(item\)/g)).toHaveLength(2);
});

test('neither the sheet nor the strip opens a frame that is still developing', () => {
  // The exact ternary and not just a call count: swapping which branch is `undefined` would still
  // match `mayOpen(item)` twice while opening exactly the records this gate exists to stop. This
  // was the bug fixed in review — a tap on a waiting frame opened a whole screen saying
  // «Preparing…», which is what was reported.
  const gate = 'onPress={mayOpen(item) ? () => setOpen(item.id) : undefined}';
  const escaped = gate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  expect(gallery.match(new RegExp(escaped, 'g'))).toHaveLength(2);
});

test('the frame shown full screen is the same reading frameOf gives every tile', () => {
  // `openFrame` is `frameOf(shown)` and not `shown.thumbnail_url` read straight — the difference is
  // the fallen-frame correction `frameOf` makes for a `ready` record with no derivative. Reading the
  // field directly here would show a broken image instead of the «could not be prepared» state.
  expect(gallery).toContain('const openFrame = shown === null ? null : frameOf(shown);');
  expect(gallery).toContain('<Image source={{ uri: openFrame.uri }}');
});

// The contact sheet itself, measured by the designer (TASK-79): the last frame of a sheet came out
// 2pt wider than every frame above it, and the frame the strip had open came out smaller than its
// neighbours. Both are one question — how wide a column of the kit's sheet is — and both screens
// that draw a sheet have to answer it the same way.

test('every column of a contact sheet is the same width, the last row included', () => {
  for (const sheet of [gallery, upload]) {
    // `flex: 1/3` divides what a row has left after its gaps, so a last row with one frame in it —
    // no gaps in it to leave — handed that frame a third of the whole row instead of a column.
    expect(sheet).not.toContain('flex: 1 / 3');
    // A column worked out from the width the sheet spans, and re-read when the phone turns.
    expect(sheet).toContain('useWindowDimensions()');
    expect(sheet).toContain('SHEET_GAP * 2) / 3');
  }
});

test('the 12 under the appbar is the kit’s own, and nothing stands between it and the sheet', () => {
  // «Контактный лист вплотную к шапке» was the report; `.appbar{padding:var(--s4) 0 var(--s3)}` is
  // where the kit keeps that 12, and the kit's appbar has carried it since m-7. Pinned so the sheet
  // cannot end up flush against the header by the padding being dropped from underneath it.
  expect(bars).toContain('paddingBottom: space.s3');
  // And the gallery hangs its sheet straight off the appbar — no second gap, no screen-wide `gap`.
  expect(gallery).toContain('screen: { flex: 1, backgroundColor: color.ink }');
});

test('a tile is read out in the line it is drawn with', () => {
  // «Все кадры названы photo» — the raw `kind` off the api, before the dictionary (TASK-86). What
  // was left after that is the state: both sheets ask the frame, not the record's status, whether
  // there is anything to say past «Фото», and both go through the one helper to ask it.
  expect(gallery.match(/nameOf\(item, frame/g)).toHaveLength(2);
  expect(gallery).toContain("frame.state === 'ready' ? null : s.gallery.waiting[item.status]");
});

test('the roads into a memory are unchanged, and a finished montage opens the montage screen', () => {
  // An accepted invite and the gallery's `Users` icon both land on the guest list; only the
  // «ролик готов» push follows the videos to where they went.
  expect(invite).toContain("pathname: '/memory/[id]'");
  expect(gallery).toContain("router.push({ pathname: '/memory/[id]', params: { id } })");
  expect(push).toContain("router.push({ pathname: '/memory/[id]/montage'");
});
