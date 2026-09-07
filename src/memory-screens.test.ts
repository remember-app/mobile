import { expect, test } from 'vitest';

import gallery from './app/memory/[id]/gallery.tsx?raw';
import montage from './app/memory/[id]/montage.tsx?raw';
import members from './app/memory/[id].tsx?raw';
import invite from './app/invite.tsx?raw';
import layout from './app/_layout.tsx?raw';
import push from './push.ts?raw';

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
  expect(members).toContain('s.members.material');
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

test('the roads into a memory are unchanged, and a finished montage opens the montage screen', () => {
  // An accepted invite and the gallery's `Users` icon both land on the guest list; only the
  // «ролик готов» push follows the videos to where they went.
  expect(invite).toContain("pathname: '/memory/[id]'");
  expect(gallery).toContain("router.push({ pathname: '/memory/[id]', params: { id } })");
  expect(push).toContain("router.push({ pathname: '/memory/[id]/montage'");
});
