import { expect, test } from 'vitest';
import { hitSlop } from '@/kit/tap';

// The floor is 44×44 (spec 1.6); a control drawn smaller borrows the difference back as slop so the
// finger target still meets it. Both real call sites — the 36 cross in a row and the 32 «скрыть
// сообщение» on the offline banner — are pinned here alongside the edge cases around the floor.

test('grows a control smaller than the floor evenly on every side', () => {
  // The cross in a contact row: drawn 36, felt 44.
  expect(hitSlop(36)).toEqual({ left: 4, right: 4, top: 4, bottom: 4 });
  // The banner's dismiss: drawn 32, felt 44.
  expect(hitSlop(32)).toEqual({ left: 6, right: 6, top: 6, bottom: 6 });
});

test('a control already at the floor needs no slop', () => {
  expect(hitSlop(44)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
});

test('never borrows a control back below zero once past the floor', () => {
  expect(hitSlop(48)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
});

test('width and height grow independently when given separately', () => {
  // A small row button: 40 high, wide enough already.
  expect(hitSlop(60, 40)).toEqual({ left: 0, right: 0, top: 2, bottom: 2 });
});
