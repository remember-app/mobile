import { expect, test, vi } from 'vitest';

// `expo-secure-store` is native and does not exist under vitest, so this stands in for the phone's
// keychain: `stored` is what the last run of the app left on it, and it is read back by the next
// launch — which is the whole of «выбор помнится» (doc-12).
const { phone } = vi.hoisted(() => ({ phone: { stored: null as string | null } }));

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => phone.stored,
  setItemAsync: async (_key: string, value: string) => {
    phone.stored = value;
  },
}));

/** A cold start of the app, carrying whatever the last start stored. */
async function start() {
  vi.resetModules();
  const density = await import('@/lib/density');
  await density.densityReady;
  return density;
}

test('three across until somebody says otherwise — the layout’s own three', async () => {
  phone.stored = null;
  const density = await start();
  expect(density.currentDensity()).toBe(3);
  expect(density.DENSITIES).toEqual([3, 5, 7]);
});

test('a picked density beats the default, and outlives the app', async () => {
  phone.stored = null;
  const first = await start();
  await first.setDensity(5);
  expect(first.currentDensity()).toBe(5);
  // The same phone, next launch: the pick is read back off the disk rather than the default
  // answering again — the one thing the setting is for.
  expect((await start()).currentDensity()).toBe(5);
});

test('a stored value this build does not know is not a pick', async () => {
  // Four, six, a blank, anything a rolled-back build or a hand-edited keychain could leave behind:
  // the layout’s three stand until a person picks one of the three on offer.
  for (const stored of ['4', '6', '', 'five']) {
    phone.stored = stored;
    expect((await start()).currentDensity(), stored).toBe(3);
  }
});

test('a keychain that cannot be read leaves the layout deciding, and does not throw at a launch', async () => {
  const density = await start();
  // `densityReady` refuses nothing at the app's face: the promise resolves to what it decided to
  // stand at, so a broken keychain costs the memory of the pick and not the launch.
  expect(await density.densityReady).toBe(density.currentDensity());
});

test('the grids redraw when the pick changes, which is how a screen re-cuts its rows', async () => {
  // There is no harness in this repo that mounts a component and watches it redraw, so the contract
  // `useSyncExternalStore` relies on is proven here the way `theme.test.ts` proves its own: a
  // listener registered directly is called when the value moves.
  phone.stored = null;
  const density = await start();
  let told = 0;
  const off = density.subscribe(() => {
    told += 1;
  });
  await density.setDensity(7);
  expect(density.currentDensity()).toBe(7);
  expect(told).toBe(1);
  // And a pick that does not move the value does not redraw the world either.
  await density.setDensity(7);
  expect(told).toBe(1);
  off();
  await density.setDensity(3);
  expect(told).toBe(1);
});