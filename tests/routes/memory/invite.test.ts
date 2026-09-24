/**
 * Asking somebody into a memory, and the last words this face owns: the invite sheet's one slot, the
 * line a tile is read out in, and the words of the labels flow.
 *
 * Their text and not their rendered output, because this file has no renderer: every test here runs
 * pure logic, and a screen would need `react-native` transformed and `expo-router`, `expo-video` and
 * the safe area all faked before its first line ran. What is worth pinning about a reorganisation is
 * the shape of it — that much the text answers. What these screens *do* is read in the flow tests
 * (`tests/screens/`), where there is a renderer; what stays here is what only the text can say:
 * where a thing stands, and what is no longer in the file.
 */

import { expect, test } from 'vitest';
import viewer from '@/screens/memory/frame-viewer.tsx?raw';
import frames from '@/screens/memory/frames.tsx?raw';
import inviteSheet from '@/screens/memory/invite-sheet.tsx?raw';
import { en, ru } from '@/strings';

test('a name already on the roster is answered in the field, not left to an empty sheet', () => {
  // `pickable` drops a contact who is already a member and the api is never asked about a name the
  // roster already holds (`answered`), so without `here` the sheet said nothing at all about a nick
  // that is right behind its own scrim — reported as a silent sheet.
  expect(inviteSheet).toContain(
    'const here = (members ?? []).find((member) => member.username?.toLowerCase() === needle);',
  );
  expect(inviteSheet).toContain('here !== undefined ||');
  expect(inviteSheet).toContain('? s.members.already(memberName(here), s.role[here.role])');
});

test('a contact already on the roster is not offered a second invite', () => {
  expect(inviteSheet).toContain(
    '!members?.some((member) => member.id === contact.id) && matches(contact, needle)',
  );
  // And the block itself is not drawn at all once that leaves nobody to offer — no contacts saved,
  // or every one of them already here.
  expect(inviteSheet).toContain('{pickable.length > 0 ? (');
});

test('a second «Позвать» pressed under the first is refused while the call is in the air', () => {
  // Found in review: without the guard, a second press unlocked the field mid-flight and let
  // whichever answer landed last be read as the answer to the last press. One button on the sheet
  // since TASK-145, so the guard is the sheet's own `busy` rather than the id of a spinning row.
  expect(inviteSheet).toContain('if (!handle || busy) return;');
});

/**
 * The sheet the layout draws (TASK-145, `SheetInvite`): one field, the saved people as chips under
 * it, the link under a rule, and one «Позвать» at the foot. Two roads in and one press — so what is
 * pinned here is that the press can only ever be about one person.
 */

test('a chip and the field are one slot: what the button sends to is never two people', () => {
  // Picked out of the chips, or turned up by the typed name — and typing lets the chip go, so the
  // two cannot both be holding somebody when the button is pressed.
  expect(inviteSheet).toContain(
    "const target = here ? null : (picked ?? saved ?? (found === 'none' ? null : found));",
  );
  expect(inviteSheet).toContain('setPicked(picked?.id === contact.id ? null : contact);');
  expect(inviteSheet).toContain('disabled={target === null}');
  // And a chip already pressed in is what the kit draws filled — the same «выбран» a filter chip
  // wears, never a second mark invented by this sheet.
  expect(inviteSheet).toContain('selected={picked?.id === contact.id}');
});

test('a tile is read out in the line it is drawn with', () => {
  // «Все кадры названы photo» — the raw `kind` off the api, before the dictionary (TASK-86). What
  // was left after that is the state: both sheets ask the frame, not the record's status, whether
  // there is anything to say past «Фото», and both go through the one helper to ask it.
  expect(frames).toContain('nameOf(item, frame)');
  expect(frames).toContain("frame.state === 'ready' ? null : s.gallery.waiting[item.status]");
  // One helper for both, and the window is handed it rather than writing a second one: the strip
  // says the same about a record as the tile above it, «открыто» apart.
  expect(frames).toContain('nameOf={nameOf}');
  expect(viewer).toContain(
    'labelAt={(to) => nameOf(frames[to], frameOf(frames[to]), to === index)}',
  );
});

/**
 * The labels of a memory (spec 7.7, 10.8): what a press does, what the feed and the filter show
 * afterwards and every refusal are pinned by running the screens — `memory/label-sheets-flow.test.tsx`
 * and `memory/frames-labels-flow.test.tsx`. Only the words the person reads stay here, because those
 * tests read them off the dictionary instead of spelling them.
 */
test('the words of the labels flow are the ones the layout wrote', () => {
  expect(ru.gallery.whichLabels).toBe('Лейблы');
  expect(ru.gallery.labelsPut).toBe('Лейблы: положить выбранное');
  expect(ru.labels.create(4)).toBe('Создать и положить 4 кадра');
  expect(en.labels.create(1)).toBe('Create and file 1 frame');
  expect(ru.labels.deleteText).toContain('Кадры останутся в воспоминании');
  expect(ru.labels.sharedDenied).toContain('личный');
  expect(ru.labels.gone).toBe('Этого лейбла больше нет.');
  expect(en.labels.gone).toBe('This label is no longer here.');
  expect(ru.memory.gone).toBe('Вас больше нет в этом воспоминании.');
});
