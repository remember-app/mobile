import { expect, test } from 'vitest';
import { hitSlop } from '@/kit/tap';

// The kit's floor is 44×44; a control drawn smaller borrows the difference back as slop so the
// finger target still meets it. Both real call sites — the 40×40 icon button and the small
// (44-wide, 36-high) button — are pinned here alongside the edge cases around the floor.

test('grows a control smaller than the floor evenly on every side', () => {
  // The icon button: drawn 40, felt 44.
  expect(hitSlop(40)).toEqual({ left: 2, right: 2, top: 2, bottom: 2 });
});

test('a control already at the floor needs no slop', () => {
  expect(hitSlop(44)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
});

test('never borrows a control back below zero once past the floor', () => {
  expect(hitSlop(48)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
});

test('width and height grow independently when given separately', () => {
  // The small button: 44 wide already, 36 high — only the top and bottom need slop.
  expect(hitSlop(44, 36)).toEqual({ left: 0, right: 0, top: 4, bottom: 4 });
});
