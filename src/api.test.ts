import { expect, test } from 'vitest';
import { mayContribute } from '@/api';

// Was three copies of the same check (memory screen ×2, gallery screen ×1) until review m-3 found
// them — the risk was exactly one drifting from the other two. One pinned truth table replaces it.
test('organizer and contributor may bring material and people in, viewer and nobody may not', () => {
  expect(mayContribute('organizer')).toBe(true);
  expect(mayContribute('contributor')).toBe(true);
  expect(mayContribute('viewer')).toBe(false);
  expect(mayContribute(null)).toBe(false);
});
