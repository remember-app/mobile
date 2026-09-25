import { onTestFinished, vi } from 'vitest';

/**
 * «Today» for the one test that calls it: 25 September 2026, the year the fixtures' memories are in —
 * so a date a screen writes back is this year's and goes without its year (spec 9), whatever the
 * machine's own clock says. Only `Date` is stood in for, and only until the test ends.
 */
export function thisYear2026() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 25, 12));
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
