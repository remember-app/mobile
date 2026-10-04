import { expect, test, vi } from 'vitest';

// `expo-secure-store` is native and does not exist under vitest, so this stands in for the phone's
// keychain. It is keyed, because the key is half of «выбор помнится» (doc-12): a pick written under
// one name and read under another is a pick that does not survive the launch, and a stand-in that
// kept one value whatever it was asked for would call that a launch that worked.
const { phone } = vi.hoisted(() => ({ phone: { disk: new Map<string, string>() } }));

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => phone.disk.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    phone.disk.set(key, value);
  },
}));

/** A cold start of the app, carrying whatever the last start left on the phone. */
async function start() {
  vi.resetModules();
  const density = await import('@/lib/density');
  await density.densityReady;
  return density;
}

/** The pick as it stands on the disk, under whatever name the app filed it. */
const stored = () => [...phone.disk.entries()];

test('three across until somebody says otherwise — the layout’s own three', async () => {
  phone.disk.clear();
  const density = await start();
  expect(density.currentDensity()).toBe(3);
  expect(density.DENSITIES).toEqual([3, 5, 7]);
});

test('a picked density beats the default, and outlives the app', async () => {
  phone.disk.clear();
  const first = await start();
  await first.setDensity(5);
  expect(first.currentDensity()).toBe(5);
  // The same phone, next launch: the pick is read back off the disk rather than the default
  // answering again — the one thing the setting is for.
  expect((await start()).currentDensity()).toBe(5);
});

test('the pick is filed under one key and read back under that same one', async () => {
  // A stand-in that kept one value whatever it was asked for would pass the test above with the key
  // spelled two different ways in the two places: written under one, read under another, and every
  // launch quietly back at three. The key is named here, so a rename is a red run — and it is
  // `density`, beside the app's own `language` and `theme` and apart from both.
  phone.disk.clear();
  const first = await start();
  await first.setDensity(7);
  expect(stored()).toEqual([['density', '7']]);
  // One string, and nobody else's key: a pick that landed under the language's would be read by two
  // settings at once.
  expect(phone.disk.size).toBe(1);
  // And it is still there for the launch that only ever reads.
  expect((await start()).currentDensity()).toBe(7);
});

test('a stored value this build does not know is not a pick', async () => {
  // Four, six, a blank, anything a rolled-back build or a hand-edited keychain could leave behind:
  // the layout’s three stand until a person picks one of the three on offer.
  for (const value of ['4', '6', '', 'five']) {
    phone.disk.clear();
    phone.disk.set('density', value);
    expect((await start()).currentDensity(), value).toBe(3);
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
  // listener registered directly is called when the value moves, and not when it does not.
  phone.disk.clear();
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
