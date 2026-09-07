import { expect, test } from 'vitest';

import index from './app/index.tsx?raw';
import { en, ru } from '@/strings';

/**
 * `card-memory.test.tsx` proves the card itself draws whatever `thumbs` it is handed — this proves
 * the home screen hands it the right thing. `listMemories` signs `recent_thumbnail_urls` per memory;
 * a rename or a swap to the wrong field would leave the strip silently empty on every card, which is
 * exactly the kind of one-prop-deep, silent-when-broken wiring `card-memory.test.tsx`'s own docblock
 * warns about and cannot itself see. Read as text, the same reason `memory-screens.test.ts` reads
 * the other routes that way: no renderer here for a screen wired to `expo-router` and auth.
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
